import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from .models import AssignmentNotification, MaintenanceRequest


class AssignmentEmailError(RuntimeError):
    pass


def _configured_provider():
    configured = settings.ASSIGNMENT_EMAIL_PROVIDER
    if configured == "auto":
        cloudflare_ready = all(
            [
                settings.CLOUDFLARE_EMAIL_ACCOUNT_ID,
                settings.CLOUDFLARE_EMAIL_API_TOKEN,
                settings.CLOUDFLARE_EMAIL_FROM_ADDRESS,
            ]
        )
        if cloudflare_ready:
            return AssignmentNotification.Provider.CLOUDFLARE
        if settings.EMAIL_HOST:
            return AssignmentNotification.Provider.SMTP
        return AssignmentNotification.Provider.DISABLED
    providers = {
        "cloudflare": AssignmentNotification.Provider.CLOUDFLARE,
        "smtp": AssignmentNotification.Provider.SMTP,
        "disabled": AssignmentNotification.Provider.DISABLED,
    }
    return providers.get(configured, AssignmentNotification.Provider.DISABLED)


def _recipient_for(maintenance_request):
    if maintenance_request.assigned_public_engineer_id:
        engineer = maintenance_request.assigned_public_engineer
        return engineer.email.strip(), engineer.name
    if maintenance_request.assigned_engineer_id:
        engineer = maintenance_request.assigned_engineer
        return engineer.user.email.strip(), str(engineer)
    return "", ""


def _message_content(maintenance_request):
    recipient_email, engineer_name = _recipient_for(maintenance_request)
    preferred_date = timezone.localtime(maintenance_request.preferred_date).strftime("%Y-%m-%d %H:%M")
    ticket_url = f"{settings.FRONTEND_URL.rstrip('/')}/?ticket={maintenance_request.pk}"
    subject = f"تم تعيين طلب صيانة جديد لك - رقم {maintenance_request.pk}"
    fields = [
        ("رقم الطلب", str(maintenance_request.pk)),
        ("الشركة / الجهة", maintenance_request.client_company.company_name),
        ("نوع العطل", maintenance_request.get_issue_type_display()),
        ("الأولوية", maintenance_request.get_priority_display()),
        ("الموقع", maintenance_request.location_details),
        ("الموعد المفضل", preferred_date),
        ("حالة خطرة", "نعم" if maintenance_request.is_hazardous else "لا"),
    ]
    text_lines = [
        f"مرحباً {engineer_name or 'بالمهندس'}،",
        "",
        "تم تعيين طلب صيانة جديد لك عبر منصة EngiFlow.",
        *[f"{label}: {value}" for label, value in fields],
        "",
        f"التفاصيل: {maintenance_request.description}",
        f"متابعة الطلب: {ticket_url}",
    ]
    rows = "".join(
        (
            '<tr>'
            f'<th style="padding:10px;text-align:right;background:#f3f6fa;color:#526176;'
            f'border-bottom:1px solid #dce3ec;width:34%">{escape(label)}</th>'
            f'<td style="padding:10px;text-align:right;color:#18243a;'
            f'border-bottom:1px solid #dce3ec">{escape(value)}</td>'
            '</tr>'
        )
        for label, value in fields
    )
    html = f"""
<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0;background:#f3f6fa;font-family:Arial,sans-serif;color:#18243a">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px">
      <div style="background:#ffffff;border:1px solid #dce3ec;border-radius:8px;overflow:hidden">
        <div style="padding:22px 24px;background:#173f73;color:#ffffff">
          <div style="font-size:13px;opacity:.8">EngiFlow</div>
          <h1 style="margin:6px 0 0;font-size:22px">طلب صيانة جديد</h1>
        </div>
        <div style="padding:24px">
          <p style="margin:0 0 18px">مرحباً {escape(engineer_name or 'بالمهندس')}، تم تعيين الطلب التالي لك.</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">{rows}</table>
          <div style="margin-top:18px;padding:14px;background:#f8fafc;border-right:3px solid #2a75bd">
            <strong>تفاصيل العطل</strong>
            <p style="margin:8px 0 0;line-height:1.8">{escape(maintenance_request.description)}</p>
          </div>
          <a href="{escape(ticket_url)}"
             style="display:inline-block;margin-top:20px;padding:11px 18px;background:#2a75bd;color:#fff;
                    text-decoration:none;border-radius:6px;font-weight:bold">
            متابعة الطلب
          </a>
        </div>
      </div>
    </div>
  </body>
</html>
""".strip()
    return recipient_email, subject, "\n".join(text_lines), html


def queue_assignment_notification(maintenance_request):
    recipient_email, subject, _, _ = _message_content(maintenance_request)
    provider = _configured_provider()
    skipped_reason = ""
    if not recipient_email:
        skipped_reason = "The assigned engineer does not have an email address."
    elif provider == AssignmentNotification.Provider.DISABLED:
        skipped_reason = "No assignment email provider is configured."

    notification = AssignmentNotification.objects.create(
        request=maintenance_request,
        public_engineer=maintenance_request.assigned_public_engineer,
        engineer_profile=maintenance_request.assigned_engineer,
        recipient_email=recipient_email,
        subject=subject,
        provider=provider,
        status=(
            AssignmentNotification.Status.SKIPPED
            if skipped_reason
            else AssignmentNotification.Status.PENDING
        ),
        error_message=skipped_reason,
    )
    if not skipped_reason:
        transaction.on_commit(lambda: deliver_assignment_notification(notification.pk))
    return notification


def _send_cloudflare_message(recipient_email, subject, text, html):
    missing = [
        name
        for name, value in [
            ("CLOUDFLARE_EMAIL_ACCOUNT_ID", settings.CLOUDFLARE_EMAIL_ACCOUNT_ID),
            ("CLOUDFLARE_EMAIL_API_TOKEN", settings.CLOUDFLARE_EMAIL_API_TOKEN),
            ("CLOUDFLARE_EMAIL_FROM_ADDRESS", settings.CLOUDFLARE_EMAIL_FROM_ADDRESS),
        ]
        if not value
    ]
    if missing:
        raise AssignmentEmailError(f"Missing Cloudflare email settings: {', '.join(missing)}")

    payload = {
        "to": recipient_email,
        "from": {
            "address": settings.CLOUDFLARE_EMAIL_FROM_ADDRESS,
            "name": settings.CLOUDFLARE_EMAIL_FROM_NAME,
        },
        "subject": subject,
        "text": text,
        "html": html,
    }
    if settings.CLOUDFLARE_EMAIL_REPLY_TO:
        payload["reply_to"] = settings.CLOUDFLARE_EMAIL_REPLY_TO

    endpoint = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.CLOUDFLARE_EMAIL_ACCOUNT_ID}/email/sending/send"
    )
    request = Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.CLOUDFLARE_EMAIL_API_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
            result = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AssignmentEmailError(f"Cloudflare email HTTP {exc.code}: {detail}") from exc
    except (URLError, TimeoutError) as exc:
        raise AssignmentEmailError(f"Cloudflare email connection failed: {exc}") from exc
    if not result.get("success"):
        raise AssignmentEmailError(f"Cloudflare email rejected the message: {result.get('errors', [])}")
    return result


def _send_smtp_message(recipient_email, subject, text, html):
    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )
    message.attach_alternative(html, "text/html")
    accepted = message.send(fail_silently=False)
    if accepted != 1:
        raise AssignmentEmailError("The SMTP backend did not accept the message.")
    return {"accepted": accepted}


def send_transactional_email(recipient_email, subject, text, html):
    provider = _configured_provider()
    if provider == AssignmentNotification.Provider.CLOUDFLARE:
        return provider, _send_cloudflare_message(recipient_email, subject, text, html)
    if provider == AssignmentNotification.Provider.SMTP:
        return provider, _send_smtp_message(recipient_email, subject, text, html)
    raise AssignmentEmailError("No email provider is configured.")


def deliver_assignment_notification(notification_id):
    notification = AssignmentNotification.objects.select_related(
        "request__client_company",
        "request__assigned_public_engineer",
        "request__assigned_engineer__user",
    ).get(pk=notification_id)
    if notification.status == AssignmentNotification.Status.SENT:
        return notification

    notification.attempts += 1
    _, _, text, html = _message_content(notification.request)
    try:
        if notification.provider == AssignmentNotification.Provider.CLOUDFLARE:
            response = _send_cloudflare_message(
                notification.recipient_email,
                notification.subject,
                text,
                html,
            )
        elif notification.provider == AssignmentNotification.Provider.SMTP:
            response = _send_smtp_message(
                notification.recipient_email,
                notification.subject,
                text,
                html,
            )
        else:
            raise AssignmentEmailError("No email provider is configured.")
    except Exception as exc:
        notification.status = AssignmentNotification.Status.FAILED
        notification.error_message = str(exc)[:4000]
        notification.provider_response = {}
    else:
        notification.status = AssignmentNotification.Status.SENT
        notification.error_message = ""
        notification.provider_response = response
        notification.sent_at = timezone.now()
    notification.save(
        update_fields=[
            "attempts",
            "status",
            "error_message",
            "provider_response",
            "sent_at",
            "updated_at",
        ]
    )
    return notification
