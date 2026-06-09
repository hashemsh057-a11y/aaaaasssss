import io
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .data import ReportSpec


FONT_NAME = "Amiri"
FONT_PATH = Path(__file__).resolve().parent / "fonts" / "Amiri-Regular.ttf"
LOGO_PATH = Path(__file__).resolve().parents[2] / "frontend" / "public" / "engiflow-logo.png"


def _arabic(value) -> str:
    text = "-" if value is None else str(value)
    return get_display(arabic_reshaper.reshape(text))


def _register_font():
    if FONT_NAME not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont(FONT_NAME, str(FONT_PATH)))


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontName=FONT_NAME,
            fontSize=20,
            leading=26,
            alignment=1,
            textColor=colors.HexColor("#17312d"),
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=10,
            leading=15,
            alignment=1,
            textColor=colors.HexColor("#5d716b"),
        ),
        "section": ParagraphStyle(
            "ReportSection",
            parent=base["Heading2"],
            fontName=FONT_NAME,
            fontSize=13,
            leading=18,
            alignment=2,
            textColor=colors.HexColor("#17312d"),
            spaceAfter=8,
        ),
        "cell": ParagraphStyle(
            "ReportCell",
            parent=base["Normal"],
            fontName=FONT_NAME,
            fontSize=8,
            leading=11,
            alignment=1,
        ),
    }


def _footer(canvas, document):
    canvas.saveState()
    canvas.setFont(FONT_NAME, 9)
    canvas.setFillColor(colors.HexColor("#7088a0"))
    canvas.drawCentredString(landscape(A4)[0] / 2, 0.8 * cm, _arabic(f"EngiFlow - صفحة {document.page}"))
    canvas.restoreState()


def _table(sheet, styles):
    data = [[Paragraph(_arabic(value), styles["cell"]) for value in sheet.headers]]
    data.extend(
        [Paragraph(_arabic(value), styles["cell"]) for value in row]
        for row in sheet.rows
    )
    if not sheet.rows:
        data.append([Paragraph(_arabic("لا توجد بيانات متاحة."), styles["cell"])] + [""] * (len(sheet.headers) - 1))
    available_width = landscape(A4)[0] - 2.4 * cm
    table = Table(data, colWidths=[available_width / len(sheet.headers)] * len(sheet.headers), repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), FONT_NAME),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f8d86")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f3faf8"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cfe6e3")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def render_pdf(report: ReportSpec) -> HttpResponse:
    _register_font()
    styles = _styles()
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.3 * cm,
        title=report.title,
        author="EngiFlow",
    )
    story = []
    if LOGO_PATH.exists():
        story.append(Image(str(LOGO_PATH), width=1.8 * cm, height=1.8 * cm, hAlign="CENTER"))
    story.extend(
        [
            Paragraph(_arabic(report.title), styles["title"]),
            Paragraph(_arabic(report.subtitle), styles["subtitle"]),
            Paragraph(
                _arabic(f"تاريخ التوليد: {timezone.localtime().strftime('%Y-%m-%d %H:%M')}"),
                styles["subtitle"],
            ),
            Spacer(1, 12),
        ]
    )
    for index, sheet in enumerate(report.sheets):
        if index:
            story.append(PageBreak())
        story.append(Paragraph(_arabic(sheet.name), styles["section"]))
        story.append(_table(sheet, styles))
        for summary in sheet.summaries:
            story.extend([Spacer(1, 8), Paragraph(_arabic(summary), styles["section"])])
    document.build(story, onFirstPage=_footer, onLaterPages=_footer)
    payload = buffer.getvalue()
    response = HttpResponse(payload, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{report.filename}.pdf"'
    response["Content-Length"] = str(len(payload))
    return response
