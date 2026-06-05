from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import MaintenanceRequest, RequestEvidence, User


class IsAdminOrQualityController(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.has_workflow_control)


class UserViewSetPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.has_workflow_control:
            return True
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        if request.user.has_workflow_control:
            return True
        return request.method in SAFE_METHODS and obj.id == request.user.id


class CompanyProfilePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.has_workflow_control:
            return True
        if request.method == "POST":
            return request.user.role == User.Role.CLIENT_COMPANY
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        if request.user.has_workflow_control:
            return True
        if request.user.role == User.Role.CLIENT_COMPANY:
            return obj.user_id == request.user.id
        return False


class EngineerProfilePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.has_workflow_control:
            return True
        if request.method == "POST":
            return request.user.role == User.Role.ENGINEER
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        if request.user.has_workflow_control:
            return True
        if request.user.role == User.Role.ENGINEER:
            return obj.user_id == request.user.id
        return False


class MaintenanceRequestPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.has_workflow_control:
            return True
        if request.method == "POST":
            return request.user.role == User.Role.CLIENT_COMPANY
        if request.method in SAFE_METHODS:
            return request.user.role in {User.Role.CLIENT_COMPANY, User.Role.ENGINEER}
        if request.method == "PATCH":
            return request.user.role == User.Role.ENGINEER
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.has_workflow_control:
            return True
        if request.user.role == User.Role.CLIENT_COMPANY:
            return request.method in SAFE_METHODS and obj.client_company.user_id == request.user.id
        if request.user.role == User.Role.ENGINEER:
            if not obj.assigned_engineer_id or obj.assigned_engineer.user_id != request.user.id:
                return False
            return request.method in SAFE_METHODS or request.method == "PATCH"
        return False


class RequestEvidencePermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.has_workflow_control:
            return True
        if request.method == "POST":
            return request.user.role in {User.Role.CLIENT_COMPANY, User.Role.ENGINEER}
        return request.method in SAFE_METHODS and request.user.role in {User.Role.CLIENT_COMPANY, User.Role.ENGINEER}

    def has_object_permission(self, request, view, obj):
        if request.user.has_workflow_control:
            return True
        if request.user.role == User.Role.CLIENT_COMPANY:
            return request.method in SAFE_METHODS and obj.request.client_company.user_id == request.user.id
        if request.user.role == User.Role.ENGINEER:
            assigned_engineer = obj.request.assigned_engineer
            return (
                request.method in SAFE_METHODS
                and assigned_engineer is not None
                and assigned_engineer.user_id == request.user.id
            )
        return False


def scoped_maintenance_requests_for_user(user):
    queryset = MaintenanceRequest.objects.select_related(
        "client_company",
        "client_company__user",
        "assigned_engineer",
        "assigned_engineer__user",
    )
    if user.has_workflow_control:
        return queryset
    if user.role == User.Role.CLIENT_COMPANY:
        return queryset.filter(client_company__user=user)
    if user.role == User.Role.ENGINEER:
        return queryset.filter(assigned_engineer__user=user)
    return queryset.none()


def scoped_request_evidences_for_user(user):
    queryset = RequestEvidence.objects.select_related(
        "request",
        "request__client_company",
        "request__client_company__user",
        "request__assigned_engineer",
        "request__assigned_engineer__user",
        "uploaded_by",
    )
    if user.has_workflow_control:
        return queryset
    if user.role == User.Role.CLIENT_COMPANY:
        return queryset.filter(request__client_company__user=user)
    if user.role == User.Role.ENGINEER:
        return queryset.filter(request__assigned_engineer__user=user)
    return queryset.none()
