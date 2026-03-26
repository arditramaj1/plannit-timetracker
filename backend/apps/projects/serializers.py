from rest_framework import serializers

from .colors import get_saturated_pastel_project_colors
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    def validate_color_hex(self, value: str):
        normalized_value = value.upper()
        current_value = getattr(self.instance, "color_hex", "").upper()
        allowed_colors = set(get_saturated_pastel_project_colors())

        if normalized_value == current_value:
            return normalized_value

        if normalized_value not in allowed_colors:
            raise serializers.ValidationError("Select one of the available pastel project colors.")

        return normalized_value

    def create(self, validated_data):
        validated_data.setdefault("color_hex", get_saturated_pastel_project_colors()[0])
        return super().create(validated_data)

    class Meta:
        model = Project
        fields = (
            "id",
            "code",
            "name",
            "description",
            "color_hex",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")
