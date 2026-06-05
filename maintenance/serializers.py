from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from .models import CompanyProfile, EngineerProfile, MaintenanceRequest, PublicContactInquiry, RequestEvidence, User


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
            "created_at",
            "updated_at",
        ]


class PublicContactInquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicContactInquiry
        fields = ["id", "contact_name", "company_name", "email", "phone", "message", "created_at"]
        read_only_fields = ["id", "created_at"]
