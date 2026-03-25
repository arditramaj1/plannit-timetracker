from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.projects.models import Project
from apps.worklogs.models import WorkLogEntry

User = get_user_model()


class WorkLogBulkCreateApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.project = Project.objects.create(code="ENG", name="Engineering", color_hex="#0EA5E9")
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
        self.work_date = date.today() - timedelta(days=date.today().weekday())

    def test_employee_can_create_multiple_contiguous_entries_with_one_note(self):
        self.client.force_authenticate(user=self.employee)

        response = self.client.post(
            self.bulk_create_url,
            {
                "project": self.project.id,
                "work_date": self.work_date.isoformat(),
                "hour_slots": [9, 10, 11],
                "notes": "Deep work block",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data), 3)

        entries = list(
            WorkLogEntry.objects.filter(user=self.employee, work_date=self.work_date).order_by("hour_slot")
        )
        self.assertEqual([entry.hour_slot for entry in entries], [9, 10, 11])
        self.assertTrue(all(entry.notes == "Deep work block" for entry in entries))
        self.assertTrue(all(entry.duration_minutes == 60 for entry in entries))

    def test_bulk_create_rejects_overlapping_hour_slots(self):
        WorkLogEntry.objects.create(
            user=self.employee,
            project=self.project,
            work_date=self.work_date,
            hour_slot=10,
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
                hour_slot__in=[13, 14],
            ).count(),
            2,
        )

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
