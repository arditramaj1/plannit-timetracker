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
        if self.duration_minutes != 60:
            raise ValidationError({"duration_minutes": "Time tracking uses fixed 1-hour slots."})

    def save(self, *args, **kwargs):
        self.duration_minutes = 60
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.user} | {self.work_date} @ {self.hour_slot:02d}:00"
