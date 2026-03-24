import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("projects", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkLogEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("work_date", models.DateField()),
                (
                    "hour_slot",
                    models.PositiveSmallIntegerField(
                        validators=[django.core.validators.MinValueValidator(0), django.core.validators.MaxValueValidator(23)]
                    ),
                ),
                ("duration_minutes", models.PositiveSmallIntegerField(default=60, editable=False)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="work_logs", to="projects.project"),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="work_logs", to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={"ordering": ("work_date", "hour_slot")},
        ),
        migrations.AddConstraint(
            model_name="worklogentry",
            constraint=models.UniqueConstraint(
                fields=("user", "work_date", "hour_slot"),
                name="unique_worklog_entry_per_user_slot",
            ),
        ),
        migrations.AddConstraint(
            model_name="worklogentry",
            constraint=models.CheckConstraint(
                check=models.Q(hour_slot__gte=0) & models.Q(hour_slot__lte=23),
                name="worklog_hour_slot_range",
            ),
        ),
    ]
