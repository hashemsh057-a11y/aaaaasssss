import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Avg, Count, DurationField, ExpressionWrapper, F, Q
from django.utils.crypto import salted_hmac
from django.utils import timezone


phone_validator = RegexValidator(
    regex=r"^\+?[0-9\s().-]{7,20}$",
    message="Enter a valid phone number using digits, spaces, and optional +().- characters.",
)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        ENGINEER = "ENGINEER", "Engineer"
        CLIENT_COMPANY = "CLIENT_COMPANY", "Client company"
        QUALITY_CONTROLLER = "QUALITY_CONTROLLER", "Quality controller"

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=32, choices=Role.choices)

    REQUIRED_FIELDS = ["email", "role"]

    class Meta:
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["email"]),
        ]

    def clean(self):
        super().clean()
        self.email = self.__class__.objects.normalize_email(self.email)

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_quality_controller_role(self):
        return self.role == self.Role.QUALITY_CONTROLLER

    @property
    def has_workflow_control(self):
        return self.is_admin_role or self.is_quality_controller_role


class MaintenanceSpecialty(models.TextChoices):
    ELECTRICITY = "ELECTRICITY", "Electricity"
    NETWORKS = "NETWORKS", "Networks"
    HVAC = "HVAC", "HVAC"
    PLUMBING = "PLUMBING", "Plumbing"
    MEDICAL_DEVICES = "MEDICAL_DEVICES", "Medical devices"
    SURVEILLANCE = "SURVEILLANCE", "Surveillance"
    SOFTWARE = "SOFTWARE", "Software"
    SERVERS = "SERVERS", "Servers"
    CYBERSECURITY = "CYBERSECURITY", "Cybersecurity"


class CompanyProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_profile")
    company_name = models.CharField(max_length=180)
    commercial_register = models.CharField(max_length=80)
    contact_phone = models.CharField(max_length=20, validators=[phone_validator])
    address = models.TextField()

    class Meta:
        ordering = ["company_name"]
        indexes = [
            models.Index(fields=["company_name"]),
            models.Index(fields=["commercial_register"]),
        ]

    def __str__(self):
        return self.company_name


class EngineerProfile(models.Model):
    class AvailabilityStatus(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        ON_SITE = "ON_SITE", "On site"
        ON_LEAVE = "ON_LEAVE", "On leave"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="engineer_profile")
    employee_id = models.CharField(max_length=60, unique=True)
    department = models.CharField(max_length=120)
    specialty = models.CharField(max_length=32, choices=MaintenanceSpecialty.choices)
    phone = models.CharField(max_length=20, validators=[phone_validator])
    avatar = models.ImageField(
        upload_to="engineers/avatars/%Y/%m/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    availability_status = models.CharField(
        max_length=16,
        choices=AvailabilityStatus.choices,
        default=AvailabilityStatus.AVAILABLE,
    )
    experience_years = models.PositiveSmallIntegerField(validators=[MinValueValidator(0), MaxValueValidator(60)])

    class Meta:
        ordering = ["employee_id"]
        indexes = [
            models.Index(fields=["specialty", "availability_status"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        full_name = self.user.get_full_name().strip()
        return full_name or self.employee_id


class MaintenanceRequestQuerySet(models.QuerySet):
    def open(self):
        return self.exclude(
            status__in=[
                MaintenanceRequest.Status.COMPLETED,
                MaintenanceRequest.Status.CLOSED,
                MaintenanceRequest.Status.REJECTED,
            ]
        )

    def total_open_requests(self):
        return self.open().count()

    def completion_rate(self):
        total = self.count()
        if total == 0:
            return 0.0
        completed = self.filter(
            status__in=[
                MaintenanceRequest.Status.COMPLETED,
                MaintenanceRequest.Status.CLOSED,
            ]
        ).count()
        return round((completed / total) * 100, 2)

    def top_recurring_issues(self, limit=5):
        return (
            self.values("issue_type")
            .annotate(total=Count("id"))
            .order_by("-total", "issue_type")[:limit]
        )

    def fastest_responding_engineer(self):
        response_time = ExpressionWrapper(F("in_progress_at") - F("assigned_at"), output_field=DurationField())
        return (
            self.filter(assigned_engineer__isnull=False, assigned_at__isnull=False, in_progress_at__isnull=False)
            .values(
                "assigned_engineer_id",
                "assigned_engineer__employee_id",
                "assigned_engineer__user__first_name",
                "assigned_engineer__user__last_name",
            )
            .annotate(average_response_time=Avg(response_time), handled_requests=Count("id"))
            .order_by("average_response_time", "-handled_requests")
            .first()
        )

    def average_resolution_time(self):
        resolution_time = ExpressionWrapper(F("completed_at") - F("created_at"), output_field=DurationField())
        return self.filter(completed_at__isnull=False).aggregate(average_resolution_time=Avg(resolution_time))[
            "average_resolution_time"
        ]


class MaintenanceRequest(models.Model):
    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        NEW = "NEW", "New"
        UNDER_REVIEW = "UNDER_REVIEW", "Under review"
        ASSIGNED = "ASSIGNED", "Assigned"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        WAITING_SPARE_PARTS = "WAITING_SPARE_PARTS", "Waiting spare parts"
        COMPLETED = "COMPLETED", "Completed"
        REJECTED = "REJECTED", "Rejected"
        CLOSED = "CLOSED", "Closed"

    WORKFLOW_TRANSITIONS = {
        Status.NEW: {Status.UNDER_REVIEW, Status.REJECTED},
        Status.UNDER_REVIEW: {Status.ASSIGNED, Status.REJECTED},
        Status.ASSIGNED: {Status.IN_PROGRESS},
        Status.IN_PROGRESS: {Status.WAITING_SPARE_PARTS, Status.COMPLETED},
        Status.WAITING_SPARE_PARTS: {Status.IN_PROGRESS, Status.COMPLETED},
        Status.COMPLETED: {Status.CLOSED},
        Status.REJECTED: set(),
        Status.CLOSED: set(),
    }

    ENGINEER_ALLOWED_TARGETS = {Status.IN_PROGRESS, Status.WAITING_SPARE_PARTS}

    client_company = models.ForeignKey(CompanyProfile, on_delete=models.PROTECT, related_name="maintenance_requests")
    issue_type = models.CharField(max_length=32, choices=MaintenanceSpecialty.choices)
    priority = models.CharField(max_length=16, choices=Priority.choices)
    location_details = models.TextField()
    description = models.TextField()
    preferred_date = models.DateTimeField()
    is_hazardous = models.BooleanField(default=False)
    cost = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Total maintenance cost in local currency.",
    )
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.NEW)
    assigned_engineer = models.ForeignKey(
        EngineerProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_requests",
    )
    # Lightweight public engineer assignment used by the open dashboard.
    # Either assigned_engineer (authenticated) or assigned_public_engineer
    # (directory entry) can hold the on-site technician.
    assigned_public_engineer = models.ForeignKey(
        "PublicEngineer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_requests",
    )
    assigned_at = models.DateTimeField(null=True, blank=True, editable=False)
    in_progress_at = models.DateTimeField(null=True, blank=True, editable=False)
    waiting_spare_parts_at = models.DateTimeField(null=True, blank=True, editable=False)
    completed_at = models.DateTimeField(null=True, blank=True, editable=False)
    closed_at = models.DateTimeField(null=True, blank=True, editable=False)
    rejected_at = models.DateTimeField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = MaintenanceRequestQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["issue_type", "status"]),
            models.Index(fields=["client_company", "status"]),
            models.Index(fields=["assigned_engineer", "status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.client_company.company_name} - {self.issue_type} - {self.status}"

    def clean(self):
        super().clean()
        if self.status in {
            self.Status.ASSIGNED,
            self.Status.IN_PROGRESS,
            self.Status.WAITING_SPARE_PARTS,
            self.Status.COMPLETED,
            self.Status.CLOSED,
        }:
            if not self.assigned_engineer_id and not self.assigned_public_engineer_id:
                raise ValidationError({"assigned_engineer": "An assigned engineer is required for this status."})
        if self.assigned_engineer and self.assigned_engineer.specialty != self.issue_type:
            raise ValidationError({"assigned_engineer": "Assigned engineer specialty must match the request issue type."})
        if (
            self.assigned_public_engineer
            and self.assigned_public_engineer.specialty != self.issue_type
        ):
            raise ValidationError(
                {"assigned_public_engineer": "Assigned engineer specialty must match the request issue type."}
            )

    def can_transition_to(self, target_status):
        return target_status in self.WORKFLOW_TRANSITIONS[self.status]

    def validate_transition(self, target_status, actor, assigned_engineer=None):
        if target_status == self.status:
            return
        if not self.can_transition_to(target_status):
            raise ValidationError(
                {"status": f"Illegal workflow transition from {self.status} to {target_status}."}
            )
        if actor.role == User.Role.CLIENT_COMPANY:
            raise ValidationError({"status": "Client companies cannot change maintenance request workflow status."})
        if actor.role == User.Role.ENGINEER:
            if self.assigned_engineer_id is None or self.assigned_engineer.user_id != actor.id:
                raise ValidationError({"status": "Engineers can only update workflow status for assigned requests."})
            if target_status not in self.ENGINEER_ALLOWED_TARGETS:
                raise ValidationError({"status": "Engineers can only move requests to IN_PROGRESS or WAITING_SPARE_PARTS."})
        elif not actor.has_workflow_control:
            raise ValidationError({"status": "This user role cannot change maintenance request workflow status."})
        engineer = assigned_engineer if assigned_engineer is not None else self.assigned_engineer
        if target_status in {self.Status.ASSIGNED, self.Status.IN_PROGRESS, self.Status.WAITING_SPARE_PARTS}:
            if engineer is None:
                raise ValidationError({"assigned_engineer": "An assigned engineer is required for this transition."})
            if engineer.specialty != self.issue_type:
                raise ValidationError({"assigned_engineer": "Assigned engineer specialty must match the issue type."})

    def transition_to(self, target_status, actor, assigned_engineer=None):
        self.validate_transition(target_status, actor, assigned_engineer)
        if target_status == self.status:
            return

        now = timezone.now()
        if assigned_engineer is not None:
            self.assigned_engineer = assigned_engineer
        self.status = target_status

        timestamp_field_by_status = {
            self.Status.ASSIGNED: "assigned_at",
            self.Status.IN_PROGRESS: "in_progress_at",
            self.Status.WAITING_SPARE_PARTS: "waiting_spare_parts_at",
            self.Status.COMPLETED: "completed_at",
            self.Status.CLOSED: "closed_at",
            self.Status.REJECTED: "rejected_at",
        }
        timestamp_field = timestamp_field_by_status.get(target_status)
        if timestamp_field and getattr(self, timestamp_field) is None:
            setattr(self, timestamp_field, now)

        update_fields = ["status", "updated_at"]
        if assigned_engineer is not None:
            update_fields.append("assigned_engineer")
        if timestamp_field:
            update_fields.append(timestamp_field)
        self.full_clean()
        self.save(update_fields=update_fields)


class RequestEvidence(models.Model):
    class Stage(models.TextChoices):
        BEFORE_EXECUTION = "BEFORE_EXECUTION", "Before execution"
        DURING_EXECUTION = "DURING_EXECUTION", "During execution"
        AFTER_EXECUTION = "AFTER_EXECUTION", "After execution"

    request = models.ForeignKey(MaintenanceRequest, on_delete=models.CASCADE, related_name="evidences")
    stage = models.CharField(max_length=24, choices=Stage.choices)
    image = models.ImageField(
        upload_to="maintenance/evidence/%Y/%m/",
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_request_evidences",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["request", "stage"]),
            models.Index(fields=["uploaded_at"]),
        ]

    def __str__(self):
        return f"{self.request_id} - {self.stage}"

    def clean(self):
        super().clean()
        status = self.request.status
        if self.stage == self.Stage.BEFORE_EXECUTION and status not in {
            MaintenanceRequest.Status.NEW,
            MaintenanceRequest.Status.UNDER_REVIEW,
            MaintenanceRequest.Status.ASSIGNED,
        }:
            raise ValidationError({"stage": "Before-execution evidence is only allowed before work starts."})
        if self.stage == self.Stage.DURING_EXECUTION and status not in {
            MaintenanceRequest.Status.IN_PROGRESS,
            MaintenanceRequest.Status.WAITING_SPARE_PARTS,
        }:
            raise ValidationError({"stage": "During-execution evidence requires an active maintenance workflow."})
        if self.stage == self.Stage.AFTER_EXECUTION and status not in {
            MaintenanceRequest.Status.COMPLETED,
            MaintenanceRequest.Status.CLOSED,
        }:
            raise ValidationError({"stage": "After-execution evidence requires a completed or closed request."})


class PublicEngineer(models.Model):
    """Lightweight engineer directory entry registered from the public site.

    Captures a public registration profile without provisioning a full
    authenticated EngineerProfile/User.
    """

    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, validators=[phone_validator])
    email = models.EmailField(blank=True, default="", db_index=True)
    department = models.CharField(max_length=120, blank=True, default="")
    specialty = models.CharField(max_length=32, choices=MaintenanceSpecialty.choices)
    profession = models.CharField(max_length=120, blank=True, default="")
    avatar = models.ImageField(
        upload_to="engineers/public/%Y/%m/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "webp"])],
    )
    experience_years = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(60)],
    )
    is_available = models.BooleanField(default=True)
    availability_token = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    device_id_hash = models.CharField(max_length=64, unique=True, null=True, blank=True, editable=False)
    device_label = models.CharField(max_length=160, blank=True, default="")
    device_last_seen_at = models.DateTimeField(null=True, blank=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["specialty", "is_available"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"{self.name} - {self.specialty}"

    @staticmethod
    def hash_device_id(device_id):
        normalized = str(device_id).strip()
        if not normalized:
            return None
        return salted_hmac("public-engineer-device", normalized, algorithm="sha256").hexdigest()


class PublicContactInquiry(models.Model):
    class Status(models.TextChoices):
        NEW = "NEW", "New"
        CONTACTED = "CONTACTED", "Contacted"
        QUALIFIED = "QUALIFIED", "Qualified"
        CLOSED = "CLOSED", "Closed"

    contact_name = models.CharField(max_length=120)
    company_name = models.CharField(max_length=180)
    email = models.EmailField()
    phone = models.CharField(max_length=20, validators=[phone_validator])
    message = models.TextField(max_length=1600)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["email"]),
            models.Index(fields=["company_name"]),
        ]

    def __str__(self):
        return f"{self.company_name} - {self.contact_name}"


class AssignmentNotification(models.Model):
    class Provider(models.TextChoices):
        CLOUDFLARE = "CLOUDFLARE", "Cloudflare Email"
        SMTP = "SMTP", "SMTP"
        DISABLED = "DISABLED", "Disabled"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        SENT = "SENT", "Sent"
        FAILED = "FAILED", "Failed"
        SKIPPED = "SKIPPED", "Skipped"

    request = models.ForeignKey(
        MaintenanceRequest,
        on_delete=models.CASCADE,
        related_name="assignment_notifications",
    )
    public_engineer = models.ForeignKey(
        PublicEngineer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_notifications",
    )
    engineer_profile = models.ForeignKey(
        EngineerProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assignment_notifications",
    )
    recipient_email = models.EmailField(blank=True)
    subject = models.CharField(max_length=240)
    provider = models.CharField(max_length=16, choices=Provider.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    provider_response = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["request", "created_at"]),
        ]

    def __str__(self):
        return f"Request #{self.request_id} - {self.recipient_email or 'no email'} - {self.status}"
