from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.projects.models import Project

PARALLEL_PROJECT_PERMISSION = "worklogs.can_log_parallel_projects"


def format_hour_range(start_hour: int, end_hour: int) -> str:
    return f"{start_hour:02d}:00 to {end_hour:02d}:00"


def can_user_log_parallel_projects(user) -> bool:
    return bool(user and getattr(user, "is_authenticated", False) and user.has_perm(PARALLEL_PROJECT_PERMISSION))


class WorkLogEntry(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="work_logs")
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="work_logs")
    work_date = models.DateField()
    hour_slot = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(23)])
    duration_minutes = models.PositiveSmallIntegerField(default=60, editable=False)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("work_date", "hour_slot")
        permissions = (
            ("can_log_parallel_projects", "Can log overlapping hours across multiple projects"),
        )
        constraints = [
            models.CheckConstraint(
                check=models.Q(hour_slot__gte=0) & models.Q(hour_slot__lte=23),
                name="worklog_hour_slot_range",
            ),
        ]

    @property
    def duration_hours(self) -> int:
        return max(1, self.duration_minutes // 60)

    @property
    def end_hour_slot(self) -> int:
        return self.hour_slot + self.duration_hours

    def clean(self) -> None:
        if self.project_id:
            previous_project_id = None
            if not self._state.adding and self.pk:
                previous_project_id = (
                    type(self).objects.filter(pk=self.pk).values_list("project_id", flat=True).first()
                )
            is_new_entry = self._state.adding or previous_project_id is None
            is_project_change = previous_project_id is not None and previous_project_id != self.project_id
            if (is_new_entry or is_project_change) and not self.project.is_active:
                raise ValidationError({"project": "Only active projects can be selected for new logs."})

        if self.duration_minutes < 60 or self.duration_minutes % 60 != 0:
            raise ValidationError({"duration_minutes": "Duration must be in whole-hour increments."})

        if self.end_hour_slot > 24:
            raise ValidationError({"duration_minutes": "Work logs must end by 24:00."})

        if self.user_id and self.work_date and self.hour_slot is not None:
            overlapping_entries = find_overlapping_entries(
                user=self.user,
                work_date=self.work_date,
                hour_slot=self.hour_slot,
                duration_minutes=self.duration_minutes,
                exclude_id=self.pk,
            )
            errors = build_overlap_validation_errors(
                user=self.user,
                project_id=self.project_id,
                overlapping_entries=overlapping_entries,
            )
            if errors:
                raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (
            f"{self.user} | {self.work_date} @ {self.hour_slot:02d}:00"
            f"-{self.end_hour_slot:02d}:00"
        )


def find_overlapping_entries(
    *,
    user,
    work_date,
    hour_slot: int,
    duration_minutes: int,
    exclude_id: int | None = None,
) -> list[WorkLogEntry]:
    duration_hours = max(1, duration_minutes // 60)
    end_hour_slot = hour_slot + duration_hours
    queryset = WorkLogEntry.objects.filter(user=user, work_date=work_date).order_by("hour_slot")
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)

    overlapping_entries = []
    for entry in queryset:
        if hour_slot < entry.end_hour_slot and entry.hour_slot < end_hour_slot:
            overlapping_entries.append(entry)
    return overlapping_entries


def build_overlap_validation_errors(*, user, project_id: int | None, overlapping_entries: list[WorkLogEntry]):
    if not overlapping_entries:
        return None

    if can_user_log_parallel_projects(user):
        if project_id is not None and any(entry.project_id == project_id for entry in overlapping_entries):
            return {
                "project": "Parallel work logs must use different projects for overlapping time ranges."
            }
        return None

    formatted_ranges = ", ".join(
        format_hour_range(entry.hour_slot, entry.end_hour_slot) for entry in overlapping_entries
    )
    return {"hour_slot": f"This time range overlaps existing work logs: {formatted_ranges}."}
