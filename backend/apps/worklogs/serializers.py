from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import CompactUserSerializer
from apps.projects.models import Project

from .models import WorkLogEntry

User = get_user_model()


class WorkLogEntrySerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True), required=False)
    user_detail = CompactUserSerializer(source="user", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    project_color = serializers.CharField(source="project.color_hex", read_only=True)

    class Meta:
        model = WorkLogEntry
        fields = (
            "id",
            "user",
            "user_detail",
            "project",
            "project_name",
            "project_color",
            "work_date",
            "hour_slot",
            "duration_minutes",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("duration_minutes", "created_at", "updated_at")

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

    def validate(self, attrs):
        request = self.context["request"]
        instance = getattr(self, "instance", None)
        user = attrs.get("user") or getattr(instance, "user", None) or request.user
        project = attrs.get("project")
        work_date = attrs.get("work_date") or getattr(instance, "work_date", None)
        hour_slot = attrs.get("hour_slot")
        if hour_slot is None and instance is not None:
            hour_slot = instance.hour_slot

        if project and not project.is_active:
            raise serializers.ValidationError({"project": "Only active projects can be selected."})

        if user and work_date and hour_slot is not None:
            queryset = WorkLogEntry.objects.filter(user=user, work_date=work_date, hour_slot=hour_slot)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    "An entry already exists for this user, date, and hour slot."
                )
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        if not (request.user.is_staff or request.user.is_superuser):
            validated_data["user"] = request.user
        else:
            validated_data.setdefault("user", request.user)
        validated_data["duration_minutes"] = 60
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context["request"]
        if not (request.user.is_staff or request.user.is_superuser):
            validated_data.pop("user", None)
        validated_data["duration_minutes"] = 60
        return super().update(instance, validated_data)
