import re
from io import BytesIO
from uuid import uuid4
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

from .models import (
    CompanyProfile,
    EngineerProfile,
    MaintenanceRequest,
    MaintenanceSpecialty,
    PublicContactInquiry,
    PublicEngineer,
    RequestEvidence,
    User,
    phone_validator,
)


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, required=False, trim_whitespace=False)

    class Meta:
        model = get_user_model()
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
        ]
        read_only_fields = ["id", "is_staff", "is_superuser"]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = self.Meta.model(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.full_clean()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.full_clean()
        instance.save()
        return instance


class CompanyProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = CompanyProfile
        fields = [
            "id",
            "user",
            "user_email",
            "company_name",
            "commercial_register",
            "contact_phone",
            "address",
        ]
        read_only_fields = ["id", "user_email"]
        extra_kwargs = {
            "user": {"required": False},
        }

    def validate(self, attrs):
        request = self.context["request"]
        actor = request.user
        user = attrs.get("user")
        if self.instance is None:
            if actor.role == User.Role.CLIENT_COMPANY:
                if user is not None and user.id != actor.id:
                    raise serializers.ValidationError({"user": "Client companies can only create their own profile."})
                if CompanyProfile.objects.filter(user=actor).exists():
                    raise serializers.ValidationError("This company user already has a profile.")
            elif actor.has_workflow_control and user is None:
                raise serializers.ValidationError({"user": "A CLIENT_COMPANY user is required."})
        return attrs

    def validate_user(self, user):
        if user.role != User.Role.CLIENT_COMPANY:
            raise serializers.ValidationError("Company profiles can only be linked to CLIENT_COMPANY users.")
        return user


class EngineerProfileSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = EngineerProfile
        fields = [
            "id",
            "user",
            "user_email",
            "full_name",
            "employee_id",
            "department",
            "specialty",
            "phone",
            "avatar",
            "availability_status",
            "experience_years",
        ]
        read_only_fields = ["id", "user_email", "full_name"]
        extra_kwargs = {
            "user": {"required": False},
        }

    def validate(self, attrs):
        request = self.context["request"]
        actor = request.user
        user = attrs.get("user")
        if self.instance is None:
            if actor.role == User.Role.ENGINEER:
                if user is not None and user.id != actor.id:
                    raise serializers.ValidationError({"user": "Engineers can only create their own profile."})
                if EngineerProfile.objects.filter(user=actor).exists():
                    raise serializers.ValidationError("This engineer user already has a profile.")
            elif actor.has_workflow_control and user is None:
                raise serializers.ValidationError({"user": "An ENGINEER user is required."})
        return attrs

    def get_full_name(self, obj):
        full_name = obj.user.get_full_name().strip()
        return full_name or obj.user.username

    def validate_user(self, user):
        if user.role != User.Role.ENGINEER:
            raise serializers.ValidationError("Engineer profiles can only be linked to ENGINEER users.")
        return user


class MaintenanceRequestSerializer(serializers.ModelSerializer):
    client_company_name = serializers.CharField(source="client_company.company_name", read_only=True)
    assigned_engineer_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    issue_type_display = serializers.CharField(source="get_issue_type_display", read_only=True)
    priority_display = serializers.CharField(source="get_priority_display", read_only=True)

    class Meta:
        model = MaintenanceRequest
        fields = [
            "id",
            "client_company",
            "client_company_name",
            "issue_type",
            "issue_type_display",
            "priority",
            "priority_display",
            "location_details",
            "description",
            "preferred_date",
            "is_hazardous",
            "cost",
            "status",
            "status_display",
            "assigned_engineer",
            "assigned_engineer_name",
            "assigned_at",
            "in_progress_at",
            "waiting_spare_parts_at",
            "completed_at",
            "closed_at",
            "rejected_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "client_company_name",
            "assigned_engineer_name",
            "status_display",
            "issue_type_display",
            "priority_display",
            "assigned_at",
            "in_progress_at",
            "waiting_spare_parts_at",
            "completed_at",
            "closed_at",
            "rejected_at",
            "created_at",
            "updated_at",
            "cost",
        ]
        extra_kwargs = {
            "client_company": {"required": False},
        }

    def get_assigned_engineer_name(self, obj):
        if not obj.assigned_engineer:
            return None
        return str(obj.assigned_engineer)

    def validate(self, attrs):
        request = self.context["request"]
        actor = request.user
        if self.instance is None:
            if actor.role == User.Role.CLIENT_COMPANY:
                attrs.pop("client_company", None)
            elif not actor.has_workflow_control:
                raise serializers.ValidationError("Only client companies, admins, and quality controllers can create requests.")
            if attrs.get("status", MaintenanceRequest.Status.NEW) != MaintenanceRequest.Status.NEW:
                raise serializers.ValidationError({"status": "New maintenance requests must start with NEW status."})
            attrs["status"] = MaintenanceRequest.Status.NEW
            attrs.pop("assigned_engineer", None)
            return attrs

        changed_fields = set(attrs.keys())
        if actor.role == User.Role.CLIENT_COMPANY:
            raise serializers.ValidationError("Client companies cannot modify submitted maintenance requests.")
        if actor.role == User.Role.ENGINEER and changed_fields - {"status"}:
            raise serializers.ValidationError("Engineers can only update the workflow status field.")

        target_status = attrs.get("status")
        target_engineer = attrs.get("assigned_engineer")
        assigned_workflow_statuses = {
            MaintenanceRequest.Status.ASSIGNED,
            MaintenanceRequest.Status.IN_PROGRESS,
            MaintenanceRequest.Status.WAITING_SPARE_PARTS,
        }
        if (
            target_engineer is not None
            and target_status != MaintenanceRequest.Status.ASSIGNED
            and self.instance.status not in assigned_workflow_statuses
        ):
            raise serializers.ValidationError({"assigned_engineer": "Assign an engineer through the ASSIGNED status transition."})
        if target_status and target_status != self.instance.status:
            try:
                self.instance.validate_transition(target_status, actor, target_engineer)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        elif target_engineer and target_engineer.specialty != self.instance.issue_type:
            raise serializers.ValidationError({"assigned_engineer": "Assigned engineer specialty must match the issue type."})
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        if request.user.role == User.Role.CLIENT_COMPANY:
            try:
                validated_data["client_company"] = request.user.company_profile
            except CompanyProfile.DoesNotExist as exc:
                raise serializers.ValidationError("The authenticated company user does not have a company profile.") from exc
        instance = MaintenanceRequest(**validated_data)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        instance.save()
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        actor = self.context["request"].user
        target_status = validated_data.pop("status", None)
        target_engineer = validated_data.pop("assigned_engineer", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if validated_data:
            try:
                instance.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
            instance.save()

        if target_status and target_status != instance.status:
            try:
                instance.transition_to(target_status, actor, target_engineer)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        elif target_engineer is not None:
            instance.assigned_engineer = target_engineer
            try:
                instance.full_clean()
            except DjangoValidationError as exc:
                raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
            instance.save(update_fields=["assigned_engineer", "updated_at"])
        return instance


class RequestEvidenceSerializer(serializers.ModelSerializer):
    uploaded_by_username = serializers.CharField(source="uploaded_by.username", read_only=True)

    class Meta:
        model = RequestEvidence
        fields = [
            "id",
            "request",
            "stage",
            "image",
            "uploaded_by",
            "uploaded_by_username",
            "uploaded_at",
        ]
        read_only_fields = ["id", "uploaded_by", "uploaded_by_username", "uploaded_at"]

    def validate(self, attrs):
        request = self.context["request"]
        actor = request.user
        maintenance_request = attrs.get("request") or self.instance.request
        stage = attrs.get("stage") or self.instance.stage

        if actor.role == User.Role.CLIENT_COMPANY:
            if maintenance_request.client_company.user_id != actor.id:
                raise serializers.ValidationError("Client companies can only upload evidence for their own requests.")
            if stage != RequestEvidence.Stage.BEFORE_EXECUTION:
                raise serializers.ValidationError({"stage": "Client companies can only upload before-execution evidence."})
        elif actor.role == User.Role.ENGINEER:
            if not maintenance_request.assigned_engineer_id or maintenance_request.assigned_engineer.user_id != actor.id:
                raise serializers.ValidationError("Engineers can only upload evidence for assigned requests.")
            if stage not in {RequestEvidence.Stage.DURING_EXECUTION, RequestEvidence.Stage.AFTER_EXECUTION}:
                raise serializers.ValidationError({"stage": "Engineers can only upload during or after execution evidence."})
        elif not actor.has_workflow_control:
            raise serializers.ValidationError("This user role cannot upload request evidence.")

        instance = RequestEvidence(
            request=maintenance_request,
            stage=stage,
            image=attrs.get("image") or self.instance.image,
            uploaded_by=actor,
        )
        try:
            instance.clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        return attrs

    def create(self, validated_data):
        validated_data["uploaded_by"] = self.context["request"].user
        instance = RequestEvidence(**validated_data)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        instance.save()
        return instance


class PublicMaintenanceRequestTrackingSerializer(serializers.ModelSerializer):
    client_company_name = serializers.CharField(source="client_company.company_name", read_only=True)
    issue_type_display = serializers.CharField(source="get_issue_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    assigned_engineer_name = serializers.SerializerMethodField()
    assigned_engineer_phone = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceRequest
        fields = [
            "id",
            "client_company_name",
            "issue_type",
            "issue_type_display",
            "priority",
            "status",
            "status_display",
            "preferred_date",
            "assigned_engineer_name",
            "assigned_engineer_phone",
            "assigned_public_engineer",
            "assigned_at",
            "in_progress_at",
            "waiting_spare_parts_at",
            "completed_at",
            "closed_at",
            "rejected_at",
            "created_at",
            "updated_at",
            "cost",
        ]

    def get_assigned_engineer_name(self, obj):
        if obj.assigned_public_engineer_id:
            return obj.assigned_public_engineer.name
        if obj.assigned_engineer_id:
            return str(obj.assigned_engineer)
        return None

    def get_assigned_engineer_phone(self, obj):
        if obj.assigned_public_engineer_id:
            return obj.assigned_public_engineer.phone
        if obj.assigned_engineer_id:
            return obj.assigned_engineer.phone
        return None


class PublicMaintenanceRequestCreateSerializer(serializers.Serializer):
    contact_name = serializers.CharField(max_length=120, write_only=True)
    company_name = serializers.CharField(max_length=180, write_only=True)
    commercial_register = serializers.CharField(max_length=80, write_only=True)
    email = serializers.EmailField(write_only=True)
    phone = serializers.CharField(max_length=20, write_only=True)
    address = serializers.CharField(write_only=True)
    issue_type = serializers.ChoiceField(choices=MaintenanceSpecialty.choices, write_only=True)
    priority = serializers.ChoiceField(choices=MaintenanceRequest.Priority.choices, write_only=True)
    location_details = serializers.CharField(write_only=True)
    description = serializers.CharField(write_only=True)
    preferred_date = serializers.DateTimeField(write_only=True)
    is_hazardous = serializers.BooleanField(default=False, write_only=True)

    def validate_preferred_date(self, value):
        if value < timezone.now() - timedelta(minutes=5):
            raise serializers.ValidationError("Preferred date cannot be in the past.")
        return value

    def validate_phone(self, value):
        try:
            phone_validator(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def _build_unique_username(self, email):
        local_part = email.split("@", 1)[0].lower()
        base = re.sub(r"[^a-z0-9_.-]+", "-", local_part).strip("-_.") or "company"
        base = f"public-{base}"[:138].rstrip("-_.")
        candidate = base
        counter = 1
        UserModel = get_user_model()
        while UserModel.objects.filter(username=candidate).exists():
            suffix = f"-{counter}"
            candidate = f"{base[:150 - len(suffix)]}{suffix}"
            counter += 1
        return candidate

    def _get_or_create_company(self, validated_data):
        UserModel = get_user_model()
        email = UserModel.objects.normalize_email(validated_data["email"]).lower()
        user = UserModel.objects.filter(email__iexact=email).first()

        if user and user.role != User.Role.CLIENT_COMPANY:
            raise serializers.ValidationError({"email": "This email is already registered for a non-company account."})

        if user is None:
            user = UserModel(
                username=self._build_unique_username(email),
                email=email,
                role=User.Role.CLIENT_COMPANY,
                first_name=validated_data["contact_name"][:150],
                is_active=True,
            )
            user.set_unusable_password()
            user.full_clean()
            user.save()

        try:
            return user.company_profile
        except CompanyProfile.DoesNotExist:
            company = CompanyProfile(
                user=user,
                company_name=validated_data["company_name"],
                commercial_register=validated_data["commercial_register"],
                contact_phone=validated_data["phone"],
                address=validated_data["address"],
            )
            company.full_clean()
            company.save()
            return company

    @transaction.atomic
    def create(self, validated_data):
        company = self._get_or_create_company(validated_data)
        maintenance_request = MaintenanceRequest(
            client_company=company,
            issue_type=validated_data["issue_type"],
            priority=validated_data["priority"],
            location_details=validated_data["location_details"],
            description=validated_data["description"],
            preferred_date=validated_data["preferred_date"],
            is_hazardous=validated_data.get("is_hazardous", False),
            status=MaintenanceRequest.Status.NEW,
        )
        try:
            maintenance_request.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)
        maintenance_request.save()
        return maintenance_request


class PublicCompanyListSerializer(serializers.ModelSerializer):
    """Read-only public list of registered companies for the open dashboard.

    Exposes the full business details (company name, register, phone, address)
    because the dashboard is the user's "professional" admin view per request.
    """

    contact_name = serializers.CharField(source="user.first_name", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = CompanyProfile
        fields = [
            "id",
            "company_name",
            "commercial_register",
            "contact_phone",
            "address",
            "contact_name",
            "email",
        ]


class PublicEngineerSerializer(serializers.ModelSerializer):
    specialty_display = serializers.CharField(source="get_specialty_display", read_only=True)

    class Meta:
        model = PublicEngineer
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "department",
            "specialty",
            "specialty_display",
            "profession",
            "avatar",
            "experience_years",
            "is_available",
            "created_at",
        ]
        read_only_fields = ["id", "specialty_display", "created_at"]
        extra_kwargs = {
            "email": {"required": True, "allow_blank": False},
            "department": {"required": True, "allow_blank": False},
            "profession": {"required": True, "allow_blank": False},
            "experience_years": {"required": True},
            "is_available": {"default": True},
        }

    def validate_phone(self, value):
        try:
            phone_validator(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Name is required.")
        return cleaned

    def validate_email(self, value):
        normalized = value.strip().lower()
        queryset = PublicEngineer.objects.filter(email__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("An engineer with this email is already registered.")
        return normalized

    def validate_avatar(self, value):
        if value and value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image size must not exceed 5 MB.")
        return value

    @staticmethod
    def _avatar_as_webp(uploaded_file):
        try:
            uploaded_file.seek(0)
            with Image.open(uploaded_file) as source:
                image = ImageOps.exif_transpose(source)
                image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
                has_alpha = image.mode in {"RGBA", "LA"} or (
                    image.mode == "P" and "transparency" in image.info
                )
                image = image.convert("RGBA" if has_alpha else "RGB")
                output = BytesIO()
                image.save(output, format="WEBP", quality=84, method=6)
        except (OSError, UnidentifiedImageError, ValueError) as exc:
            raise serializers.ValidationError(
                {"avatar": "Upload a valid JPG, PNG, or WebP image."}
            ) from exc

        return ContentFile(output.getvalue(), name=f"{uuid4().hex}.webp")

    def create(self, validated_data):
        avatar = validated_data.get("avatar")
        if avatar:
            validated_data["avatar"] = self._avatar_as_webp(avatar)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        avatar = validated_data.get("avatar")
        if avatar:
            validated_data["avatar"] = self._avatar_as_webp(avatar)
        return super().update(instance, validated_data)


class PublicEngineerCreateSerializer(PublicEngineerSerializer):
    availability_token = serializers.UUIDField(read_only=True)

    class Meta(PublicEngineerSerializer.Meta):
        fields = [*PublicEngineerSerializer.Meta.fields, "availability_token"]


class PublicContactInquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicContactInquiry
        fields = ["id", "contact_name", "company_name", "email", "phone", "message", "created_at"]
        read_only_fields = ["id", "created_at"]
