from django.contrib.auth import get_user_model
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompanyProfile, EngineerProfile, MaintenanceRequest, User
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
    PublicContactInquirySerializer,
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
                "completed_tickets": queryset.filter(status=MaintenanceRequest.Status.COMPLETED).count(),
            }
        )
        return Response(payload)


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

    def post(self, request):
        serializer = PublicMaintenanceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        maintenance_request = serializer.save()
        response_serializer = PublicMaintenanceRequestTrackingSerializer(maintenance_request)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class PublicContactInquiryAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PublicContactInquirySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
