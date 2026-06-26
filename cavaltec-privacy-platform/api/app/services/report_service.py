import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT


def _score_color(score: float) -> colors.Color:
    if score >= 80:
        return colors.HexColor("#27ae60")
    elif score >= 50:
        return colors.HexColor("#f39c12")
    return colors.HexColor("#e74c3c")


def _score_label(score: float) -> str:
    if score >= 80:
        return "CUMPLIMIENTO ALTO"
    elif score >= 50:
        return "CUMPLIMIENTO MEDIO"
    return "CUMPLIMIENTO BAJO"


def generate_pdf(assessment_data: dict) -> bytes:
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Title"],
        fontSize=22,
        textColor=colors.HexColor("#1a237e"),
        spaceAfter=6,
        alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "CustomSubtitle",
        parent=styles["Normal"],
        fontSize=12,
        textColor=colors.HexColor("#424242"),
        spaceAfter=4,
        alignment=TA_CENTER,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=colors.HexColor("#1a237e"),
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
    )
    score_style = ParagraphStyle(
        "Score",
        parent=styles["Normal"],
        fontSize=40,
        textColor=_score_color(assessment_data.get("score", 0)),
        alignment=TA_CENTER,
        spaceBefore=4,
        spaceAfter=4,
    )
    label_style = ParagraphStyle(
        "Label",
        parent=styles["Normal"],
        fontSize=14,
        textColor=_score_color(assessment_data.get("score", 0)),
        alignment=TA_CENTER,
        spaceAfter=8,
    )

    story = []

    story.append(Paragraph("CAVALTEC", title_style))
    story.append(Paragraph("Plataforma de Privacidad y Cumplimiento", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1a237e")))
    story.append(Spacer(1, 0.4 * cm))

    story.append(Paragraph("REPORTE DE AUTODIAGNÓSTICO", title_style))
    story.append(Paragraph("Ley 1581 de 2012 — Protección de Datos Personales Colombia", subtitle_style))
    story.append(Spacer(1, 0.6 * cm))

    meta_data = [
        ["Empresa:", assessment_data.get("company_name", "N/A")],
        ["NIT:", assessment_data.get("company_nit", "N/A")],
        ["Sector:", assessment_data.get("company_sector", "N/A")],
        ["Evaluado por:", assessment_data.get("user_name", "N/A")],
        ["Fecha:", assessment_data.get("completed_at", datetime.now().strftime("%Y-%m-%d %H:%M"))],
        ["ID Evaluación:", assessment_data.get("assessment_id", "N/A")],
    ]

    meta_table = Table(meta_data, colWidths=[4 * cm, 13 * cm])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#424242")),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 0.8 * cm))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bdbdbd")))
    story.append(Paragraph("RESULTADO GLOBAL", section_style))

    score = assessment_data.get("score", 0.0)
    story.append(Paragraph(f"{score}/100", score_style))
    story.append(Paragraph(_score_label(score), label_style))

    categories = {}
    answers = assessment_data.get("answers", {})
    from app.utils.questions import QUESTIONS

    for q in QUESTIONS:
        cat = q["category"]
        if cat not in categories:
            categories[cat] = {"earned": 0, "total": 0}
        ans = answers.get(q["id"])
        categories[cat]["total"] += q["weight"]
        if ans == "si":
            categories[cat]["earned"] += q["weight"]
        elif ans == "parcial":
            categories[cat]["earned"] += q["weight"] * 0.5

    cat_labels = {"politica": "Política de Datos", "diseno": "Privacidad desde el Diseño", "gobernanza": "Gobernanza"}
    cat_data = [["Categoría", "Puntaje Obtenido", "Puntaje Máximo", "%"]]
    for cat_id, vals in categories.items():
        pct = round((vals["earned"] / vals["total"]) * 100, 1) if vals["total"] else 0
        cat_data.append([cat_labels.get(cat_id, cat_id), f"{vals['earned']}", f"{vals['total']}", f"{pct}%"])

    cat_table = Table(cat_data, colWidths=[7 * cm, 4 * cm, 4 * cm, 2 * cm])
    cat_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a237e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f5f5"), colors.white]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bdbdbd")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(cat_table)
    story.append(Spacer(1, 0.6 * cm))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bdbdbd")))
    story.append(Paragraph("DETALLE DE RESPUESTAS", section_style))

    answer_labels = {"si": "Sí", "no": "No", "parcial": "Parcial", None: "Sin respuesta"}
    answers_data = [["ID", "Pregunta", "Referencia", "Respuesta"]]
    for q in QUESTIONS:
        ans = answers.get(q["id"])
        answers_data.append([
            q["id"],
            Paragraph(q["text"], ParagraphStyle("Small", fontSize=8, leading=11)),
            Paragraph(q["reference"], ParagraphStyle("SmallRef", fontSize=8, leading=11)),
            answer_labels.get(ans, ans or "—"),
        ])

    answer_table = Table(answers_data, colWidths=[1.2 * cm, 9 * cm, 4 * cm, 2.8 * cm])
    answer_style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a237e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (3, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f5f5"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bdbdbd")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
        ]
    )

    for i, q in enumerate(QUESTIONS, start=1):
        ans = answers.get(q["id"])
        if ans == "si":
            answer_style.add("TEXTCOLOR", (3, i), (3, i), colors.HexColor("#27ae60"))
        elif ans == "no":
            answer_style.add("TEXTCOLOR", (3, i), (3, i), colors.HexColor("#e74c3c"))
        elif ans == "parcial":
            answer_style.add("TEXTCOLOR", (3, i), (3, i), colors.HexColor("#f39c12"))

    answer_table.setStyle(answer_style)
    story.append(answer_table)
    story.append(Spacer(1, 0.6 * cm))

    gaps = assessment_data.get("gaps", [])
    gap_details = assessment_data.get("gap_details", [])

    if gap_details:
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bdbdbd")))
        story.append(Paragraph("BRECHAS IDENTIFICADAS", section_style))
        story.append(
            Paragraph(
                f"Se identificaron <b>{len(gap_details)}</b> brechas de cumplimiento que requieren atención:",
                body_style,
            )
        )
        story.append(Spacer(1, 0.3 * cm))

        gaps_data = [["ID", "Pregunta", "Referencia"]]
        for g in gap_details:
            gaps_data.append([
                g["id"],
                Paragraph(g["text"], ParagraphStyle("Small", fontSize=8, leading=11)),
                Paragraph(g["reference"], ParagraphStyle("SmallRef", fontSize=8, leading=11)),
            ])

        gaps_table = Table(gaps_data, colWidths=[1.2 * cm, 11 * cm, 4.8 * cm])
        gaps_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#c62828")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ALIGN", (0, 0), (0, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#ffebee"), colors.HexColor("#fff8f8")]),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#ef9a9a")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.append(gaps_table)
        story.append(Spacer(1, 0.6 * cm))

    recommendations = assessment_data.get("recommendations", [])
    if recommendations:
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bdbdbd")))
        story.append(Paragraph("RECOMENDACIONES", section_style))
        for rec in recommendations:
            story.append(Paragraph(f"• {rec}", body_style))
            story.append(Spacer(1, 0.2 * cm))
        story.append(Spacer(1, 0.4 * cm))

    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#bdbdbd")))
    footer_style = ParagraphStyle(
        "Footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#9e9e9e"),
        alignment=TA_CENTER,
    )
    story.append(
        Paragraph(
            "Este reporte es generado automáticamente por la plataforma Cavaltec Privacy. "
            "No constituye asesoría legal. Para una evaluación completa contacte a un experto jurídico.",
            footer_style,
        )
    )

    doc.build(story)
    return buffer.getvalue()
