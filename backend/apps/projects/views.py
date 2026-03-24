from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.common.permissions import IsAdminOrReadOnly

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ("name", "code", "description")
    ordering_fields = ("name", "code", "created_at", "updated_at")
    filterset_fields = ("is_active",)

    def get_queryset(self):
        queryset = Project.objects.all().order_by("name")
        if self.request.user.is_staff or self.request.user.is_superuser:
            return queryset
        return queryset.filter(is_active=True)

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [IsAuthenticated()]
        return super().get_permissions()

