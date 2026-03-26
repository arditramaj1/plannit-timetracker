from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import CompactUserSerializer
from apps.projects.models import Project

from .models import (
    WorkLogEntry,
    build_overlap_validation_errors,
    can_user_log_parallel_projects,
    find_overlapping_entries,
)

User = get_user_model()

class WorkLogEntrySerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    duration_minutes = serializers.IntegerField(required=False)
    user_detail = CompactUserSerializer(source="user", read_only=True)
    project_code = serializers.CharField(source="project.code", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    project_color = serializers.CharField(source="project.color_hex", read_only=True)

    class Meta:
        model = WorkLogEntry
        fields = (
            "id",
            "user",
            "user_detail",
            "project",
            "project_code",
            "project_name",
            "project_color",
            "work_date",
            "hour_slot",
            "duration_minutes",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and not (request.user.is_staff or request.user.is_superuser):
            fields["user"].read_only = True
        return fields

    def validate_project(self, value: Project):
        if not value.is_active:
            raise serializers.ValidationError("Only active projects can be selected.")
        return value

    def validate_hour_slot(self, value: int):
        if value < 0 or value > 23:
            raise serializers.ValidationError("Hour slot must be between 0 and 23.")
        return value

    def validate_duration_minutes(self, value: int):
        if value < 60 or value % 60 != 0:
            raise serializers.ValidationError("Duration must be in whole-hour increments.")
        return value

    def validate(self, attrs):
        request = self.context["request"]
        instance = getattr(self, "instance", None)
        is_admin = request.user.is_staff or request.user.is_superuser
        user = attrs.get("user") or getattr(instance, "user", None)
        if user is None and not is_admin:
            user = request.user
        project = attrs.get("project")
        work_date = attrs.get("work_date") or getattr(instance, "work_date", None)
        hour_slot = attrs.get("hour_slot")
        if hour_slot is None and instance is not None:
            hour_slot = instance.hour_slot
        duration_minutes = attrs.get("duration_minutes")
        if duration_minutes is None:
            duration_minutes = instance.duration_minutes if instance is not None else 60

        if is_admin:
            if user is None:
                raise serializers.ValidationError({"user": "Select a user to save this work log for."})
            if user == request.user:
                raise serializers.ValidationError(
                    {"user": "Admins cannot create or edit work logs for themselves."}
                )

        if project and not project.is_active:
            raise serializers.ValidationError({"project": "Only active projects can be selected."})

        if hour_slot is not None and hour_slot + (duration_minutes // 60) > 24:
            raise serializers.ValidationError({"duration_minutes": "Work logs must end by 24:00."})

        if user and work_date and hour_slot is not None:
            overlapping_entries = find_overlapping_entries(
                user=user,
                work_date=work_date,
                hour_slot=hour_slot,
                duration_minutes=duration_minutes,
                exclude_id=instance.pk if instance else None,
            )
            errors = build_overlap_validation_errors(
                user=user,
                project_id=project.id if project else getattr(instance, "project_id", None),
                overlapping_entries=overlapping_entries,
            )
            if errors:
                raise serializers.ValidationError(errors)
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        if not (request.user.is_staff or request.user.is_superuser):
            validated_data["user"] = request.user
        validated_data.setdefault("duration_minutes", 60)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context["request"]
        if not (request.user.is_staff or request.user.is_superuser):
            validated_data.pop("user", None)
        return super().update(instance, validated_data)


class WorkLogBulkCreateSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    work_date = serializers.DateField()
    hour_slots = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=23),
        allow_empty=False,
    )
    notes = serializers.CharField(allow_blank=True, required=False, default="")

    def validate_project(self, value: Project):
        if not value.is_active:
            raise serializers.ValidationError("Only active projects can be selected.")
        return value

    def validate_hour_slots(self, value: list[int]) -> list[int]:
        unique_slots = sorted(set(value))
        if len(unique_slots) != len(value):
            raise serializers.ValidationError("Hour slots must be unique.")
        if unique_slots[-1] - unique_slots[0] + 1 != len(unique_slots):
            raise serializers.ValidationError("Select a continuous range of hour slots.")
        return unique_slots

    def validate(self, attrs):
        request = self.context["request"]
        is_admin = request.user.is_staff or request.user.is_superuser
        user = attrs.get("user")

        if not is_admin:
            user = request.user
            attrs["user"] = user
        elif user is None:
            raise serializers.ValidationError({"user": "Select a user to save this work log for."})

        if user == request.user and is_admin:
            raise serializers.ValidationError(
                {"user": "Admins cannot create or edit work logs for themselves."}
            )

        start_hour = attrs["hour_slots"][0]
        duration_minutes = len(attrs["hour_slots"]) * 60
        overlapping_entries = find_overlapping_entries(
            user=user,
            work_date=attrs["work_date"],
            hour_slot=start_hour,
            duration_minutes=duration_minutes,
        )
        errors = build_overlap_validation_errors(
            user=user,
            project_id=attrs["project"].id,
            overlapping_entries=overlapping_entries,
        )
        if errors:
            field_name, message = next(iter(errors.items()))
            raise serializers.ValidationError(
                {"hour_slots" if field_name == "hour_slot" else field_name: message}
            )
        return attrs

    def create(self, validated_data):
        return WorkLogEntry.objects.create(
            user=validated_data["user"],
            project=validated_data["project"],
            work_date=validated_data["work_date"],
            hour_slot=validated_data["hour_slots"][0],
            duration_minutes=len(validated_data["hour_slots"]) * 60,
            notes=validated_data.get("notes", ""),
        )


class ParallelWorkLogItemSerializer(serializers.Serializer):
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    duration_minutes = serializers.IntegerField()
    notes = serializers.CharField(allow_blank=True, required=False, default="")

    def validate_project(self, value: Project):
        if not value.is_active:
            raise serializers.ValidationError("Only active projects can be selected.")
        return value

    def validate_duration_minutes(self, value: int):
        if value < 60 or value % 60 != 0:
            raise serializers.ValidationError("Duration must be in whole-hour increments.")
        return value


class ParallelWorkLogCreateSerializer(serializers.Serializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    work_date = serializers.DateField()
    hour_slot = serializers.IntegerField(min_value=0, max_value=23)
    entries = ParallelWorkLogItemSerializer(many=True, min_length=2, max_length=4)

    def validate(self, attrs):
        request = self.context["request"]
        is_admin = request.user.is_staff or request.user.is_superuser
        user = attrs.get("user")

        if not is_admin:
            user = request.user
            attrs["user"] = user
        elif user is None:
            raise serializers.ValidationError({"user": "Select a user to save these work logs for."})

        if user == request.user and is_admin:
            raise serializers.ValidationError(
                {"user": "Admins cannot create or edit work logs for themselves."}
            )

        if not can_user_log_parallel_projects(user):
            raise serializers.ValidationError(
                {"entries": "This user is not allowed to log parallel project hours."}
            )

        project_ids = [entry["project"].id for entry in attrs["entries"]]
        if len(set(project_ids)) != len(project_ids):
            raise serializers.ValidationError(
                {"entries": "Each parallel work log must use a different project."}
            )

        start_hour = attrs["hour_slot"]
        for entry in attrs["entries"]:
            end_hour = start_hour + (entry["duration_minutes"] // 60)
            if end_hour > 24:
                raise serializers.ValidationError(
                    {"entries": "All parallel work logs must end by 24:00."}
                )

            overlapping_entries = find_overlapping_entries(
                user=user,
                work_date=attrs["work_date"],
                hour_slot=start_hour,
                duration_minutes=entry["duration_minutes"],
            )
            errors = build_overlap_validation_errors(
                user=user,
                project_id=entry["project"].id,
                overlapping_entries=overlapping_entries,
            )
            if errors:
                field_name, message = next(iter(errors.items()))
                if field_name == "project":
                    raise serializers.ValidationError(
                        {"entries": f"{entry['project'].name}: {message}"}
                    )
                raise serializers.ValidationError({"entries": message})

        return attrs

    def create(self, validated_data):
        entries = validated_data.pop("entries")
        with transaction.atomic():
            created_entries = [
                WorkLogEntry.objects.create(
                    user=validated_data["user"],
                    project=entry["project"],
                    work_date=validated_data["work_date"],
                    hour_slot=validated_data["hour_slot"],
                    duration_minutes=entry["duration_minutes"],
                    notes=entry.get("notes", ""),
                )
                for entry in entries
            ]
        return created_entries
