from __future__ import annotations

import csv
from typing import Any

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.http import HttpResponse


def group_queryset(queryset, group_by: str):
    trunc_fn = {
        "day": TruncDate("work_date"),
        "week": TruncWeek("work_date"),
        "month": TruncMonth("work_date"),
    }[group_by]
    return (
        queryset.annotate(period=trunc_fn)
        .values("period")
        .annotate(total_hours=Count("id"))
        .order_by("period")
    )


def build_report_payload(queryset, filters: dict[str, Any]) -> dict[str, Any]:
    total_minutes = queryset.aggregate(total_minutes=Sum("duration_minutes"))["total_minutes"] or 0
    total_hours = round(total_minutes / 60, 2)

    by_user = (
        queryset.values("user_id", "user__username", "user__first_name", "user__last_name")
        .annotate(total_hours=Count("id"))
        .order_by("-total_hours", "user__username")
    )
    by_project = (
        queryset.values("project_id", "project__code", "project__name", "project__color_hex")
        .annotate(total_hours=Count("id"))
        .order_by("-total_hours", "project__name")
    )
    timeline = group_queryset(queryset, filters["group_by"])

    details = [
        {
            "id": entry.id,
            "user": {
                "id": entry.user_id,
                "username": entry.user.username,
                "display_name": f"{entry.user.first_name} {entry.user.last_name}".strip() or entry.user.username,
            },
            "project": {
                "id": entry.project_id,
                "code": entry.project.code,
                "name": entry.project.name,
                "color_hex": entry.project.color_hex,
            },
            "work_date": entry.work_date,
            "hour_slot": entry.hour_slot,
            "duration_minutes": entry.duration_minutes,
            "notes": entry.notes,
            "created_at": entry.created_at,
            "updated_at": entry.updated_at,
        }
        for entry in queryset
    ]

    return {
        "filters": {
            "user": filters.get("user"),
            "project": filters.get("project"),
            "date_from": filters["date_from"],
            "date_to": filters["date_to"],
            "period": filters["period"],
            "group_by": filters["group_by"],
        },
        "summary": {
            "total_hours": total_hours,
            "total_entries": queryset.count(),
            "unique_users": queryset.values("user_id").distinct().count(),
            "unique_projects": queryset.values("project_id").distinct().count(),
            "by_user": list(by_user),
            "by_project": list(by_project),
            "timeline": list(timeline),
        },
        "details": details,
    }


def export_report_csv(payload: dict[str, Any]) -> HttpResponse:
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="worklog-report.csv"'
    writer = csv.writer(response)
    writer.writerow(["User", "Project", "Date", "Hour Slot", "Duration (minutes)", "Notes"])
    for row in payload["details"]:
        writer.writerow(
            [
                row["user"]["display_name"],
                row["project"]["name"],
                row["work_date"],
                f"{row['hour_slot']:02d}:00",
                row["duration_minutes"],
                row["notes"],
            ]
        )
    return response

