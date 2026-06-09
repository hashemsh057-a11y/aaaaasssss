from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import (
    CompanyProfile,
    EngineerProfile,
    MaintenanceRequest,
    PublicContactInquiry,
    PublicEngineer,
    RequestEvidence,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Maintenance platform", {"fields": ("role",)}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Maintenance platform", {"fields": ("email", "role")}),
    )
    list_display = ("username", "email", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name")


@admin.register(CompanyProfile)
class CompanyProfileAdmin(admin.ModelAdmin):
    list_display = ("company_name", "commercial_register", "contact_phone", "user")
    search_fields = ("company_name", "commercial_register", "user__email", "user__username")
    autocomplete_fields = ("user",)


@admin.register(EngineerProfile)
class EngineerProfileAdmin(admin.ModelAdmin):
    list_display = ("employee_id", "user", "department", "specialty", "availability_status", "experience_years")
    list_filter = ("specialty", "availability_status", "department")
    search_fields = ("employee_id", "user__email", "user__username", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)


class RequestEvidenceInline(admin.TabularInline):
    model = RequestEvidence
    extra = 0
    readonly_fields = ("uploaded_at",)
    autocomplete_fields = ("uploaded_by",)


@admin.register(MaintenanceRequest)
class MaintenanceRequestAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "client_company",
        "issue_type",
        "priority",
        "status",
        "assigned_engineer",
        "cost",
        "created_at",
    )
    list_filter = ("status", "priority", "issue_type", "is_hazardous", "created_at")
    search_fields = ("client_company__company_name", "location_details", "description", "assigned_engineer__employee_id")
    readonly_fields = (
        "assigned_at",
        "in_progress_at",
        "waiting_spare_parts_at",
        "completed_at",
        "closed_at",
        "rejected_at",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("client_company", "assigned_engineer")
    inlines = [RequestEvidenceInline]


@admin.register(RequestEvidence)
class RequestEvidenceAdmin(admin.ModelAdmin):
    list_display = ("id", "request", "stage", "uploaded_by", "uploaded_at")
    list_filter = ("stage", "uploaded_at")
    search_fields = ("request__client_company__company_name", "uploaded_by__username", "uploaded_by__email")
    autocomplete_fields = ("request", "uploaded_by")
    readonly_fields = ("uploaded_at",)


@admin.register(PublicEngineer)
class PublicEngineerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "specialty", "created_at")
    list_filter = ("specialty", "created_at")
    search_fields = ("name", "phone")
    readonly_fields = ("created_at",)


@admin.register(PublicContactInquiry)
class PublicContactInquiryAdmin(admin.ModelAdmin):
    list_display = ("company_name", "contact_name", "email", "phone", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("company_name", "contact_name", "email", "phone", "message")
    readonly_fields = ("created_at", "updated_at")
