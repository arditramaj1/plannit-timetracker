from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.projects.models import Project


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
        constraints = [
            models.UniqueConstraint(
                fields=("user", "work_date", "hour_slot"),
                name="unique_worklog_entry_per_user_slot",
            ),
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
            overlapping_entries = (
                type(self)
                .objects.filter(user_id=self.user_id, work_date=self.work_date)
                .exclude(pk=self.pk)
                .order_by("hour_slot")
            )
            for existing_entry in overlapping_entries:
                if self.hour_slot < existing_entry.end_hour_slot and existing_entry.hour_slot < self.end_hour_slot:
                    raise ValidationError(
                        {
                            "hour_slot": (
                                "This time range overlaps an existing work log from "
                                f"{existing_entry.hour_slot:02d}:00 to {existing_entry.end_hour_slot:02d}:00."
                            )
                        }
                    )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (
            f"{self.user} | {self.work_date} @ {self.hour_slot:02d}:00"
            f"-{self.end_hour_slot:02d}:00"
        )
