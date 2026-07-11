from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_PATH = ROOT / "output" / "pdf" / "IsoAmplar_Plot_Analysis_User_Guide_KR.md"
PDF_PATH = ROOT / "output" / "pdf" / "IsoAmplar_Plot_Analysis_User_Guide_KR.pdf"
FONT_REGULAR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")

NAVY = colors.HexColor("#172033")
TEAL = colors.HexColor("#0F7895")
TEXT = colors.HexColor("#334155")
MUTED = colors.HexColor("#617085")
LINE = colors.HexColor("#D8E1EC")
LIGHT = colors.HexColor("#F4F7FA")
WARNING = colors.HexColor("#FFF8E6")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Malgun", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("Malgun-Bold", str(FONT_BOLD)))


def make_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "GuideTitle",
            parent=base["Title"],
            fontName="Malgun-Bold",
            fontSize=25,
            leading=34,
            textColor=NAVY,
            alignment=TA_LEFT,
            spaceAfter=8 * mm,
        ),
        "h2": ParagraphStyle(
            "GuideH2",
            parent=base["Heading2"],
            fontName="Malgun-Bold",
            fontSize=17,
            leading=23,
            textColor=NAVY,
            spaceAfter=5 * mm,
        ),
        "h3": ParagraphStyle(
            "GuideH3",
            parent=base["Heading3"],
            fontName="Malgun-Bold",
            fontSize=12,
            leading=17,
            textColor=TEAL,
            spaceBefore=2 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "GuideBody",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9.2,
            leading=14.2,
            textColor=TEXT,
            spaceAfter=2.2 * mm,
            wordWrap="CJK",
        ),
        "meta": ParagraphStyle(
            "GuideMeta",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9,
            leading=14,
            textColor=MUTED,
            leftIndent=4 * mm,
            bulletIndent=0,
            bulletFontName="Malgun",
            spaceAfter=1.5 * mm,
        ),
        "bullet": ParagraphStyle(
            "GuideBullet",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9.1,
            leading=14,
            textColor=TEXT,
            leftIndent=5 * mm,
            firstLineIndent=-3.2 * mm,
            bulletIndent=0,
            bulletFontName="Malgun",
            spaceAfter=1.5 * mm,
            wordWrap="CJK",
        ),
        "number": ParagraphStyle(
            "GuideNumber",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=9.1,
            leading=14,
            textColor=TEXT,
            leftIndent=7 * mm,
            firstLineIndent=-5 * mm,
            bulletIndent=0,
            spaceAfter=1.5 * mm,
            wordWrap="CJK",
        ),
        "caption": ParagraphStyle(
            "GuideCaption",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=8,
            leading=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=1.2 * mm,
            spaceAfter=2.5 * mm,
        ),
        "table": ParagraphStyle(
            "GuideTable",
            parent=base["BodyText"],
            fontName="Malgun",
            fontSize=7.7,
            leading=11.2,
            textColor=TEXT,
            wordWrap="CJK",
        ),
        "table_header": ParagraphStyle(
            "GuideTableHeader",
            parent=base["BodyText"],
            fontName="Malgun-Bold",
            fontSize=7.8,
            leading=11.4,
            textColor=NAVY,
            wordWrap="CJK",
        ),
        "code": ParagraphStyle(
            "GuideCode",
            parent=base["Code"],
            fontName="Malgun",
            fontSize=7.8,
            leading=11.5,
            textColor=NAVY,
            backColor=LIGHT,
            borderColor=LINE,
            borderWidth=0.5,
            borderPadding=7,
            leftIndent=2 * mm,
            rightIndent=2 * mm,
            spaceAfter=3 * mm,
        ),
    }


def escape_markup(value: str) -> str:
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline_markup(value: str) -> str:
    escaped = escape_markup(value)
    escaped = re.sub(r"`([^`]+)`", r"<font name='Malgun-Bold'>\1</font>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    return escaped


def parse_table(lines: list[str], styles: dict[str, ParagraphStyle]) -> LongTable:
    rows: list[list[str]] = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append(cells)

    column_count = max(len(row) for row in rows)
    normalized = [row + [""] * (column_count - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = styles["table_header"] if row_index == 0 else styles["table"]
        data.append([Paragraph(inline_markup(cell), style) for cell in row])

    usable_width = A4[0] - 30 * mm
    if column_count == 2:
        widths = [usable_width * 0.28, usable_width * 0.72]
    elif column_count == 3:
        widths = [usable_width * 0.22, usable_width * 0.39, usable_width * 0.39]
    else:
        widths = [usable_width / column_count] * column_count

    table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF1F6")),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFBFC")]),
            ]
        )
    )
    return table


def image_flowable(markdown_path: Path, alt: str, source: str, styles: dict[str, ParagraphStyle]):
    image_path = (markdown_path.parent / source).resolve()
    reader = ImageReader(str(image_path))
    width, height = reader.getSize()
    max_width = A4[0] - 32 * mm
    max_height = 118 * mm if width >= height else 150 * mm
    scale = min(max_width / width, max_height / height)
    image = Image(str(image_path), width=width * scale, height=height * scale)
    image.hAlign = "CENTER"
    return KeepTogether([image, Paragraph(inline_markup(alt), styles["caption"])])


def build_story(markdown_path: Path, styles: dict[str, ParagraphStyle]):
    lines = markdown_path.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph_buffer: list[str] = []
    section_count = 0
    index = 0

    def flush_paragraph() -> None:
        if paragraph_buffer:
            story.append(Paragraph(inline_markup(" ".join(paragraph_buffer)), styles["body"]))
            paragraph_buffer.clear()

    while index < len(lines):
        line = lines[index].rstrip()

        if line.startswith("```"):
            flush_paragraph()
            code_lines = []
            index += 1
            while index < len(lines) and not lines[index].startswith("```"):
                code_lines.append(lines[index])
                index += 1
            story.append(Preformatted("\n".join(code_lines), styles["code"]))
        elif line.startswith("| "):
            flush_paragraph()
            table_lines = []
            while index < len(lines) and lines[index].startswith("|"):
                table_lines.append(lines[index])
                index += 1
            story.append(parse_table(table_lines, styles))
            story.append(Spacer(1, 3 * mm))
            continue
        elif line.startswith("# "):
            flush_paragraph()
            story.append(Spacer(1, 22 * mm))
            story.append(Paragraph(inline_markup(line[2:]), styles["title"]))
            story.append(Paragraph("LAMP amplification fluorescence analysis guide", styles["meta"]))
            story.append(Spacer(1, 5 * mm))
        elif line.startswith("## "):
            flush_paragraph()
            section_count += 1
            story.append(PageBreak())
            story.append(Paragraph(inline_markup(line[3:]), styles["h2"]))
        elif line.startswith("### "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(line[4:]), styles["h3"]))
        elif re.match(r"^!\[.*\]\(.*\)$", line):
            flush_paragraph()
            match = re.match(r"^!\[(.*)\]\((.*)\)$", line)
            if match:
                story.append(image_flowable(markdown_path, match.group(1), match.group(2), styles))
        elif line.startswith("- "):
            flush_paragraph()
            story.append(Paragraph(inline_markup(line[2:]), styles["bullet"], bulletText="-"))
        elif re.match(r"^\d+\. ", line):
            flush_paragraph()
            match = re.match(r"^(\d+)\. (.*)$", line)
            if match:
                story.append(Paragraph(inline_markup(match.group(2)), styles["number"], bulletText=f"{match.group(1)}."))
        elif line.strip() == "":
            flush_paragraph()
        else:
            paragraph_buffer.append(line.strip())

        index += 1

    flush_paragraph()
    return story


def draw_page(canvas, doc) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.6)
    canvas.line(15 * mm, height - 14 * mm, width - 15 * mm, height - 14 * mm)
    canvas.setFont("Malgun-Bold", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(15 * mm, height - 10 * mm, "IsoAmplar Plot Analysis User Guide")
    canvas.setFont("Malgun", 8)
    canvas.drawRightString(width - 15 * mm, 10 * mm, str(doc.page))
    canvas.restoreState()


def main() -> None:
    register_fonts()
    styles = make_styles()
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="IsoAmplar Plot Analysis 최초 사용자용 상세 가이드",
        author="Jang Si Un",
        subject="IsoAmplar Plot Analysis user guide using synthetic example data",
    )
    story = build_story(MARKDOWN_PATH, styles)
    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)
    print(PDF_PATH)


if __name__ == "__main__":
    main()
