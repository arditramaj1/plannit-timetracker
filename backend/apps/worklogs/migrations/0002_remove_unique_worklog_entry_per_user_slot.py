from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("worklogs", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="worklogentry",
            options={
                "ordering": ("work_date", "hour_slot"),
                "permissions": (
                    ("can_log_parallel_projects", "Can log overlapping hours across multiple projects"),
                ),
            },
        ),
        migrations.RemoveConstraint(
            model_name="worklogentry",
            name="unique_worklog_entry_per_user_slot",
        ),
    ]
