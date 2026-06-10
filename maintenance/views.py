import secrets

from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers as drf_serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompanyProfile, EngineerProfile, MaintenanceRequest, PublicEngineer, User
from .notifications import queue_assignment_notification
from .permissions import (
    CompanyProfilePermission,
    EngineerProfilePermission,
    MaintenanceRequestPermission,
    RequestEvidencePermission,
    UserViewSetPermission,
    scoped_maintenance_requests_for_user,
    scoped_request_evidences_for_user,
)
from .serializers import (
    CompanyProfileSerializer,
    EngineerProfileSerializer,
    MaintenanceRequestSerializer,
    PublicCompanyListSerializer,
    PublicContactInquirySerializer,
    PublicEngineerCreateSerializer,
    PublicEngineerSerializer,
    PublicMaintenanceRequestCreateSerializer,
    PublicMaintenanceRequestTrackingSerializer,
    RequestEvidenceSerializer,
    UserSerializer,
)
from .services import MaintenanceDashboardService


class UserViewSet(viewsets.ModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [UserViewSetPermission]

    def get_queryset(self):
        queryset = get_user_model().objects.order_by("username")
        if self.request.user.has_workflow_control:
            return queryset
        return queryset.filter(id=self.request.user.id)

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        if request.method == "GET":
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)

        serializer = self.get_serializer(
            request.user,
            data=request.data,
            partial=True,
            context=self.get_serializer_context(),
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(role=request.user.role, is_active=request.user.is_active)
        return Response(serializer.data)


class CompanyProfileViewSet(viewsets.ModelViewSet):
    serializer_class = CompanyProfileSerializer
    permission_classes = [CompanyProfilePermission]

    def get_queryset(self):
        queryset = CompanyProfile.objects.select_related("user")
        if self.request.user.has_workflow_control:
            return queryset
        if self.request.user.role == User.Role.CLIENT_COMPANY:
            return queryset.filter(user=self.request.user)
        return queryset.none()

    def perform_create(self, serializer):
        if self.request.user.role == User.Role.CLIENT_COMPANY:
            serializer.save(user=self.request.user)
        else:
            serializer.save()


class EngineerProfileViewSet(viewsets.ModelViewSet):
    serializer_class = EngineerProfileSerializer
    permission_classes = [EngineerProfilePermission]

    def get_queryset(self):
        queryset = EngineerProfile.objects.select_related("user")
        if self.request.user.has_workflow_control:
            return queryset
        if self.request.user.role == User.Role.ENGINEER:
            return queryset.filter(user=self.request.user)
        return queryset.none()

    def perform_create(self, serializer):
        if self.request.user.role == User.Role.ENGINEER:
            serializer.save(user=self.request.user)
        else:
            serializer.save()


class MaintenanceRequestViewSet(viewsets.ModelViewSet):
    serializer_class = MaintenanceRequestSerializer
    permission_classes = [MaintenanceRequestPermission]

    def get_queryset(self):
        return scoped_maintenance_requests_for_user(self.request.user).prefetch_related("evidences")

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class RequestEvidenceViewSet(viewsets.ModelViewSet):
    serializer_class = RequestEvidenceSerializer
    permission_classes = [RequestEvidencePermission]

    def get_queryset(self):
        return scoped_request_evidences_for_user(self.request.user)

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class DashboardStatisticsAPIView(APIView):
    def get(self, request):
        queryset = scoped_maintenance_requests_for_user(request.user)
        service = MaintenanceDashboardService(queryset=queryset)
        return Response(service.as_dict())


class PublicImpactStatisticsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = MaintenanceRequest.objects.all()
        service = MaintenanceDashboardService(queryset=queryset)
        payload = service.as_dict()
        payload.update(
            {
                "total_requests": queryset.count(),
                "completed_tickets": queryset.filter(
                    status__in=[
                        MaintenanceRequest.Status.COMPLETED,
                        MaintenanceRequest.Status.CLOSED,
                    ]
                ).count(),
            }
        )
        return Response(payload)


class PublicRequestListAPIView(generics.ListAPIView):
    """Read-only public list of maintenance requests for the open dashboard.

    Uses the tracking serializer, which exposes only non-sensitive fields
    (company name, issue type, priority, status, dates) — no contact PII.
    """

    permission_classes = [AllowAny]
    serializer_class = PublicMaintenanceRequestTrackingSerializer
    queryset = MaintenanceRequest.objects.select_related("client_company").all()
    pagination_class = None


class PublicRequestTrackingAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, ticket_number):
        try:
            maintenance_request = MaintenanceRequest.objects.select_related("client_company").get(id=ticket_number)
        except MaintenanceRequest.DoesNotExist:
            return Response({"detail": "Ticket number was not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = PublicMaintenanceRequestTrackingSerializer(maintenance_request)
        return Response(serializer.data)


class PublicMaintenanceRequestCreateAPIView(APIView):
    permission_classes = [AllowAny]
    http_method_names = ["post", "options"]

    def post(self, request):
        serializer = PublicMaintenanceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        maintenance_request = serializer.save()
        response_serializer = PublicMaintenanceRequestTrackingSerializer(maintenance_request)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PublicCompanyListAPIView(generics.ListAPIView):
    """Open read-only list of registered companies for /dashboard."""

    permission_classes = [AllowAny]
    serializer_class = PublicCompanyListSerializer
    queryset = CompanyProfile.objects.select_related("user").all()
    pagination_class = None


class PublicEngineerListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [AllowAny]
    queryset = PublicEngineer.objects.all()
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PublicEngineerCreateSerializer
        return PublicEngineerSerializer


class PublicCapabilitiesAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "engineer_profile_version": 3,
                "engineer_avatar_webp": True,
                "engineer_availability": True,
                "engineer_device_identity": True,
                "engineer_profile_editing": True,
            }
        )


class PublicEngineerDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicEngineerSerializer
    queryset = PublicEngineer.objects.all()

    def perform_destroy(self, instance):
        avatar_name = instance.avatar.name if instance.avatar else None
        avatar_storage = instance.avatar.storage if instance.avatar else None
        super().perform_destroy(instance)
        if avatar_name and avatar_storage:
            avatar_storage.delete(avatar_name)


class PublicEngineerDeviceSessionAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        device_id = request.data.get("device_id")
        if not device_id:
            raise drf_serializers.ValidationError({"device_id": "Required."})
        engineer = get_object_or_404(
            PublicEngineer,
            device_id_hash=PublicEngineer.hash_device_id(device_id),
        )
        engineer.device_last_seen_at = timezone.now()
        engineer.save(update_fields=["device_last_seen_at"])
        return Response(
            PublicEngineerCreateSerializer(engineer, context={"request": request}).data
        )


class PublicEngineerAvailabilityAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, pk):
        engineer = get_object_or_404(PublicEngineer, pk=pk)
        raw_token = request.data.get("availability_token")
        if not raw_token or not secrets.compare_digest(str(engineer.availability_token), str(raw_token)):
            return Response(
                {"detail": "Invalid engineer management token."},
                status=status.HTTP_403_FORBIDDEN,
            )
        availability = drf_serializers.BooleanField().run_validation(
            request.data.get("is_available")
        )
        engineer.is_available = availability
        engineer.save(update_fields=["is_available"])
        return Response(PublicEngineerSerializer(engineer, context={"request": request}).data)


class PublicAdminRequestTransitionAPIView(APIView):
    """Open admin endpoint to transition a maintenance request's status.

    The dashboard is intentionally login-less per the platform's design, so
    this endpoint mirrors that — it accepts a transition without auth and
    enforces only the workflow rules (legal status transitions, specialty
    match for assigned engineers).
    """

    permission_classes = [AllowAny]

    TIMESTAMP_FIELD_BY_STATUS = {
        MaintenanceRequest.Status.UNDER_REVIEW: None,
        MaintenanceRequest.Status.ASSIGNED: "assigned_at",
        MaintenanceRequest.Status.IN_PROGRESS: "in_progress_at",
        MaintenanceRequest.Status.WAITING_SPARE_PARTS: "waiting_spare_parts_at",
        MaintenanceRequest.Status.COMPLETED: "completed_at",
        MaintenanceRequest.Status.CLOSED: "closed_at",
        MaintenanceRequest.Status.REJECTED: "rejected_at",
    }

    def post(self, request, request_id):
        maintenance_request = get_object_or_404(MaintenanceRequest, pk=request_id)
        previous_status = maintenance_request.status
        previous_public_engineer_id = maintenance_request.assigned_public_engineer_id
        target_status = request.data.get("status")
        if not target_status:
            raise drf_serializers.ValidationError({"status": "Required."})
        if target_status not in dict(MaintenanceRequest.Status.choices):
            raise drf_serializers.ValidationError({"status": "Unknown status."})

        # Validate the transition against the workflow map (skip the actor
        # role check that the model-level validate_transition enforces).
        if target_status != maintenance_request.status and not maintenance_request.can_transition_to(
            target_status
        ):
            raise drf_serializers.ValidationError(
                {
                    "status": f"Illegal workflow transition from {maintenance_request.status} to {target_status}."
                }
            )

        assigned_public_engineer_id = request.data.get("assigned_public_engineer_id")
        if assigned_public_engineer_id:
            try:
                public_engineer = PublicEngineer.objects.get(pk=assigned_public_engineer_id)
            except PublicEngineer.DoesNotExist:
                raise drf_serializers.ValidationError(
                    {"assigned_public_engineer_id": "Engineer not found."}
                )
            if public_engineer.specialty != maintenance_request.issue_type:
                raise drf_serializers.ValidationError(
                    {
                        "assigned_public_engineer_id": "Engineer specialty must match the request issue type."
                    }
                )
            if not public_engineer.is_available:
                raise drf_serializers.ValidationError(
                    {"assigned_public_engineer_id": "Engineer is currently unavailable."}
                )
            maintenance_request.assigned_public_engineer = public_engineer

        # Require an assigned engineer (either kind) before moving past UNDER_REVIEW.
        if target_status in {
            MaintenanceRequest.Status.ASSIGNED,
            MaintenanceRequest.Status.IN_PROGRESS,
            MaintenanceRequest.Status.WAITING_SPARE_PARTS,
        } and not (
            maintenance_request.assigned_engineer_id
            or maintenance_request.assigned_public_engineer_id
        ):
            raise drf_serializers.ValidationError(
                {"assigned_public_engineer_id": "An assigned engineer is required for this status."}
            )

        now = timezone.now()
        timestamp_field = self.TIMESTAMP_FIELD_BY_STATUS.get(target_status)
        if timestamp_field and getattr(maintenance_request, timestamp_field) is None:
            setattr(maintenance_request, timestamp_field, now)

        maintenance_request.status = target_status
        try:
            maintenance_request.full_clean()
        except DjangoValidationError as exc:
            raise drf_serializers.ValidationError(
                exc.message_dict if hasattr(exc, "message_dict") else exc.messages
            )
        with transaction.atomic():
            maintenance_request.save()
            assignment_changed = (
                target_status == MaintenanceRequest.Status.ASSIGNED
                and (
                    previous_status != MaintenanceRequest.Status.ASSIGNED
                    or previous_public_engineer_id != maintenance_request.assigned_public_engineer_id
                )
            )
            if assignment_changed:
                queue_assignment_notification(maintenance_request)

        from .serializers import PublicMaintenanceRequestTrackingSerializer

        return Response(PublicMaintenanceRequestTrackingSerializer(maintenance_request).data)


class PublicAdminRequestCostAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, request_id):
        maintenance_request = get_object_or_404(MaintenanceRequest, pk=request_id)
        raw_cost = request.data.get("cost")
        if raw_cost in (None, ""):
            maintenance_request.cost = None
        else:
            try:
                cost = Decimal(str(raw_cost))
            except (InvalidOperation, TypeError, ValueError):
                raise drf_serializers.ValidationError({"cost": "Cost must be a valid number."})
            if cost < 0:
                raise drf_serializers.ValidationError({"cost": "Cost must be zero or greater."})
            maintenance_request.cost = cost

        try:
            maintenance_request.full_clean()
        except DjangoValidationError as exc:
            raise drf_serializers.ValidationError(
                exc.message_dict if hasattr(exc, "message_dict") else exc.messages
            )
        maintenance_request.save(update_fields=["cost", "updated_at"])
        return Response(PublicMaintenanceRequestTrackingSerializer(maintenance_request).data)


class PublicReportView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, kind):
        from .reports.data import REPORT_KINDS, build_report
        from .reports.excel import render_excel
        from .reports.pdf import render_pdf

        if kind not in REPORT_KINDS:
            return Response({"detail": "Unknown report kind."}, status=status.HTTP_404_NOT_FOUND)

        file_format = request.query_params.get("file_format", "pdf").lower()
        if file_format not in {"pdf", "xlsx"}:
            return Response(
                {"detail": "Format must be pdf or xlsx."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            year = int(request.query_params["year"]) if request.query_params.get("year") else None
            month = int(request.query_params["month"]) if request.query_params.get("month") else None
            company_id = (
                int(request.query_params["company_id"])
                if request.query_params.get("company_id")
                else None
            )
        except ValueError:
            return Response(
                {"detail": "year, month, and company_id must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if month is not None and not 1 <= month <= 12:
            return Response({"detail": "month must be between 1 and 12."}, status=status.HTTP_400_BAD_REQUEST)
        if year is not None and not 2000 <= year <= 2100:
            return Response({"detail": "year must be between 2000 and 2100."}, status=status.HTTP_400_BAD_REQUEST)

        report = build_report(kind, year=year, month=month, company_id=company_id)
        return render_excel(report) if file_format == "xlsx" else render_pdf(report)


class PublicContactInquiryAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicContactInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
