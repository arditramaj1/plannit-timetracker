import django_filters

from .models import WorkLogEntry


class WorkLogEntryFilter(django_filters.FilterSet):
    date_from = django_filters.DateFilter(field_name="work_date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="work_date", lookup_expr="lte")
    user = django_filters.NumberFilter(field_name="user_id")
    project = django_filters.NumberFilter(field_name="project_id")

    class Meta:
        model = WorkLogEntry
        fields = ("user", "project", "date_from", "date_to", "work_date", "hour_slot")

