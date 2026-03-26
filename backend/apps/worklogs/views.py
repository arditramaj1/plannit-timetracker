from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.common.permissions import IsOwnerOrAdmin

from .filters import WorkLogEntryFilter
from .models import WorkLogEntry
from .serializers import ParallelWorkLogCreateSerializer, WorkLogBulkCreateSerializer, WorkLogEntrySerializer


class WorkLogEntryViewSet(ModelViewSet):
    serializer_class = WorkLogEntrySerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAdmin]
    filterset_class = WorkLogEntryFilter
    search_fields = ("notes", "project__name", "user__username", "user__first_name", "user__last_name")
    ordering_fields = ("work_date", "hour_slot", "duration_minutes", "created_at", "updated_at")

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

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request, *args, **kwargs):
        serializer = WorkLogBulkCreateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        entry = serializer.save()
        response_serializer = self.get_serializer(entry)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="parallel-create")
    def parallel_create(self, request, *args, **kwargs):
        serializer = ParallelWorkLogCreateSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        entries = serializer.save()
        response_serializer = self.get_serializer(entries, many=True)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
