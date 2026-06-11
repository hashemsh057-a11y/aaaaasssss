import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.utils.html import escape
from rest_framework import exceptions

from .models import (
    CompanyProfile,
    MaintenanceRequest,
    PortalOTPChallenge,
    PublicEngineer,
    RequestActivity,
)
from .notifications import queue_assignment_notification, send_transactional_email


PORTAL_TOKEN_SALT = "engiflow.portal.session"
OTP_HASH_SALT = "engiflow.portal.otp"


def normalize_email(email):
    return str(email or "").strip().lower()


def hash_otp(challenge_id, code):
    return salted_hmac(
        OTP_HASH_SALT,
        f"{challenge_id}:{code}",
        algorithm="sha256",
    ).hexdigest()


def issue_otp(email, role, purpose, payload=None):
    email = normalize_email(email)
    cooldown_since = timezone.now() - timedelta(seconds=settings.PORTAL_OTP_COOLDOWN_SECONDS)
    if PortalOTPChallenge.objects.filter(
        email=email,
        role=role,
        created_at__gte=cooldown_since,
    ).exists():
        raise exceptions.Throttled(
            wait=settings.PORTAL_OTP_COOLDOWN_SECONDS,
            detail="Please wait before requesting another verification code.",
        )

    code = f"{secrets.randbelow(10000):04d}"
    challenge = PortalOTPChallenge.objects.create(
        email=email,
        role=role,
        purpose=purpose,
        code_hash="pending",
        payload=payload or {},
        expires_at=timezone.now() + timedelta(minutes=settings.PORTAL_OTP_TTL_MINUTES),
    )
    challenge.code_hash = hash_otp(challenge.pk, code)
    challenge.save(update_fields=["code_hash"])

    subject = "رمز التحقق لمنصة EngiFlow"
    text = (
        f"رمز التحقق الخاص بك هو: {code}\n"
        f"ينتهي خلال {settings.PORTAL_OTP_TTL_MINUTES} دقائق.\n"
        "إذا لم تطلب هذا الرمز فتجاهل الرسالة."
    )
    html = f"""
<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;background:#f3f6fa;font-family:Arial,sans-serif;color:#17233a">
    <div style="max-width:560px;margin:0 auto;padding:28px 16px">
      <div style="overflow:hidden;border:1px solid #dfe4ea;border-radius:8px;background:#fff">
        <div style="background:#173f73;padding:20px 24px;color:#fff">
          <strong style="font-size:20px">EngiFlow</strong>
        </div>
        <div style="padding:28px 24px;text-align:center">
          <p style="margin:0 0 14px">استخدم الرمز التالي لتسجيل الدخول:</p>
          <div dir="ltr" style="font-size:34px;font-weight:700;letter-spacing:8px;color:#1769aa">
            {escape(code)}
          </div>
          <p style="margin:18px 0 0;color:#66758a;font-size:13px">
            ينتهي الرمز خلال {settings.PORTAL_OTP_TTL_MINUTES} دقائق.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
""".strip()
    try:
        send_transactional_email(email, subject, text, html)
    except Exception:
        if not settings.PORTAL_OTP_EXPOSE_CODE:
            challenge.delete()
            raise
    return challenge, code


def verify_otp(challenge_id, code, expected_role):
    try:
        challenge = PortalOTPChallenge.objects.get(pk=challenge_id, role=expected_role)
    except PortalOTPChallenge.DoesNotExist as exc:
        raise exceptions.ValidationError({"code": "Invalid verification challenge."}) from exc
    if challenge.consumed_at:
        raise exceptions.ValidationError({"code": "This verification code was already used."})
    if challenge.expires_at <= timezone.now():
        raise exceptions.ValidationError({"code": "This verification code has expired."})
    if challenge.attempts >= settings.PORTAL_OTP_MAX_ATTEMPTS:
        raise exceptions.ValidationError({"code": "Too many invalid attempts."})

    challenge.attempts += 1
    if not secrets.compare_digest(challenge.code_hash, hash_otp(challenge.pk, str(code).zfill(4))):
        challenge.save(update_fields=["attempts"])
        raise exceptions.ValidationError({"code": "The verification code is incorrect."})
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["attempts", "consumed_at"])
    return challenge


def create_portal_token(role, object_id, email):
    return signing.dumps(
        {"role": role, "id": object_id, "email": normalize_email(email)},
        salt=PORTAL_TOKEN_SALT,
        compress=True,
    )


def resolve_portal_token(request, expected_role):
    token = request.headers.get("X-Portal-Token", "").strip()
    if not token:
        raise exceptions.NotAuthenticated("Portal session is required.")
    try:
        payload = signing.loads(
            token,
            salt=PORTAL_TOKEN_SALT,
            max_age=settings.PORTAL_SESSION_MAX_AGE_SECONDS,
        )
    except signing.SignatureExpired as exc:
        raise exceptions.AuthenticationFailed("Portal session has expired.") from exc
    except signing.BadSignature as exc:
        raise exceptions.AuthenticationFailed("Invalid portal session.") from exc
    if payload.get("role") != expected_role:
        raise exceptions.PermissionDenied("This session cannot access the requested portal.")
    return payload


@transaction.atomic
def auto_assign_public_engineer(maintenance_request):
    active_statuses = [
        MaintenanceRequest.Status.ASSIGNED,
        MaintenanceRequest.Status.IN_PROGRESS,
        MaintenanceRequest.Status.WAITING_SPARE_PARTS,
    ]
    busy_engineer_ids = MaintenanceRequest.objects.filter(
        status__in=active_statuses,
        assigned_public_engineer__isnull=False,
    ).values_list("assigned_public_engineer_id", flat=True)
    engineer = (
        PublicEngineer.objects.select_for_update()
        .filter(
            specialty=maintenance_request.issue_type,
            is_available=True,
            email__gt="",
        )
        .exclude(pk__in=busy_engineer_ids)
        .order_by("created_at", "id")
        .first()
    )
    if not engineer:
        return None

    maintenance_request.assigned_public_engineer = engineer
    maintenance_request.status = MaintenanceRequest.Status.ASSIGNED
    maintenance_request.assigned_at = timezone.now()
    maintenance_request.full_clean()
    maintenance_request.save(
        update_fields=[
            "assigned_public_engineer",
            "status",
            "assigned_at",
            "updated_at",
        ]
    )
    RequestActivity.objects.create(
        request=maintenance_request,
        public_engineer=engineer,
        event_type=RequestActivity.EventType.AUTO_ASSIGNED,
        message="Assigned automatically by specialty and current workload.",
    )
    queue_assignment_notification(maintenance_request)
    return engineer


def company_from_session(request):
    payload = resolve_portal_token(request, PortalOTPChallenge.Role.COMPANY)
    try:
        return CompanyProfile.objects.select_related("user").get(
            pk=payload["id"],
            user__email__iexact=payload["email"],
            is_archived=False,
        )
    except CompanyProfile.DoesNotExist as exc:
        raise exceptions.AuthenticationFailed("Company account is unavailable.") from exc


def engineer_from_session(request):
    payload = resolve_portal_token(request, PortalOTPChallenge.Role.ENGINEER)
    try:
        return PublicEngineer.objects.get(
            pk=payload["id"],
            email__iexact=payload["email"],
        )
    except PublicEngineer.DoesNotExist as exc:
        raise exceptions.AuthenticationFailed("Engineer account is unavailable.") from exc
