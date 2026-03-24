from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import IsAdminRole
from apps.worklogs.models import WorkLogEntry

from .serializers import ReportFilterSerializer
from .services import build_report_payload, export_report_csv


class AdminReportView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        serializer = ReportFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        filters = serializer.validated_data

        queryset = WorkLogEntry.objects.select_related("user", "project").filter(
            work_date__gte=filters["date_from"],
            work_date__lte=filters["date_to"],
        )
        if filters.get("user"):
            queryset = queryset.filter(user_id=filters["user"])
        if filters.get("project"):
            queryset = queryset.filter(project_id=filters["project"])
        queryset = queryset.order_by("work_date", "hour_slot", "user__username")

        payload = build_report_payload(queryset, filters)
        if filters["export"] == "csv":
            return export_report_csv(payload)
        return Response(payload)

