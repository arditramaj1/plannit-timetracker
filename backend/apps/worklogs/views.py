from rest_framework.permissions import IsAuthenticated
from rest_framework.viewsets import ModelViewSet

from apps.common.permissions import IsOwnerOrAdmin

from .filters import WorkLogEntryFilter
from .models import WorkLogEntry
from .serializers import WorkLogEntrySerializer


class WorkLogEntryViewSet(ModelViewSet):
    serializer_class = WorkLogEntrySerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    filterset_class = WorkLogEntryFilter
    search_fields = ("notes", "project__name", "user__username", "user__first_name", "user__last_name")
    ordering_fields = ("work_date", "hour_slot", "created_at", "updated_at")

    def get_queryset(self):
        queryset = WorkLogEntry.objects.select_related("project", "user").all()
        if self.request.user.is_staff or self.request.user.is_superuser:
            return queryset
        return queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        if self.request.user.is_staff or self.request.user.is_superuser:
            serializer.save()
        else:
            serializer.save(user=self.request.user)

