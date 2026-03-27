import os
from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.projects.colors import get_saturated_pastel_project_colors
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer
from apps.worklogs.models import WorkLogEntry

User = get_user_model()


class SeedDemoDataCommandTests(TestCase):
    def run_seed_command(self, **env_overrides):
        environment = {
            "DJANGO_SUPERUSER_USERNAME": "admin",
            "DJANGO_SUPERUSER_EMAIL": "admin@example.com",
            "DJANGO_SUPERUSER_PASSWORD": "admin123",
            "DJANGO_SEED_REGULAR_USER": "",
            "DJANGO_SEED_SUPERUSER_ONLY": "",
        }
        environment.update(env_overrides)

        with patch.dict(os.environ, environment, clear=False):
            call_command("seed_demo_data")

    def test_default_seed_creates_superuser_demo_user_projects_and_worklogs(self):
        self.run_seed_command()

        admin = User.objects.get(username="admin")
        demo_user = User.objects.get(username="alex")

        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(demo_user.has_perm("worklogs.can_log_parallel_projects"))
        self.assertEqual(Project.objects.count(), 3)
        self.assertEqual(WorkLogEntry.objects.filter(user=demo_user).count(), 6)

    def test_seed_can_skip_regular_user_but_keep_demo_projects(self):
        self.run_seed_command(DJANGO_SEED_REGULAR_USER="0")

        admin = User.objects.get(username="admin")

        self.assertTrue(admin.is_superuser)
        self.assertFalse(User.objects.filter(username="alex").exists())
        self.assertEqual(Project.objects.count(), 3)
        self.assertEqual(WorkLogEntry.objects.count(), 0)

    def test_superuser_only_overrides_regular_user_seeding(self):
        self.run_seed_command(DJANGO_SEED_SUPERUSER_ONLY="1", DJANGO_SEED_REGULAR_USER="1")

        admin = User.objects.get(username="admin")

        self.assertTrue(admin.is_superuser)
        self.assertFalse(User.objects.filter(username="alex").exists())
        self.assertEqual(Project.objects.count(), 0)
        self.assertEqual(WorkLogEntry.objects.count(), 0)


class ProjectSerializerTests(TestCase):
    def test_update_allows_existing_legacy_color(self):
        project = Project.objects.create(
            code="OPS",
            name="Operations",
            color_hex="#0F766E",
        )

        serializer = ProjectSerializer(
            instance=project,
            data={
                "name": "Operations Support",
                "color_hex": "#0F766E",
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_project = serializer.save()

        self.assertEqual(updated_project.name, "Operations Support")
        self.assertEqual(updated_project.color_hex, "#0F766E")

    def test_update_allows_replacing_legacy_color_with_generated_palette_color(self):
        project = Project.objects.create(
            code="PLN",
            name="Product Planning",
            color_hex="#0EA5E9",
        )
        replacement_color = get_saturated_pastel_project_colors()[3]

        serializer = ProjectSerializer(
            instance=project,
            data={"color_hex": replacement_color},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated_project = serializer.save()

        self.assertEqual(updated_project.color_hex, replacement_color)

    def test_update_rejects_non_palette_color_when_color_changes(self):
        project = Project.objects.create(
            code="ENG",
            name="Platform Engineering",
            color_hex="#EA580C",
        )

        serializer = ProjectSerializer(
            instance=project,
            data={"color_hex": "#123456"},
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors["color_hex"][0],
            "Select one of the available pastel project colors.",
        )


class ProjectDeleteApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username="admin",
            password="admin123",
            is_staff=True,
            is_superuser=True,
        )
        self.employee = User.objects.create_user(
            username="alex",
            password="demo123",
        )
        self.client.force_authenticate(user=self.admin)

    def test_delete_project_without_work_logs_returns_no_content(self):
        project = Project.objects.create(
            code="ARC",
            name="Archive Cleanup",
            color_hex=get_saturated_pastel_project_colors()[0],
        )

        response = self.client.delete(reverse("project-detail", args=[project.id]))

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Project.objects.filter(pk=project.id).exists())

    def test_delete_project_with_work_logs_returns_conflict_message(self):
        project = Project.objects.create(
            code="OPS",
            name="Operations",
            color_hex=get_saturated_pastel_project_colors()[1],
        )
        WorkLogEntry.objects.create(
            user=self.employee,
            project=project,
            work_date=date.today(),
            hour_slot=9,
            notes="Existing work log",
        )

        response = self.client.delete(reverse("project-detail", args=[project.id]))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.data["detail"],
            "This project cannot be deleted because it already has work logs. Deactivate it instead.",
        )
        self.assertTrue(Project.objects.filter(pk=project.id).exists())
