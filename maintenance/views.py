import secrets
import re

from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import exceptions as drf_exceptions
from rest_framework import generics, serializers as drf_serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CompanyProfile,
    EngineerProfile,
    MaintenanceRequest,
    PortalOTPChallenge,
    PublicEngineer,
    RequestActivity,
    User,
)
from .notifications import queue_assignment_notification
from .portal import (
    auto_assign_public_engineer,
    company_from_session,
    create_portal_token,
    engineer_from_session,
    issue_otp,
    normalize_email,
    verify_otp,
)
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
    CompanyPortalRegistrationSerializer,
    CompanyPortalRequestCreateSerializer,
    EngineerPortalActionSerializer,
    PublicContactInquirySerializer,
    PublicEngineerCreateSerializer,
    PublicEngineerSerializer,
    PublicMaintenanceRequestCreateSerializer,
    PublicMaintenanceRequestTrackingSerializer,
    PortalMaintenanceRequestSerializer,
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
    serializer_class = PortalMaintenanceRequestSerializer
    queryset = MaintenanceRequest.objects.select_related(
        "client_company",
        "assigned_public_engineer",
        "assigned_engineer__user",
    ).prefetch_related("activities__public_engineer")
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
        auto_assign_public_engineer(maintenance_request)
        maintenance_request.refresh_from_db()
        response_serializer = PublicMaintenanceRequestTrackingSerializer(maintenance_request)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PublicCompanyListAPIView(generics.ListAPIView):
    """Open read-only list of registered companies for /dashboard."""

    permission_classes = [AllowAny]
    serializer_class = PublicCompanyListSerializer
    queryset = CompanyProfile.objects.select_related("user").filter(is_archived=False)
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


class PublicAdminCompanyDetailAPIView(APIView):
    permission_classes = [AllowAny]

    def delete(self, request, company_id):
        company = get_object_or_404(CompanyProfile.objects.select_related("user"), pk=company_id)
        company.is_archived = True
        company.save(update_fields=["is_archived"])
        company.user.is_active = False
        company.user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


def _portal_code_response(challenge, code):
    payload = {
        "challenge_id": challenge.pk,
        "expires_in_seconds": settings.PORTAL_OTP_TTL_MINUTES * 60,
    }
    if settings.PORTAL_OTP_EXPOSE_CODE:
        payload["debug_code"] = code
    return payload


def _unique_company_username(email):
    local_part = email.split("@", 1)[0].lower()
    base = re.sub(r"[^a-z0-9_.-]+", "-", local_part).strip("-_.") or "company"
    base = f"portal-{base}"[:138].rstrip("-_.")
    candidate = base
    counter = 1
    UserModel = get_user_model()
    while UserModel.objects.filter(username=candidate).exists():
        suffix = f"-{counter}"
        candidate = f"{base[:150 - len(suffix)]}{suffix}"
        counter += 1
    return candidate


class CompanyPortalRequestCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        purpose = str(request.data.get("purpose", "LOGIN")).upper()
        email = normalize_email(request.data.get("email"))
        if purpose not in PortalOTPChallenge.Purpose.values:
            raise drf_serializers.ValidationError({"purpose": "Use LOGIN or REGISTER."})
        payload = {}
        if purpose == PortalOTPChallenge.Purpose.REGISTER:
            serializer = CompanyPortalRegistrationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            payload = serializer.validated_data
            email = normalize_email(payload["email"])
            existing = CompanyProfile.objects.filter(user__email__iexact=email, is_archived=False).exists()
            if existing:
                raise drf_serializers.ValidationError(
                    {"email": "A company account already exists. Use sign in."}
                )
        else:
            company = CompanyProfile.objects.filter(
                user__email__iexact=email,
                user__is_active=True,
                is_archived=False,
            ).first()
            if not company:
                raise drf_serializers.ValidationError({"email": "Company account was not found."})

        try:
            challenge, code = issue_otp(
                email,
                PortalOTPChallenge.Role.COMPANY,
                purpose,
                payload,
            )
        except Exception as exc:
            if isinstance(exc, drf_exceptions.APIException):
                raise
            return Response(
                {"detail": "Verification email could not be sent."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(_portal_code_response(challenge, code), status=status.HTTP_201_CREATED)


class CompanyPortalVerifyAPIView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        challenge = verify_otp(
            request.data.get("challenge_id"),
            request.data.get("code"),
            PortalOTPChallenge.Role.COMPANY,
        )
        if challenge.purpose == PortalOTPChallenge.Purpose.REGISTER:
            data = challenge.payload
            UserModel = get_user_model()
            user = UserModel.objects.filter(email__iexact=challenge.email).first()
            if user and user.role != User.Role.CLIENT_COMPANY:
                raise drf_serializers.ValidationError(
                    {"email": "This email belongs to another account type."}
                )
            if user is None:
                user = UserModel(
                    username=_unique_company_username(challenge.email),
                    email=challenge.email,
                    role=User.Role.CLIENT_COMPANY,
                    first_name=data["contact_name"],
                    is_active=True,
                )
                user.set_unusable_password()
                user.full_clean()
                user.save()
            else:
                user.first_name = data["contact_name"]
                user.is_active = True
                user.save(update_fields=["first_name", "is_active"])
            company, _ = CompanyProfile.objects.update_or_create(
                user=user,
                defaults={
                    "company_name": data["company_name"],
                    "commercial_register": data["commercial_register"],
                    "contact_phone": data["phone"],
                    "address": data["address"],
                    "is_archived": False,
                },
            )
        else:
            company = get_object_or_404(
                CompanyProfile.objects.select_related("user"),
                user__email__iexact=challenge.email,
                user__is_active=True,
                is_archived=False,
            )
        token = create_portal_token(
            PortalOTPChallenge.Role.COMPANY,
            company.pk,
            challenge.email,
        )
        return Response(
            {
                "token": token,
                "profile": PublicCompanyListSerializer(company).data,
            }
        )


class CompanyPortalDashboardAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        company = company_from_session(request)
        requests = MaintenanceRequest.objects.filter(client_company=company).select_related(
            "assigned_public_engineer",
            "assigned_engineer__user",
        ).prefetch_related("activities__public_engineer")
        return Response(
            {
                "profile": PublicCompanyListSerializer(company).data,
                "requests": PortalMaintenanceRequestSerializer(requests, many=True).data,
            }
        )


class CompanyPortalRequestCreateAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        company = company_from_session(request)
        serializer = CompanyPortalRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        maintenance_request = serializer.save(
            client_company=company,
            status=MaintenanceRequest.Status.NEW,
        )
        auto_assign_public_engineer(maintenance_request)
        maintenance_request.refresh_from_db()
        return Response(
            PortalMaintenanceRequestSerializer(maintenance_request).data,
            status=status.HTTP_201_CREATED,
        )


class EngineerPortalRequestCodeAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = normalize_email(request.data.get("email"))
        engineer = PublicEngineer.objects.filter(email__iexact=email).first()
        if not engineer:
            raise drf_serializers.ValidationError({"email": "Engineer account was not found."})
        try:
            challenge, code = issue_otp(
                email,
                PortalOTPChallenge.Role.ENGINEER,
                PortalOTPChallenge.Purpose.LOGIN,
            )
        except drf_exceptions.APIException:
            raise
        except Exception:
            return Response(
                {"detail": "Verification email could not be sent."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(_portal_code_response(challenge, code), status=status.HTTP_201_CREATED)


class EngineerPortalVerifyAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        challenge = verify_otp(
            request.data.get("challenge_id"),
            request.data.get("code"),
            PortalOTPChallenge.Role.ENGINEER,
        )
        engineer = get_object_or_404(PublicEngineer, email__iexact=challenge.email)
        token = create_portal_token(
            PortalOTPChallenge.Role.ENGINEER,
            engineer.pk,
            challenge.email,
        )
        return Response(
            {
                "token": token,
                "profile": PublicEngineerSerializer(engineer, context={"request": request}).data,
            }
        )


class EngineerPortalDashboardAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        engineer = engineer_from_session(request)
        requests = MaintenanceRequest.objects.filter(
            assigned_public_engineer=engineer
        ).select_related("client_company").prefetch_related("activities__public_engineer")
        return Response(
            {
                "profile": PublicEngineerSerializer(engineer, context={"request": request}).data,
                "requests": PortalMaintenanceRequestSerializer(requests, many=True).data,
            }
        )


class EngineerPortalAvailabilityAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        engineer = engineer_from_session(request)
        engineer.is_available = drf_serializers.BooleanField().run_validation(
            request.data.get("is_available")
        )
        engineer.save(update_fields=["is_available"])
        return Response(PublicEngineerSerializer(engineer, context={"request": request}).data)


class EngineerPortalRequestActionAPIView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request, request_id):
        engineer = engineer_from_session(request)
        maintenance_request = get_object_or_404(
            MaintenanceRequest,
            pk=request_id,
            assigned_public_engineer=engineer,
        )
        serializer = EngineerPortalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_status = serializer.validated_data.get("status")
        note = serializer.validated_data.get("note")

        if target_status:
            if target_status == maintenance_request.Status.IN_PROGRESS:
                valid_source = maintenance_request.status in {
                    maintenance_request.Status.ASSIGNED,
                    maintenance_request.Status.WAITING_SPARE_PARTS,
                }
            elif target_status == maintenance_request.Status.WAITING_SPARE_PARTS:
                valid_source = maintenance_request.status == maintenance_request.Status.IN_PROGRESS
            elif target_status == maintenance_request.Status.COMPLETED:
                valid_source = maintenance_request.status in {
                    maintenance_request.Status.IN_PROGRESS,
                    maintenance_request.Status.WAITING_SPARE_PARTS,
                }
            else:
                valid_source = False
            if not valid_source:
                raise drf_serializers.ValidationError(
                    {"status": f"Cannot move request from {maintenance_request.status} to {target_status}."}
                )

            maintenance_request.status = target_status
            now = timezone.now()
            timestamp_field = {
                MaintenanceRequest.Status.IN_PROGRESS: "in_progress_at",
                MaintenanceRequest.Status.WAITING_SPARE_PARTS: "waiting_spare_parts_at",
                MaintenanceRequest.Status.COMPLETED: "completed_at",
            }[target_status]
            if getattr(maintenance_request, timestamp_field) is None:
                setattr(maintenance_request, timestamp_field, now)
            maintenance_request.full_clean()
            maintenance_request.save()
            RequestActivity.objects.create(
                request=maintenance_request,
                public_engineer=engineer,
                event_type=(
                    RequestActivity.EventType.ACCEPTED
                    if target_status == MaintenanceRequest.Status.IN_PROGRESS
                    and maintenance_request.assigned_at
                    and maintenance_request.in_progress_at == now
                    else RequestActivity.EventType.STATUS
                ),
                message=f"Status updated to {target_status}.",
            )

        if note:
            RequestActivity.objects.create(
                request=maintenance_request,
                public_engineer=engineer,
                event_type=RequestActivity.EventType.NOTE,
                message=note.strip(),
            )
        maintenance_request.refresh_from_db()
        return Response(PortalMaintenanceRequestSerializer(maintenance_request).data)


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
