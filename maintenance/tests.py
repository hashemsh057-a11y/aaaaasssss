from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import CompanyProfile, EngineerProfile, MaintenanceRequest, MaintenanceSpecialty, PublicContactInquiry, User


class MaintenanceAPITestCase(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            role=User.Role.ADMIN,
            is_staff=True,
        )
        self.quality_user = User.objects.create_user(
            username="quality",
            email="quality@example.com",
            role=User.Role.QUALITY_CONTROLLER,
        )
        self.company_user = User.objects.create_user(
            username="client",
            email="client@example.com",
            role=User.Role.CLIENT_COMPANY,
        )
        self.other_company_user = User.objects.create_user(
            username="other-client",
            email="other-client@example.com",
            role=User.Role.CLIENT_COMPANY,
        )
        self.engineer_user = User.objects.create_user(
            username="engineer",
            email="engineer@example.com",
            role=User.Role.ENGINEER,
            first_name="Sara",
            last_name="Naser",
        )
        self.network_engineer_user = User.objects.create_user(
            username="network-engineer",
            email="network-engineer@example.com",
            role=User.Role.ENGINEER,
        )

        self.company = CompanyProfile.objects.create(
            user=self.company_user,
            company_name="Al Hadhra Medical",
            commercial_register="CR-100",
            contact_phone="+218 91 000 0000",
            address="Tripoli",
        )
        self.other_company = CompanyProfile.objects.create(
            user=self.other_company_user,
            company_name="Other Company",
            commercial_register="CR-200",
            contact_phone="+218 91 111 1111",
            address="Benghazi",
        )
        self.engineer = EngineerProfile.objects.create(
            user=self.engineer_user,
            employee_id="ENG-001",
            department="Operations",
            specialty=MaintenanceSpecialty.ELECTRICITY,
            phone="+218 91 222 2222",
            experience_years=7,
        )
        self.network_engineer = EngineerProfile.objects.create(
            user=self.network_engineer_user,
            employee_id="ENG-002",
            department="Networks",
            specialty=MaintenanceSpecialty.NETWORKS,
            phone="+218 91 333 3333",
            experience_years=5,
        )

    def request_payload(self):
        return {
            "issue_type": MaintenanceSpecialty.ELECTRICITY,
            "priority": MaintenanceRequest.Priority.HIGH,
            "location_details": "Main building, generator room",
            "description": "Power fluctuation in backup generator panel.",
            "preferred_date": (timezone.now() + timedelta(days=1)).isoformat(),
            "is_hazardous": True,
        }

    def create_request(self, **overrides):
        data = self.request_payload()
        data.update(overrides)
        return MaintenanceRequest.objects.create(client_company=self.company, **data)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)


class MaintenanceRequestPermissionTests(MaintenanceAPITestCase):
    def test_company_creates_request_for_own_profile_without_spoofing_company_id(self):
        self.authenticate(self.company_user)
        payload = self.request_payload()
        payload["client_company"] = self.other_company.id

        response = self.client.post(reverse("maintenance-request-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = MaintenanceRequest.objects.get(id=response.data["id"])
        self.assertEqual(created.client_company, self.company)
        self.assertEqual(created.status, MaintenanceRequest.Status.NEW)

    def test_company_only_sees_own_requests(self):
        own_request = self.create_request()
        MaintenanceRequest.objects.create(
            client_company=self.other_company,
            issue_type=MaintenanceSpecialty.NETWORKS,
            priority=MaintenanceRequest.Priority.MEDIUM,
            location_details="Remote office",
            description="Network outage",
            preferred_date=timezone.now() + timedelta(days=2),
        )
        self.authenticate(self.company_user)

        response = self.client.get(reverse("maintenance-request-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = {item["id"] for item in response.data}
        self.assertEqual(returned_ids, {own_request.id})


class WorkflowTransitionTests(MaintenanceAPITestCase):
    def test_illegal_direct_close_returns_bad_request(self):
        maintenance_request = self.create_request()
        self.authenticate(self.quality_user)

        response = self.client.patch(
            reverse("maintenance-request-detail", args=[maintenance_request.id]),
            {"status": MaintenanceRequest.Status.CLOSED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        maintenance_request.refresh_from_db()
        self.assertEqual(maintenance_request.status, MaintenanceRequest.Status.NEW)

    def test_quality_controller_assigns_and_engineer_can_start_or_wait_only(self):
        maintenance_request = self.create_request()
        self.authenticate(self.quality_user)

        review_response = self.client.patch(
            reverse("maintenance-request-detail", args=[maintenance_request.id]),
            {"status": MaintenanceRequest.Status.UNDER_REVIEW},
            format="json",
        )
        assign_response = self.client.patch(
            reverse("maintenance-request-detail", args=[maintenance_request.id]),
            {"status": MaintenanceRequest.Status.ASSIGNED, "assigned_engineer": self.engineer.id},
            format="json",
        )

        self.assertEqual(review_response.status_code, status.HTTP_200_OK)
        self.assertEqual(assign_response.status_code, status.HTTP_200_OK)

        self.authenticate(self.engineer_user)
        start_response = self.client.patch(
            reverse("maintenance-request-detail", args=[maintenance_request.id]),
            {"status": MaintenanceRequest.Status.IN_PROGRESS},
            format="json",
        )
        complete_response = self.client.patch(
            reverse("maintenance-request-detail", args=[maintenance_request.id]),
            {"status": MaintenanceRequest.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(start_response.status_code, status.HTTP_200_OK)
        self.assertEqual(complete_response.status_code, status.HTTP_400_BAD_REQUEST)
        maintenance_request.refresh_from_db()
        self.assertEqual(maintenance_request.status, MaintenanceRequest.Status.IN_PROGRESS)
        self.assertIsNotNone(maintenance_request.in_progress_at)

    def test_assigning_engineer_with_wrong_specialty_is_rejected(self):
        maintenance_request = self.create_request(status=MaintenanceRequest.Status.UNDER_REVIEW)
        self.authenticate(self.quality_user)

        response = self.client.patch(
            reverse("maintenance-request-detail", args=[maintenance_request.id]),
            {"status": MaintenanceRequest.Status.ASSIGNED, "assigned_engineer": self.network_engineer.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        maintenance_request.refresh_from_db()
        self.assertIsNone(maintenance_request.assigned_engineer)
        self.assertEqual(maintenance_request.status, MaintenanceRequest.Status.UNDER_REVIEW)


class DashboardStatisticsTests(MaintenanceAPITestCase):
    def test_dashboard_statistics_use_real_aggregations(self):
        completed_request = self.create_request(
            status=MaintenanceRequest.Status.COMPLETED,
            assigned_engineer=self.engineer,
            assigned_at=timezone.now() - timedelta(hours=5),
            in_progress_at=timezone.now() - timedelta(hours=4, minutes=30),
            completed_at=timezone.now() - timedelta(hours=1),
        )
        completed_request.created_at = timezone.now() - timedelta(hours=6)
        completed_request.save(update_fields=["created_at"])
        MaintenanceRequest.objects.create(
            client_company=self.company,
            issue_type=MaintenanceSpecialty.ELECTRICITY,
            priority=MaintenanceRequest.Priority.LOW,
            location_details="Warehouse",
            description="Lighting issue",
            preferred_date=timezone.now() + timedelta(days=1),
            status=MaintenanceRequest.Status.NEW,
        )
        self.authenticate(self.quality_user)

        response = self.client.get(reverse("dashboard-statistics"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_open_requests"], 1)
        self.assertEqual(response.data["completion_rate"], 50.0)
        self.assertEqual(response.data["top_recurring_maintenance_issues"][0]["issue_type"], MaintenanceSpecialty.ELECTRICITY)
        self.assertEqual(response.data["fastest_responding_engineer"]["engineer_id"], self.engineer.id)
        self.assertGreater(response.data["average_resolution_seconds"], 0)
        self.assertEqual(completed_request.status, MaintenanceRequest.Status.COMPLETED)


class PublicEndpointTests(MaintenanceAPITestCase):
    def test_public_impact_statistics_do_not_require_authentication(self):
        self.create_request()

        response = self.client.get(reverse("public-impact-statistics"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("total_open_requests", response.data)
        self.assertIn("completion_rate", response.data)

    def test_public_tracking_returns_limited_ticket_data(self):
        maintenance_request = self.create_request()

        response = self.client.get(reverse("public-request-tracking", args=[maintenance_request.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], maintenance_request.id)
        self.assertEqual(response.data["status"], MaintenanceRequest.Status.NEW)
        self.assertNotIn("description", response.data)
        self.assertNotIn("location_details", response.data)

    def test_public_contact_inquiry_is_persisted_without_authentication(self):
        payload = {
            "contact_name": "Hashim Nabih",
            "company_name": "Maintenance Partner Co",
            "email": "contact@example.com",
            "phone": "+218 91 444 4444",
            "message": "We want to contract the smart maintenance platform.",
        }

        response = self.client.post(reverse("public-contact-inquiry"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PublicContactInquiry.objects.filter(email="contact@example.com").exists())
