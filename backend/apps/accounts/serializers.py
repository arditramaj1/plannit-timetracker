from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()
PARALLEL_PROJECT_PERMISSION = "worklogs.can_log_parallel_projects"


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    can_log_parallel_projects = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "can_log_parallel_projects",
            "is_staff",
            "is_superuser",
            "last_login",
            "date_joined",
        )

    def get_role(self, obj) -> str:
        return "admin" if obj.is_staff or obj.is_superuser else "user"

    def get_display_name(self, obj) -> str:
        full_name = f"{obj.first_name} {obj.last_name}".strip()
        return full_name or obj.username

    def get_can_log_parallel_projects(self, obj) -> bool:
        return obj.has_perm(PARALLEL_PROJECT_PERMISSION)


class CompactUserSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        fields = (
            "id",
            "username",
            "email",
            "display_name",
            "role",
            "can_log_parallel_projects",
            "is_staff",
            "is_superuser",
        )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        return super().get_token(user)

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = CompactUserSerializer(self.user).data
        return data
