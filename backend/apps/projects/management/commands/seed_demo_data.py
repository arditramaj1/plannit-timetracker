import os
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.projects.models import Project
from apps.worklogs.models import WorkLogEntry

User = get_user_model()


class Command(BaseCommand):
    help = "Seed an admin user, a demo user, projects, and sample work logs."

    def handle(self, *args, **options):
        admin_username = os.getenv("DJANGO_SUPERUSER_USERNAME", "admin")
        admin_email = os.getenv("DJANGO_SUPERUSER_EMAIL", "admin@example.com")
        admin_password = os.getenv("DJANGO_SUPERUSER_PASSWORD", "admin123")

        demo_username = "alex"
        demo_email = "alex@example.com"
        demo_password = "demo123"

        admin, admin_created = User.objects.get_or_create(
            username=admin_username,
            defaults={
                "email": admin_email,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if admin_created:
            admin.set_password(admin_password)
        admin.is_staff = True
        admin.is_superuser = True
        admin.email = admin_email
        admin.save()

        demo_user, demo_created = User.objects.get_or_create(
            username=demo_username,
            defaults={
                "email": demo_email,
                "first_name": "Alex",
                "last_name": "Meyer",
            },
        )
        if demo_created:
            demo_user.set_password(demo_password)
        demo_user.save()

        projects = [
            {"code": "OPS", "name": "Operations", "color_hex": "#0F766E"},
            {"code": "PLN", "name": "Product Planning", "color_hex": "#0EA5E9"},
            {"code": "ENG", "name": "Platform Engineering", "color_hex": "#EA580C"},
        ]

        for project_data in projects:
            Project.objects.update_or_create(code=project_data["code"], defaults=project_data)

        week_start = date.today() - timedelta(days=date.today().weekday())
        demo_entries = [
            (0, 9, "Kickoff planning and roadmap sync", "PLN"),
            (0, 10, "Refined sprint scope with stakeholders", "PLN"),
            (1, 11, "Reviewed deployment checklist and runbooks", "OPS"),
            (2, 14, "Implemented API improvements for reporting", "ENG"),
            (3, 15, "Investigated bug reports and triaged tickets", "ENG"),
            (4, 13, "Prepared status updates for leadership", "OPS"),
        ]

        for day_offset, hour_slot, notes, project_code in demo_entries:
            project = Project.objects.get(code=project_code)
            WorkLogEntry.objects.get_or_create(
                user=demo_user,
                project=project,
                work_date=week_start + timedelta(days=day_offset),
                hour_slot=hour_slot,
                defaults={"notes": notes},
            )

        self.stdout.write(self.style.SUCCESS("Demo data is ready."))
