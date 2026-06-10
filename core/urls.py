from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.http import JsonResponse
from django.views.generic import RedirectView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

from maintenance.views import (
    CompanyProfileViewSet,
    DashboardStatisticsAPIView,
    EngineerProfileViewSet,
    MaintenanceRequestViewSet,
    PublicAdminRequestCostAPIView,
    PublicAdminRequestTransitionAPIView,
    PublicCompanyListAPIView,
    PublicCapabilitiesAPIView,
    PublicContactInquiryAPIView,
    PublicEngineerDetailAPIView,
    PublicEngineerDeviceSessionAPIView,
    PublicEngineerAvailabilityAPIView,
    PublicEngineerListCreateAPIView,
    PublicImpactStatisticsAPIView,
    PublicMaintenanceRequestCreateAPIView,
    PublicReportView,
    PublicRequestListAPIView,
    PublicRequestTrackingAPIView,
    RequestEvidenceViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("companies", CompanyProfileViewSet, basename="company")
router.register("engineers", EngineerProfileViewSet, basename="engineer")
router.register("maintenance-requests", MaintenanceRequestViewSet, basename="maintenance-request")
router.register("request-evidences", RequestEvidenceViewSet, basename="request-evidence")

urlpatterns = [
    path("", RedirectView.as_view(url=settings.FRONTEND_URL, permanent=False), name="frontend-redirect"),
    path("health/", lambda request: JsonResponse({"status": "ok"}), name="health-check"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/dashboard/statistics/", DashboardStatisticsAPIView.as_view(), name="dashboard-statistics"),
    path("api/public/contact/", PublicContactInquiryAPIView.as_view(), name="public-contact-inquiry"),
    path("api/public/capabilities/", PublicCapabilitiesAPIView.as_view(), name="public-capabilities"),
    path("api/public/companies-list/", PublicCompanyListAPIView.as_view(), name="public-company-list"),
    path("api/public/engineers/", PublicEngineerListCreateAPIView.as_view(), name="public-engineer-list-create"),
    path("api/public/engineers/<int:pk>/", PublicEngineerDetailAPIView.as_view(), name="public-engineer-detail"),
    path(
        "api/public/engineer-device-session/",
        PublicEngineerDeviceSessionAPIView.as_view(),
        name="public-engineer-device-session",
    ),
    path(
        "api/public/engineers/<int:pk>/availability/",
        PublicEngineerAvailabilityAPIView.as_view(),
        name="public-engineer-availability",
    ),
    path("api/public/impact/", PublicImpactStatisticsAPIView.as_view(), name="public-impact-statistics"),
    path("api/public/requests/", PublicMaintenanceRequestCreateAPIView.as_view(), name="public-maintenance-request-create"),
    path("api/public/requests-list/", PublicRequestListAPIView.as_view(), name="public-maintenance-request-list"),
    path(
        "api/public/admin/requests/<int:request_id>/transition/",
        PublicAdminRequestTransitionAPIView.as_view(),
        name="public-admin-request-transition",
    ),
    path(
        "api/public/admin/requests/<int:request_id>/cost/",
        PublicAdminRequestCostAPIView.as_view(),
        name="public-admin-request-cost",
    ),
    path("api/public/reports/<str:kind>/", PublicReportView.as_view(), name="public-report"),
    path("api/public/track/<int:ticket_number>/", PublicRequestTrackingAPIView.as_view(), name="public-request-tracking"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
