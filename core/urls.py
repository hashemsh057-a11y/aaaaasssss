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
    PublicContactInquiryAPIView,
    PublicEngineerDeleteAPIView,
    PublicEngineerListCreateAPIView,
    PublicImpactStatisticsAPIView,
    PublicMaintenanceRequestCreateAPIView,
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
    path("api/public/engineers/", PublicEngineerListCreateAPIView.as_view(), name="public-engineer-list-create"),
    path("api/public/engineers/<int:pk>/", PublicEngineerDeleteAPIView.as_view(), name="public-engineer-delete"),
    path("api/public/impact/", PublicImpactStatisticsAPIView.as_view(), name="public-impact-statistics"),
    path("api/public/requests/", PublicMaintenanceRequestCreateAPIView.as_view(), name="public-maintenance-request-create"),
    path("api/public/requests-list/", PublicRequestListAPIView.as_view(), name="public-maintenance-request-list"),
    path("api/public/track/<int:ticket_number>/", PublicRequestTrackingAPIView.as_view(), name="public-request-tracking"),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
