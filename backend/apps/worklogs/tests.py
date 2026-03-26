from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.projects.models import Project
from apps.worklogs.models import WorkLogEntry

User = get_user_model()


class WorkLogMultiHourApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.project = Project.objects.create(code="ENG", name="Engineering", color_hex="#0EA5E9")
        self.second_project = Project.objects.create(code="OPS", name="Operations", color_hex="#0F766E")
        self.third_project = Project.objects.create(code="PLN", name="Planning", color_hex="#F97316")
        self.admin = User.objects.create_user(
            username="admin",
            password="admin123",
            is_staff=True,
            is_superuser=True,
        )
        self.employee = User.objects.create_user(
            username="alex",
            password="demo123",
            first_name="Alex",
            last_name="Meyer",
        )
        self.bulk_create_url = reverse("worklog-bulk-create")
        self.parallel_create_url = reverse("worklog-parallel-create")
        self.work_date = date.today() - timedelta(days=date.today().weekday())

    def grant_parallel_permission(self, user):
        user.user_permissions.add(Permission.objects.get(codename="can_log_parallel_projects"))

    def test_employee_bulk_create_stores_one_multi_hour_entry(self):
        self.client.force_authenticate(user=self.employee)

        response = self.client.post(
            self.bulk_create_url,
            {
                "project": self.project.id,
                "work_date": self.work_date.isoformat(),
                "hour_slots": [9, 10, 11, 12],
                "notes": "Deep work block",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["hour_slot"], 9)
        self.assertEqual(response.data["duration_minutes"], 240)

        entries = list(WorkLogEntry.objects.filter(user=self.employee, work_date=self.work_date))
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].hour_slot, 9)
        self.assertEqual(entries[0].duration_minutes, 240)
        self.assertEqual(entries[0].notes, "Deep work block")

    def test_bulk_create_rejects_overlap_with_existing_multi_hour_entry(self):
        WorkLogEntry.objects.create(
            user=self.employee,
            project=self.project,
            work_date=self.work_date,
            hour_slot=10,
            duration_minutes=120,
            notes="Existing",
        )
        self.client.force_authenticate(user=self.employee)

        response = self.client.post(
            self.bulk_create_url,
            {
                "project": self.project.id,
                "work_date": self.work_date.isoformat(),
                "hour_slots": [9, 10, 11],
                "notes": "Overlap should fail",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("hour_slots", response.data)

    def test_parallel_create_requires_specific_permission(self):
        self.client.force_authenticate(user=self.employee)

        response = self.client.post(
            self.parallel_create_url,
            {
                "work_date": self.work_date.isoformat(),
                "hour_slot": 9,
                "entries": [
                    {
                        "project": self.project.id,
                        "duration_minutes": 240,
                        "notes": "Primary project",
                    },
                    {
                        "project": self.second_project.id,
                        "duration_minutes": 120,
                        "notes": "Secondary project",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("entries", response.data)

    def test_parallel_create_creates_multiple_overlapping_entries_for_permitted_user(self):
        self.grant_parallel_permission(self.employee)
        self.client.force_authenticate(user=self.employee)

        response = self.client.post(
            self.parallel_create_url,
            {
                "work_date": self.work_date.isoformat(),
                "hour_slot": 9,
                "entries": [
                    {
                        "project": self.project.id,
                        "duration_minutes": 240,
                        "notes": "Primary client work",
                    },
                    {
                        "project": self.second_project.id,
                        "duration_minutes": 120,
                        "notes": "Ops follow-up",
                    },
                    {
                        "project": self.third_project.id,
                        "duration_minutes": 60,
                        "notes": "Planning sync",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 3)

        entries = list(
            WorkLogEntry.objects.filter(user=self.employee, work_date=self.work_date).order_by("project__code")
        )
        self.assertEqual(len(entries), 3)
        self.assertEqual([entry.hour_slot for entry in entries], [9, 9, 9])
        self.assertEqual([entry.duration_minutes for entry in entries], [240, 120, 60])

    def test_parallel_create_rejects_duplicate_projects(self):
        self.grant_parallel_permission(self.employee)
        self.client.force_authenticate(user=self.employee)

        response = self.client.post(
            self.parallel_create_url,
            {
                "work_date": self.work_date.isoformat(),
                "hour_slot": 9,
                "entries": [
                    {
                        "project": self.project.id,
                        "duration_minutes": 240,
                        "notes": "Primary",
                    },
                    {
                        "project": self.project.id,
                        "duration_minutes": 120,
                        "notes": "Duplicate",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("entries", response.data)

    def test_admin_can_create_for_other_user_but_not_for_self(self):
        self.client.force_authenticate(user=self.admin)

        other_user_response = self.client.post(
            self.bulk_create_url,
            {
                "user": self.employee.id,
                "project": self.project.id,
                "work_date": self.work_date.isoformat(),
                "hour_slots": [13, 14],
                "notes": "Admin-assisted entry",
            },
            format="json",
        )

        self.assertEqual(other_user_response.status_code, 201)
        self.assertEqual(
            WorkLogEntry.objects.filter(
                user=self.employee,
                work_date=self.work_date,
                hour_slot=13,
            ).count(),
            1,
        )
        self.assertEqual(other_user_response.data["duration_minutes"], 120)

        self_response = self.client.post(
            self.bulk_create_url,
            {
                "user": self.admin.id,
                "project": self.project.id,
                "work_date": self.work_date.isoformat(),
                "hour_slots": [15, 16],
                "notes": "Should fail",
            },
            format="json",
        )

        self.assertEqual(self_response.status_code, 400)
        self.assertEqual(
            self_response.data["user"][0],
            "Admins cannot create or edit work logs for themselves.",
        )

    def test_admin_can_parallel_create_for_permitted_user(self):
        self.grant_parallel_permission(self.employee)
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.parallel_create_url,
            {
                "user": self.employee.id,
                "work_date": self.work_date.isoformat(),
                "hour_slot": 13,
                "entries": [
                    {
                        "project": self.project.id,
                        "duration_minutes": 180,
                        "notes": "Client A",
                    },
                    {
                        "project": self.second_project.id,
                        "duration_minutes": 60,
                        "notes": "Client B",
                    },
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            WorkLogEntry.objects.filter(user=self.employee, work_date=self.work_date, hour_slot=13).count(),
            2,
        )

    def test_user_can_resize_existing_entry_later(self):
        entry = WorkLogEntry.objects.create(
            user=self.employee,
            project=self.project,
            work_date=self.work_date,
            hour_slot=9,
            duration_minutes=120,
            notes="Initial block",
        )
        self.client.force_authenticate(user=self.employee)

        response = self.client.patch(
            reverse("worklog-detail", args=[entry.id]),
            {
                "duration_minutes": 240,
                "notes": "Expanded block",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        entry.refresh_from_db()
        self.assertEqual(entry.duration_minutes, 240)
        self.assertEqual(entry.notes, "Expanded block")

    def test_resize_rejects_overlap_with_another_entry(self):
        entry = WorkLogEntry.objects.create(
            user=self.employee,
            project=self.project,
            work_date=self.work_date,
            hour_slot=9,
            duration_minutes=120,
            notes="Initial block",
        )
        WorkLogEntry.objects.create(
            user=self.employee,
            project=self.project,
            work_date=self.work_date,
            hour_slot=12,
            duration_minutes=60,
            notes="Conflicting block",
        )
        self.client.force_authenticate(user=self.employee)

        response = self.client.patch(
            reverse("worklog-detail", args=[entry.id]),
            {
                "duration_minutes": 240,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("hour_slot", response.data)
