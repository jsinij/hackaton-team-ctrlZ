import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.charts.barcharts import HorizontalBarChart


PAGE_W, PAGE_H = A4
MARGIN = 2.2 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

COLOR_PRIMARY = colors.HexColor("#1a237e")
COLOR_PRIMARY_LIGHT = colors.HexColor("#3949ab")
COLOR_ACCENT = colors.HexColor("#00897b")
COLOR_GREEN = colors.HexColor("#2e7d32")
COLOR_AMBER = colors.HexColor("#f57f17")
COLOR_RED = colors.HexColor("#c62828")
COLOR_GRAY = colors.HexColor("#616161")
COLOR_LIGHT_GRAY = colors.HexColor("#f5f5f5")
COLOR_BORDER = colors.HexColor("#e0e0e0")
COLOR_TEXT = colors.HexColor("#212121")
COLOR_TEXT_SECONDARY = colors.HexColor("#757575")


def _score_color(score: float) -> colors.Color:
    if score >= 80:
        return COLOR_GREEN
    elif score >= 50:
        return COLOR_AMBER
    return COLOR_RED


def _score_label(score: float) -> str:
    if score >= 80:
        return "CUMPLIMIENTO ALTO"
    elif score >= 50:
        return "CUMPLIMIENTO MEDIO"
    return "CUMPLIMIENTO BAJO"


def _answer_icon(ans: str) -> str:
    if ans == "si":
        return "SI"
    elif ans == "no":
        return "NO"
    elif ans == "parcial":
        return "PARC"
    return "N/A"


def _answer_color(ans: str) -> colors.Color:
    if ans == "si":
        return COLOR_GREEN
    elif ans == "no":
        return COLOR_RED
    elif ans == "parcial":
        return COLOR_AMBER
    return COLOR_GRAY


def _build_score_bar(score: float) -> Drawing:
    d = Drawing(CONTENT_W, 50)
    bar_y = 10
    bar_h = 20
    bg_color = colors.HexColor("#e8eaf6")
    fill_color = _score_color(score)

    d.add(Rect(0, bar_y, CONTENT_W, bar_h, fillColor=bg_color, strokeColor=None, rx=4, ry=4))

    fill_w = max(4, (score / 100) * CONTENT_W)
    d.add(Rect(0, bar_y, fill_w, bar_h, fillColor=fill_color, strokeColor=None, rx=4, ry=4))

    d.add(String(
        CONTENT_W / 2, bar_y + bar_h / 2,
        f"{score}/100  -  {_score_label(score)}",
        fontSize=11, fillColor=colors.white if score > 15 else COLOR_TEXT,
        textAnchor="middle",
    ))

    for mark in [25, 50, 80]:
        x = (mark / 100) * CONTENT_W
        d.add(Rect(x - 0.5, bar_y - 3, 1, bar_h + 6, fillColor=colors.HexColor("#bdbdbd"), strokeColor=None))

    return d


def _header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(COLOR_PRIMARY)
    canvas.setLineWidth(2)
    canvas.line(MARGIN, PAGE_H - MARGIN + 10, PAGE_W - MARGIN, PAGE_H - MARGIN + 10)

    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(COLOR_TEXT_SECONDARY)
    canvas.drawString(MARGIN, MARGIN - 15, "Cavaltec Privacy Platform - Autodiagnostico Ley 1581")
    canvas.drawRightString(PAGE_W - MARGIN, MARGIN - 15, f"Pagina {doc.page}")
    canvas.setStrokeColor(COLOR_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, MARGIN - 5, PAGE_W - MARGIN, MARGIN - 5)
    canvas.restoreState()


def generate_pdf(assessment_data: dict) -> bytes:
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=MARGIN,
        leftMargin=MARGIN,
        topMargin=MARGIN + 0.5 * cm,
        bottomMargin=MARGIN + 0.3 * cm,
    )

    styles = getSampleStyleSheet()

    s_title = ParagraphStyle(
        "ReportTitle", parent=styles["Title"],
        fontSize=20, textColor=COLOR_PRIMARY,
        spaceAfter=2, spaceBefore=0, alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    )
    s_subtitle = ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontSize=11, textColor=COLOR_GRAY,
        spaceAfter=2, alignment=TA_CENTER,
    )
    s_section = ParagraphStyle(
        "SectionHead", parent=styles["Heading2"],
        fontSize=12, textColor=COLOR_PRIMARY,
        spaceBefore=12, spaceAfter=6,
        fontName="Helvetica-Bold",
        borderWidth=0, borderPadding=0,
    )
    s_body = ParagraphStyle(
        "BodyText", parent=styles["Normal"],
        fontSize=9.5, leading=13, textColor=COLOR_TEXT,
    )
    s_small = ParagraphStyle(
        "CellSmall", parent=styles["Normal"],
        fontSize=8, leading=10.5, textColor=COLOR_TEXT,
    )
    s_small_ref = ParagraphStyle(
        "CellRef", parent=styles["Normal"],
        fontSize=7.5, leading=10, textColor=COLOR_TEXT_SECONDARY,
        fontName="Helvetica-Oblique",
    )
    s_footer = ParagraphStyle(
        "FooterNote", parent=styles["Normal"],
        fontSize=7.5, textColor=COLOR_TEXT_SECONDARY,
        alignment=TA_CENTER, leading=10,
    )

    story = []

    # ── PORTADA / ENCABEZADO ──────────────────────────────────────────────
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("CAVALTEC", s_title))
    story.append(Paragraph("Plataforma de Privacidad y Cumplimiento", s_subtitle))
    story.append(Spacer(1, 0.15 * cm))
    story.append(HRFlowable(width="100%", thickness=2, color=COLOR_PRIMARY))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("REPORTE DE AUTODIAGNOSTICO", ParagraphStyle(
        "SubTitle2", parent=s_title, fontSize=14, spaceAfter=2,
    )))
    story.append(Paragraph(
        "Ley 1581 de 2012 &mdash; Proteccion de Datos Personales Colombia",
        s_subtitle,
    ))
    story.append(Spacer(1, 0.5 * cm))

    # ── DATOS DE LA EMPRESA ───────────────────────────────────────────────
    meta_data = [
        ["Empresa:", assessment_data.get("company_name", "N/A")],
        ["NIT:", assessment_data.get("company_nit", "N/A")],
        ["Sector:", assessment_data.get("company_sector", "N/A")],
        ["Evaluado por:", assessment_data.get("user_name", "N/A")],
        ["Fecha:", assessment_data.get("completed_at", datetime.now().strftime("%Y-%m-%d %H:%M"))],
        ["ID Evaluacion:", assessment_data.get("assessment_id", "N/A")],
    ]

    meta_table = Table(meta_data, colWidths=[4 * cm, CONTENT_W - 4 * cm])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), COLOR_GRAY),
        ("TEXTCOLOR", (1, 0), (1, -1), COLOR_TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, COLOR_BORDER),
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_LIGHT_GRAY),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 0.6 * cm))

    # ── RESULTADO GLOBAL ──────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY))
    story.append(Paragraph("RESULTADO GLOBAL", s_section))

    score = assessment_data.get("score", 0.0)
    story.append(_build_score_bar(score))
    story.append(Spacer(1, 0.4 * cm))

    # ── DESGLOSE POR CATEGORIA ────────────────────────────────────────────
    categories = {}
    answers = assessment_data.get("answers", {})
    from app.utils.questions import QUESTIONS

    for q in QUESTIONS:
        cat = q["category"]
        if cat not in categories:
            categories[cat] = {"earned": 0, "total": 0, "answered": 0}
        ans = answers.get(q["id"])
        categories[cat]["total"] += q["weight"]
        if ans == "si":
            categories[cat]["earned"] += q["weight"]
            categories[cat]["answered"] += 1
        elif ans == "parcial":
            categories[cat]["earned"] += q["weight"] * 0.5
            categories[cat]["answered"] += 1

    cat_labels = {
        "politica": "Politica de Datos",
        "diseno": "Privacidad desde el Diseno",
        "gobernanza": "Gobernanza",
    }
    cat_icons = {
        "politica": "I",
        "diseno": "D",
        "gobernanza": "G",
    }

    col1_w = 6.5 * cm
    col2_w = 3 * cm
    col3_w = 3 * cm
    col4_w = CONTENT_W - col1_w - col2_w - col3_w

    cat_data = [["Categoria", "Puntaje", "Maximo", "%"]]
    for cat_id, vals in categories.items():
        pct = round((vals["earned"] / vals["total"]) * 100, 1) if vals["total"] else 0
        cat_data.append([
            cat_labels.get(cat_id, cat_id),
            f"{vals['earned']:.0f}",
            f"{vals['total']:.0f}",
            f"{pct}%",
        ])

    cat_table = Table(cat_data, colWidths=[col1_w, col2_w, col3_w, col4_w])
    cat_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDER),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]

    for i, (cat_id, vals) in enumerate(categories.items(), start=1):
        pct = (vals["earned"] / vals["total"] * 100) if vals["total"] else 0
        c = _score_color(pct)
        cat_style_cmds.append(("TEXTCOLOR", (3, i), (3, i), c))
        cat_style_cmds.append(("FONTNAME", (3, i), (3, i), "Helvetica-Bold"))

    cat_table.setStyle(TableStyle(cat_style_cmds))
    story.append(cat_table)
    story.append(Spacer(1, 0.6 * cm))

    # ── DETALLE DE RESPUESTAS ─────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_PRIMARY))
    story.append(Paragraph("DETALLE DE RESPUESTAS", s_section))

    answer_labels = {"si": "Si", "no": "No", "parcial": "Parcial", None: "Sin respuesta"}

    c1 = 1.1 * cm
    c2 = (CONTENT_W - c1) * 0.55
    c3 = (CONTENT_W - c1) * 0.25
    c4 = (CONTENT_W - c1) * 0.2

    answers_data = [["ID", "Pregunta", "Referencia", "Respuesta"]]
    for q in QUESTIONS:
        ans = answers.get(q["id"])
        answers_data.append([
            Paragraph(f"<b>{q['id']}</b>", ParagraphStyle("CellId", fontSize=8, alignment=TA_CENTER, textColor=COLOR_PRIMARY)),
            Paragraph(q["text"], s_small),
            Paragraph(q["reference"], s_small_ref),
            Paragraph(
                f'<font color="{_answer_color(ans).hexval()}">{answer_labels.get(ans, ans or "N/A")}</font>',
                ParagraphStyle("CellAns", fontSize=8.5, alignment=TA_CENTER, fontName="Helvetica-Bold"),
            ),
        ])

    answer_table = Table(answers_data, colWidths=[c1, c2, c3, c4], repeatRows=1)
    ans_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (3, 0), (3, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_LIGHT_GRAY]),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDER),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]

    for i, q in enumerate(QUESTIONS, start=1):
        ans = answers.get(q["id"])
        bg = _answer_color(ans) if ans else COLOR_GRAY
        if ans == "si":
            ans_style_cmds.append(("BACKGROUND", (3, i), (3, i), colors.HexColor("#e8f5e9")))
        elif ans == "no":
            ans_style_cmds.append(("BACKGROUND", (3, i), (3, i), colors.HexColor("#ffebee")))
        elif ans == "parcial":
            ans_style_cmds.append(("BACKGROUND", (3, i), (3, i), colors.HexColor("#fff8e1")))

    answer_table.setStyle(TableStyle(ans_style_cmds))
    story.append(answer_table)
    story.append(Spacer(1, 0.6 * cm))

    # ── BRECHAS IDENTIFICADAS ─────────────────────────────────────────────
    gaps = assessment_data.get("gaps", [])
    gap_details = assessment_data.get("gap_details", [])

    if gap_details:
        story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_RED))
        story.append(Paragraph("BRECHAS IDENTIFICADAS", ParagraphStyle(
            "SectionRed", parent=s_section, textColor=COLOR_RED,
        )))

        summary_box = Table(
            [[Paragraph(
                f'<font color="{COLOR_RED.hexval()}"><b>{len(gap_details)}</b></font> brecha(s) de cumplimiento identificadas que requieren atencion inmediata.',
                ParagraphStyle("SummaryText", fontSize=10, leading=14, textColor=COLOR_TEXT),
            )]],
            colWidths=[CONTENT_W],
        )
        summary_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#ffebee")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#ef9a9a")),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(summary_box)
        story.append(Spacer(1, 0.3 * cm))

        gc1 = 1.1 * cm
        gc2 = (CONTENT_W - gc1) * 0.6
        gc3 = (CONTENT_W - gc1) * 0.4

        gaps_data = [["ID", "Pregunta", "Referencia"]]
        for g in gap_details:
            gaps_data.append([
                Paragraph(f'<b>{g["id"]}</b>', ParagraphStyle("GapId", fontSize=8, alignment=TA_CENTER, textColor=COLOR_RED)),
                Paragraph(g["text"], s_small),
                Paragraph(g["reference"], s_small_ref),
            ])

        gaps_table = Table(gaps_data, colWidths=[gc1, gc2, gc3], repeatRows=1)
        gaps_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_RED),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#fff8f8"), colors.HexColor("#ffebee")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ef9a9a")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(gaps_table)
        story.append(Spacer(1, 0.6 * cm))

    # ── RECOMENDACIONES ───────────────────────────────────────────────────
    recommendations = assessment_data.get("recommendations", [])
    if recommendations:
        story.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_ACCENT))
        story.append(Paragraph("RECOMENDACIONES", ParagraphStyle(
            "SectionAccent", parent=s_section, textColor=COLOR_ACCENT,
        )))
        for idx, rec in enumerate(recommendations, 1):
            rec_box = Table(
                [[Paragraph(f"<b>{idx}.</b>  {rec}", ParagraphStyle(
                    "RecText", fontSize=9, leading=12.5, textColor=COLOR_TEXT,
                ))]],
                colWidths=[CONTENT_W],
            )
            rec_box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#e0f2f1")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#80cbc4")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(rec_box)
            story.append(Spacer(1, 0.15 * cm))
        story.append(Spacer(1, 0.4 * cm))

    # ── DISCLAIMER / FOOTER ───────────────────────────────────────────────
    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDER))
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph(
        "Este reporte es generado automaticamente por la plataforma Cavaltec Privacy. "
        "No constituye asesoria legal. Para una evaluacion completa contacte a un experto juridico.",
        s_footer,
    ))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()
