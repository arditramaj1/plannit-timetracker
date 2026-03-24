from django.contrib import admin

from .models import WorkLogEntry


@admin.register(WorkLogEntry)
class WorkLogEntryAdmin(admin.ModelAdmin):
    list_display = ("work_date", "hour_slot", "user", "project", "updated_at")
    list_filter = ("work_date", "project", "user")
    search_fields = ("user__username", "user__first_name", "user__last_name", "project__name", "notes")
    autocomplete_fields = ("user", "project")
    ordering = ("-work_date", "hour_slot")

