from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from maintenance.models import CompanyProfile, EngineerProfile, MaintenanceRequest, PublicEngineer


SPECIALTY_AR = {
    "ELECTRICITY": "الكهرباء",
    "NETWORKS": "الشبكات",
    "HVAC": "التكييف والتهوية",
    "PLUMBING": "السباكة",
    "MEDICAL_DEVICES": "الأجهزة الطبية",
    "SURVEILLANCE": "المراقبة",
    "SOFTWARE": "البرمجيات",
    "SERVERS": "الخوادم",
    "CYBERSECURITY": "الأمن السيبراني",
}
STATUS_AR = {
    "NEW": "جديد",
    "UNDER_REVIEW": "قيد المراجعة",
    "ASSIGNED": "تم تعيين مهندس",
    "IN_PROGRESS": "قيد التنفيذ",
    "WAITING_SPARE_PARTS": "بانتظار قطع الغيار",
    "COMPLETED": "مكتمل",
    "CLOSED": "مغلق",
    "REJECTED": "مرفوض",
}
PRIORITY_AR = {
    "LOW": "منخفضة",
    "MEDIUM": "متوسطة",
    "HIGH": "عالية",
    "CRITICAL": "حرجة",
}
REPORT_KINDS = {"monthly", "company", "engineer", "recurring", "cost"}


@dataclass
class ReportSheet:
    name: str
    headers: list[str]
    rows: list[list]
    summaries: list[str] = field(default_factory=list)


@dataclass
class ReportSpec:
    kind: str
    title: str
    filename: str
    subtitle: str
    sheets: list[ReportSheet]


def _date(value) -> str:
    if not value:
        return "-"
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.strftime("%Y-%m-%d")


def _money(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _engineer_name(request: MaintenanceRequest) -> str:
    if request.assigned_public_engineer_id:
        return request.assigned_public_engineer.name
    if request.assigned_engineer_id:
        return request.assigned_engineer.user.get_full_name().strip() or request.assigned_engineer.employee_id
    return "-"


def _request_row(request: MaintenanceRequest, include_company: bool = True) -> list:
    row = [request.id]
    if include_company:
        row.append(request.client_company.company_name)
    row.extend(
        [
            SPECIALTY_AR.get(request.issue_type, request.issue_type),
            PRIORITY_AR.get(request.priority, request.priority),
            STATUS_AR.get(request.status, request.status),
            _engineer_name(request),
            _money(request.cost),
            _date(request.created_at),
        ]
    )
    return row


def _request_queryset():
    return MaintenanceRequest.objects.select_related(
        "client_company",
        "assigned_engineer__user",
        "assigned_public_engineer",
    )


def _monthly_report(year: int, month: int) -> ReportSpec:
    start = timezone.make_aware(datetime(year, month, 1), timezone.get_current_timezone())
    end = start.replace(year=year + 1, month=1) if month == 12 else start.replace(month=month + 1)
    queryset = _request_queryset().filter(created_at__gte=start, created_at__lt=end).order_by("created_at")
    rows = [_request_row(request) for request in queryset]
    total_cost = queryset.aggregate(total=Sum("cost"))["total"] or Decimal("0")
    return ReportSpec(
        kind="monthly",
        title=f"تقرير الصيانة الشهري - {year}/{month:02d}",
        filename=f"engiflow-monthly-{year}-{month:02d}",
        subtitle=f"عدد الطلبات خلال الشهر: {len(rows)}",
        sheets=[
            ReportSheet(
                name="الصيانة الشهرية",
                headers=[
                    "رقم الطلب",
                    "الكلية / الجهة",
                    "نوع العطل",
                    "الأولوية",
                    "الحالة",
                    "المهندس",
                    "التكلفة",
                    "التاريخ",
                ],
                rows=rows,
                summaries=[f"إجمالي تكلفة الشهر: {float(total_cost):,.2f}"],
            )
        ],
    )


def _company_report(company_id: int | None) -> ReportSpec:
    companies = CompanyProfile.objects.all()
    if company_id is not None:
        companies = companies.filter(pk=company_id)
    company_ids = list(companies.values_list("id", flat=True))
    queryset = _request_queryset().filter(client_company_id__in=company_ids).order_by(
        "client_company__company_name", "-created_at"
    )
    rows = [_request_row(request) for request in queryset]
    total_cost = queryset.aggregate(total=Sum("cost"))["total"] or Decimal("0")
    selected_name = companies.values_list("company_name", flat=True).first() if company_id else None
    subtitle = selected_name or f"عدد الجهات المشمولة: {len(company_ids)}"
    return ReportSpec(
        kind="company",
        title="تقرير الصيانة حسب الكلية / الجهة",
        filename=f"engiflow-company-{company_id}" if company_id else "engiflow-company-report",
        subtitle=subtitle,
        sheets=[
            ReportSheet(
                name="حسب الكلية والجهة",
                headers=[
                    "رقم الطلب",
                    "الكلية / الجهة",
                    "نوع العطل",
                    "الأولوية",
                    "الحالة",
                    "المهندس",
                    "التكلفة",
                    "التاريخ",
                ],
                rows=rows,
                summaries=[f"إجمالي التكلفة: {float(total_cost):,.2f}"],
            )
        ],
    )


def _engineer_report() -> ReportSpec:
    rows = []
    for engineer in EngineerProfile.objects.select_related("user").order_by("employee_id"):
        assigned = MaintenanceRequest.objects.filter(assigned_engineer=engineer)
        rows.append(
            [
                str(engineer),
                f"{engineer.department} ({engineer.employee_id})",
                "مهندس صيانة",
                SPECIALTY_AR.get(engineer.specialty, engineer.specialty),
                engineer.phone,
                engineer.user.email,
                engineer.experience_years,
                engineer.get_availability_status_display(),
                assigned.count(),
                assigned.filter(status__in=[MaintenanceRequest.Status.COMPLETED, MaintenanceRequest.Status.CLOSED]).count(),
                _money(assigned.aggregate(total=Sum("cost"))["total"] or Decimal("0")),
            ]
        )
    for engineer in PublicEngineer.objects.order_by("name"):
        assigned = MaintenanceRequest.objects.filter(assigned_public_engineer=engineer)
        rows.append(
            [
                engineer.name,
                engineer.department or "دليل عام",
                engineer.profession or "-",
                SPECIALTY_AR.get(engineer.specialty, engineer.specialty),
                engineer.phone,
                engineer.email or "-",
                engineer.experience_years,
                "متوفر" if engineer.is_available else "غير متوفر",
                assigned.count(),
                assigned.filter(status__in=[MaintenanceRequest.Status.COMPLETED, MaintenanceRequest.Status.CLOSED]).count(),
                _money(assigned.aggregate(total=Sum("cost"))["total"] or Decimal("0")),
            ]
        )
    rows.sort(key=lambda row: row[0])
    return ReportSpec(
        kind="engineer",
        title="تقرير الصيانة حسب المهندس",
        filename="engiflow-engineer-report",
        subtitle=f"عدد المهندسين: {len(rows)}",
        sheets=[
            ReportSheet(
                name="أداء المهندسين",
                headers=[
                    "المهندس",
                    "القسم / الرقم الوظيفي",
                    "المهنة",
                    "التخصص",
                    "الهاتف",
                    "البريد الإلكتروني",
                    "سنوات الخبرة",
                    "التوفر",
                    "الطلبات",
                    "المكتملة",
                    "التكلفة",
                ],
                rows=rows,
            )
        ],
    )


def _recurring_report() -> ReportSpec:
    grouped = (
        MaintenanceRequest.objects.values("issue_type")
        .annotate(total=Count("id"))
        .order_by("-total", "issue_type")
    )
    rows = [[SPECIALTY_AR.get(item["issue_type"], item["issue_type"]), item["total"]] for item in grouped]
    return ReportSpec(
        kind="recurring",
        title="تقرير الأعطال المتكررة",
        filename="engiflow-recurring-issues",
        subtitle=f"إجمالي أنواع الأعطال: {len(rows)}",
        sheets=[ReportSheet(name="الأعطال المتكررة", headers=["نوع العطل", "عدد الطلبات"], rows=rows)],
    )


def _cost_report() -> ReportSpec:
    queryset = _request_queryset().exclude(cost__isnull=True)
    total = queryset.aggregate(total=Sum("cost"))["total"] or Decimal("0")
    grouped = (
        queryset.values("client_company__company_name")
        .annotate(request_count=Count("id"), total_cost=Sum("cost"))
        .order_by("-total_cost", "client_company__company_name")
    )
    summary_rows = [
        [item["client_company__company_name"], item["request_count"], _money(item["total_cost"])]
        for item in grouped
    ]
    detail_rows = [
        [
            request.id,
            request.client_company.company_name,
            SPECIALTY_AR.get(request.issue_type, request.issue_type),
            STATUS_AR.get(request.status, request.status),
            _money(request.cost),
            _date(request.created_at),
        ]
        for request in queryset.order_by("-created_at")
    ]
    return ReportSpec(
        kind="cost",
        title="تقرير تكلفة الصيانة",
        filename="engiflow-maintenance-cost",
        subtitle=f"إجمالي التكلفة: {float(total):,.2f}",
        sheets=[
            ReportSheet(
                name="ملخص التكلفة",
                headers=["الكلية / الجهة", "عدد الطلبات", "إجمالي التكلفة"],
                rows=summary_rows,
                summaries=[f"إجمالي التكلفة: {float(total):,.2f}"],
            ),
            ReportSheet(
                name="تفاصيل التكلفة",
                headers=["رقم الطلب", "الكلية / الجهة", "نوع العطل", "الحالة", "التكلفة", "التاريخ"],
                rows=detail_rows,
            ),
        ],
    )


def build_report(
    kind: str,
    *,
    year: int | None = None,
    month: int | None = None,
    company_id: int | None = None,
) -> ReportSpec:
    if kind not in REPORT_KINDS:
        raise ValueError("Unknown report kind.")
    now = timezone.localtime()
    if kind == "monthly":
        return _monthly_report(year or now.year, month or now.month)
    if kind == "company":
        return _company_report(company_id)
    if kind == "engineer":
        return _engineer_report()
    if kind == "recurring":
        return _recurring_report()
    return _cost_report()
