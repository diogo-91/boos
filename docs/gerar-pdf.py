"""Gera os PDFs da documentacao a partir dos markdown em docs/.

Uso, a partir da raiz do projeto:

    pip install reportlab
    python docs/gerar-pdf.py .

Saida em docs/pdf/. As fontes vem do Windows: Arial para texto e Consolas para
codigo — Consolas e necessaria porque cobre os caracteres de box drawing usados
nos diagramas, que as fontes padrao do reportlab nao tem.
"""

import html
import os
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    CondPageBreak,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)
from reportlab.platypus.tableofcontents import TableOfContents

# ---------------------------------------------------------------- fontes ----

WIN_FONTS = "C:/Windows/Fonts"


def register_fonts():
    faces = [
        ("Body", "arial.ttf"),
        ("Body-Bold", "arialbd.ttf"),
        ("Body-Italic", "ariali.ttf"),
        ("Body-BoldItalic", "arialbi.ttf"),
        ("Mono", "consola.ttf"),
        ("Mono-Bold", "consolab.ttf"),
    ]
    for name, filename in faces:
        pdfmetrics.registerFont(TTFont(name, os.path.join(WIN_FONTS, filename)))

    pdfmetrics.registerFontFamily(
        "Body",
        normal="Body",
        bold="Body-Bold",
        italic="Body-Italic",
        boldItalic="Body-BoldItalic",
    )
    pdfmetrics.registerFontFamily("Mono", normal="Mono", bold="Mono-Bold")


# ----------------------------------------------------------------- cores ----

NAVY_900 = colors.HexColor("#10233f")
NAVY_800 = colors.HexColor("#16365f")
NAVY_700 = colors.HexColor("#1d477c")
SLATE_900 = colors.HexColor("#0f172a")
SLATE_700 = colors.HexColor("#334155")
SLATE_500 = colors.HexColor("#64748b")
SLATE_300 = colors.HexColor("#cbd5e1")
SLATE_200 = colors.HexColor("#e2e8f0")
SLATE_100 = colors.HexColor("#f1f5f9")
SLATE_50 = colors.HexColor("#f8fafc")
CODE_BG = colors.HexColor("#f6f8fa")
AMBER_BG = colors.HexColor("#fffbeb")
AMBER_LINE = colors.HexColor("#f59e0b")

PAGE_W, PAGE_H = A4
MARGIN_L = MARGIN_R = 2.0 * cm
MARGIN_T = 2.0 * cm
MARGIN_B = 1.8 * cm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R


# ---------------------------------------------------------------- estilos ----


def build_styles():
    ss = getSampleStyleSheet()
    s = {}

    s["body"] = ParagraphStyle(
        "body",
        parent=ss["Normal"],
        fontName="Body",
        fontSize=9.5,
        leading=14.5,
        textColor=SLATE_700,
        alignment=TA_JUSTIFY,
        spaceAfter=7,
    )
    s["h1"] = ParagraphStyle(
        "h1",
        fontName="Body-Bold",
        fontSize=19,
        leading=24,
        textColor=NAVY_900,
        spaceBefore=0,
        spaceAfter=4,
    )
    s["h2"] = ParagraphStyle(
        "h2",
        fontName="Body-Bold",
        fontSize=14,
        leading=19,
        textColor=NAVY_800,
        spaceBefore=17,
        spaceAfter=7,
    )
    s["h3"] = ParagraphStyle(
        "h3",
        fontName="Body-Bold",
        fontSize=11,
        leading=15,
        textColor=NAVY_700,
        spaceBefore=13,
        spaceAfter=5,
    )
    s["h4"] = ParagraphStyle(
        "h4",
        fontName="Body-Bold",
        fontSize=9.8,
        leading=13,
        textColor=SLATE_900,
        spaceBefore=10,
        spaceAfter=4,
    )
    s["li"] = ParagraphStyle(
        "li",
        parent=s["body"],
        leftIndent=13,
        bulletIndent=3,
        spaceAfter=3.5,
        alignment=TA_LEFT,
    )
    s["quote"] = ParagraphStyle(
        "quote",
        parent=s["body"],
        leftIndent=9,
        rightIndent=5,
        textColor=colors.HexColor("#78350f"),
        alignment=TA_LEFT,
        spaceBefore=3,
        spaceAfter=3,
        fontSize=9,
        leading=13.5,
    )
    s["code"] = ParagraphStyle(
        "code",
        fontName="Mono",
        fontSize=8,
        leading=10.6,
        textColor=SLATE_900,
        leftIndent=0,
        spaceBefore=0,
        spaceAfter=0,
    )
    s["th"] = ParagraphStyle(
        "th",
        fontName="Body-Bold",
        fontSize=8.3,
        leading=11,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    s["td"] = ParagraphStyle(
        "td",
        fontName="Body",
        fontSize=8.3,
        leading=11.2,
        textColor=SLATE_700,
        alignment=TA_LEFT,
    )
    s["cover_title"] = ParagraphStyle(
        "cover_title",
        fontName="Body-Bold",
        fontSize=27,
        leading=33,
        textColor=NAVY_900,
        alignment=TA_CENTER,
    )
    s["cover_sub"] = ParagraphStyle(
        "cover_sub",
        fontName="Body",
        fontSize=13,
        leading=19,
        textColor=SLATE_500,
        alignment=TA_CENTER,
    )
    s["cover_meta"] = ParagraphStyle(
        "cover_meta",
        fontName="Body",
        fontSize=9.5,
        leading=15,
        textColor=SLATE_500,
        alignment=TA_CENTER,
    )
    s["toc1"] = ParagraphStyle(
        "toc1",
        fontName="Body-Bold",
        fontSize=10.5,
        leading=19,
        textColor=NAVY_800,
        spaceBefore=7,
    )
    s["toc2"] = ParagraphStyle(
        "toc2", fontName="Body", fontSize=9.3, leading=15, textColor=SLATE_700, leftIndent=15
    )
    s["toc3"] = ParagraphStyle(
        "toc3", fontName="Body", fontSize=8.6, leading=13, textColor=SLATE_500, leftIndent=30
    )
    return s


STYLES = None


# ---------------------------------------------------------------- inline ----

CODE_TOKEN = "\x00CODE%d\x00"


def inline(text, code_color="#9d174d", code_size="8.2"):
    """Converte markdown inline em marcacao do reportlab."""
    spans = []

    def stash(m):
        spans.append(m.group(1))
        return CODE_TOKEN % (len(spans) - 1)

    text = re.sub(r"`([^`]+)`", stash, text)
    text = html.escape(text, quote=False)

    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<i>\1</i>", text)

    for i, raw in enumerate(spans):
        code = html.escape(raw, quote=False)
        text = text.replace(
            CODE_TOKEN % i,
            f'<font face="Mono" size="{code_size}" color="{code_color}">{code}</font>',
        )
    return text


# ----------------------------------------------------------------- parser ----


def parse_blocks(md):
    """Quebra o markdown em blocos tipados."""
    lines = md.split("\n")
    blocks = []
    i = 0
    n = len(lines)

    while i < n:
        line = lines[i]

        if not line.strip():
            i += 1
            continue

        # bloco de codigo
        if line.lstrip().startswith("```"):
            i += 1
            buf = []
            while i < n and not lines[i].lstrip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            blocks.append(("code", buf))
            continue

        # titulo
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            blocks.append(("h", (len(m.group(1)), m.group(2).strip())))
            i += 1
            continue

        # regua
        if re.match(r"^\s*(-{3,}|\*{3,}|_{3,})\s*$", line):
            blocks.append(("hr", None))
            i += 1
            continue

        # tabela
        if line.lstrip().startswith("|") and i + 1 < n and re.match(
            r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]
        ):
            rows = []
            while i < n and lines[i].lstrip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            blocks.append(("table", rows))
            continue

        # citacao
        if line.lstrip().startswith(">"):
            buf = []
            while i < n and lines[i].lstrip().startswith(">"):
                buf.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            blocks.append(("quote", buf))
            continue

        # listas
        if re.match(r"^\s*[-*]\s+", line):
            items, i = collect_list(lines, i, r"^\s*[-*]\s+")
            blocks.append(("ul", items))
            continue

        if re.match(r"^\s*\d+\.\s+", line):
            # preserva o numero inicial: uma lista retomada apos tabela ou
            # bloco de codigo precisa continuar de onde parou
            start = int(re.match(r"^\s*(\d+)\.", line).group(1))
            items, i = collect_list(lines, i, r"^\s*\d+\.\s+")
            blocks.append(("ol", (start, items)))
            continue

        # paragrafo
        buf = []
        while i < n and lines[i].strip():
            nxt = lines[i]
            if (
                re.match(r"^#{1,6}\s", nxt)
                or nxt.lstrip().startswith("```")
                or nxt.lstrip().startswith("|")
                or nxt.lstrip().startswith(">")
                or re.match(r"^\s*[-*]\s+", nxt)
                or re.match(r"^\s*\d+\.\s+", nxt)
                or re.match(r"^\s*(-{3,})\s*$", nxt)
            ):
                break
            buf.append(nxt.strip())
            i += 1
        if buf:
            blocks.append(("p", " ".join(buf)))
        else:
            i += 1

    return blocks


def collect_list(lines, i, marker):
    """Junta itens de lista, incluindo continuacoes indentadas."""
    items = []
    n = len(lines)
    while i < n:
        m = re.match(marker, lines[i])
        if m:
            items.append(lines[i][m.end():].strip())
            i += 1
            while (
                i < n
                and lines[i].strip()
                and lines[i].startswith(("  ", "\t"))
                and not re.match(r"^\s*[-*]\s+", lines[i])
                and not re.match(r"^\s*\d+\.\s+", lines[i])
            ):
                items[-1] += " " + lines[i].strip()
                i += 1
        elif not lines[i].strip():
            break
        else:
            break
    return items, i


# -------------------------------------------------------------- flowables ----


def split_row(row):
    row = row.strip()
    if row.startswith("|"):
        row = row[1:]
    if row.endswith("|"):
        row = row[:-1]
    # so o pipe pode vir escapado; qualquer outra barra invertida e literal
    parts, cur, i = [], "", 0
    while i < len(row):
        ch = row[i]
        if ch == "\\" and i + 1 < len(row) and row[i + 1] == "|":
            cur += "|"
            i += 2
            continue
        if ch == "|":
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
        i += 1
    parts.append(cur.strip())
    return parts


def plain_len(cell):
    """Comprimento aproximado sem marcacao, para dimensionar colunas."""
    t = re.sub(r"`([^`]+)`", r"\1", cell)
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"\*+", "", t)
    return len(t)


def make_table(rows, avail_w):
    header = split_row(rows[0])
    body = [split_row(r) for r in rows[2:]]
    ncols = len(header)
    body = [r + [""] * (ncols - len(r)) if len(r) < ncols else r[:ncols] for r in body]

    # largura proporcional ao maior conteudo da coluna, com piso e teto
    weights = []
    for c in range(ncols):
        longest = max([plain_len(header[c])] + [plain_len(r[c]) for r in body] or [1])
        typical = sum(plain_len(r[c]) for r in body) / max(len(body), 1)
        weights.append(max(6.0, min(float(longest), typical * 2.2 + 8)))

    total = sum(weights)
    widths = [avail_w * w / total for w in weights]

    min_w = 1.55 * cm
    if ncols * min_w < avail_w:
        deficit = sum(min_w - w for w in widths if w < min_w)
        if deficit > 0:
            donors = [i for i, w in enumerate(widths) if w > min_w]
            pool = sum(widths[i] - min_w for i in donors)
            for i in donors:
                widths[i] -= deficit * (widths[i] - min_w) / pool
            widths = [max(w, min_w) for w in widths]

    # no cabecalho o fundo e navy, entao o code span vai claro em vez de vinho
    data = [
        [Paragraph(inline(c, code_color="#dbeafe", code_size="8.0"), STYLES["th"]) for c in header]
    ]
    for r in body:
        data.append([Paragraph(inline(c), STYLES["td"]) for c in r])

    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY_800),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, SLATE_200),
        ("BOX", (0, 0), (-1, -1), 0.6, SLATE_300),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, NAVY_900),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), SLATE_50))

    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle(style))
    return t


def make_code(lines, avail_w):
    """Bloco de codigo em caixa; encolhe a fonte para nao quebrar diagramas."""
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines:
        return Spacer(1, 1)

    longest = max(len(l) for l in lines)
    pad = 12
    size = 8.0
    usable = avail_w - 2 * pad
    char_w = pdfmetrics.stringWidth("0", "Mono", size)
    if longest * char_w > usable:
        size = max(5.2, size * usable / (longest * char_w))

    style = ParagraphStyle(
        "codeblk", parent=STYLES["code"], fontSize=size, leading=size * 1.34
    )
    text = html.escape("\n".join(lines), quote=False)
    inner = XPreformatted(text, style)

    t = Table([[inner]], colWidths=[avail_w], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                ("BOX", (0, 0), (-1, -1), 0.5, SLATE_200),
                ("LEFTPADDING", (0, 0), (-1, -1), pad),
                ("RIGHTPADDING", (0, 0), (-1, -1), pad),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def make_quote(lines, avail_w):
    text = inline(" ".join(l.strip() for l in lines if l.strip()))
    inner = Paragraph(text, STYLES["quote"])
    t = Table([[inner]], colWidths=[avail_w], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), AMBER_BG),
                ("LINEBEFORE", (0, 0), (0, -1), 2.4, AMBER_LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


HEADING_STYLE = {1: "h1", 2: "h2", 3: "h3", 4: "h4", 5: "h4", 6: "h4"}


def blocks_to_flowables(blocks, level_offset=0, skip_titles=(), avail_w=CONTENT_W):
    out = []
    skipping_at = None

    for kind, payload in blocks:
        if kind == "h":
            level, text = payload
            if skipping_at is not None:
                if level <= skipping_at:
                    skipping_at = None
                else:
                    continue
            if text.strip().lower() in skip_titles:
                skipping_at = level
                continue

            lvl = min(level + level_offset, 6)
            text = re.sub(r"^\d+\.\s+", "", text)
            style = STYLES[HEADING_STYLE[lvl]]
            para = Paragraph(inline(text), style)
            para._toc_level = lvl
            para._toc_text = re.sub(r"<[^>]+>", "", inline(text))
            # evita titulo orfao no rodape: exige espaco util logo abaixo
            out.append(CondPageBreak(4.5 * cm if lvl <= 2 else 2.8 * cm))
            out.append(para)
            continue

        if skipping_at is not None:
            continue

        if kind == "p":
            out.append(Paragraph(inline(payload), STYLES["body"]))
        elif kind == "table":
            out.append(Spacer(1, 3))
            out.append(make_table(payload, avail_w))
            out.append(Spacer(1, 9))
        elif kind == "code":
            out.append(Spacer(1, 3))
            out.append(make_code(payload, avail_w))
            out.append(Spacer(1, 9))
        elif kind == "quote":
            out.append(Spacer(1, 3))
            out.append(make_quote(payload, avail_w))
            out.append(Spacer(1, 8))
        elif kind == "ul":
            for it in payload:
                out.append(
                    Paragraph(inline(it), STYLES["li"], bulletText="\u2022")
                )
            out.append(Spacer(1, 5))
        elif kind == "ol":
            start, items = payload
            for idx, it in enumerate(items, start):
                out.append(Paragraph(inline(it), STYLES["li"], bulletText=f"{idx}."))
            out.append(Spacer(1, 5))
        elif kind == "hr":
            out.append(Spacer(1, 5))

    return out


# --------------------------------------------------------------- template ----


class DocTemplate(BaseDocTemplate):
    def __init__(self, filename, title, subtitle, **kw):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=MARGIN_L,
            rightMargin=MARGIN_R,
            topMargin=MARGIN_T,
            bottomMargin=MARGIN_B,
            title=title,
            author="Escritório Boos",
            subject=subtitle,
            **kw,
        )
        self.doc_title = title

        frame_cover = Frame(
            MARGIN_L, MARGIN_B, CONTENT_W, PAGE_H - MARGIN_T - MARGIN_B, id="cover"
        )
        frame_body = Frame(
            MARGIN_L,
            MARGIN_B,
            CONTENT_W,
            PAGE_H - MARGIN_T - MARGIN_B - 6 * mm,
            id="body",
        )
        self.addPageTemplates(
            [
                PageTemplate(id="Cover", frames=[frame_cover]),
                PageTemplate(id="Body", frames=[frame_body], onPage=self.decorate),
            ]
        )

    def decorate(self, canvas, doc):
        canvas.saveState()
        y = PAGE_H - MARGIN_T + 5 * mm
        canvas.setStrokeColor(SLATE_200)
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_L, y, PAGE_W - MARGIN_R, y)
        canvas.setFont("Body", 7.5)
        canvas.setFillColor(SLATE_500)
        canvas.drawString(MARGIN_L, y + 3 * mm, self.doc_title)
        canvas.drawRightString(PAGE_W - MARGIN_R, y + 3 * mm, "Escritório Boos")

        yb = MARGIN_B - 6 * mm
        canvas.line(MARGIN_L, yb + 4 * mm, PAGE_W - MARGIN_R, yb + 4 * mm)
        canvas.setFont("Body", 8)
        canvas.setFillColor(SLATE_500)
        canvas.drawCentredString(PAGE_W / 2.0, yb, str(canvas.getPageNumber() - 1))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        level = getattr(flowable, "_toc_level", None)
        if level is not None and level <= 3:
            self.notify(
                "TOCEntry", (level - 1, getattr(flowable, "_toc_text", ""), self.page)
            )


def cover(title, subtitle, parts, logo_path):
    out = []
    out.append(Spacer(1, 3.2 * cm))
    if os.path.exists(logo_path):
        img = Image(logo_path, width=3.1 * cm, height=3.1 * cm, kind="proportional")
        img.hAlign = "CENTER"
        out.append(img)
        out.append(Spacer(1, 1.5 * cm))

    out.append(Paragraph(title, STYLES["cover_title"]))
    out.append(Spacer(1, 5 * mm))
    out.append(Paragraph(subtitle, STYLES["cover_sub"]))
    out.append(Spacer(1, 2.4 * cm))

    rows = [[Paragraph(f"<b>{k}</b>", STYLES["td"]), Paragraph(v, STYLES["td"])] for k, v in parts]
    t = Table(rows, colWidths=[3.6 * cm, 8.4 * cm], hAlign="CENTER")
    t.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, SLATE_200),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    out.append(t)
    return out


def toc_flowables():
    toc = TableOfContents()
    toc.levelStyles = [STYLES["toc1"], STYLES["toc2"], STYLES["toc3"]]
    toc.dotsMinLevel = 1
    return [
        Paragraph("Sum\u00e1rio", STYLES["h1"]),
        Spacer(1, 8 * mm),
        toc,
    ]


# ------------------------------------------------------------------ build ----


def strip_title(md):
    """Remove o H1 do arquivo (o titulo entra pela capa/secao)."""
    lines = md.split("\n")
    for i, l in enumerate(lines):
        if l.startswith("# "):
            return l[2:].strip(), "\n".join(lines[i + 1:])
    return None, md


def build_pdf(out_path, title, subtitle, meta, sources, root):
    story = []
    story += cover(title, subtitle, meta, os.path.join(root, "public", "logo-baz.png"))
    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())
    story += toc_flowables()
    story.append(PageBreak())

    for idx, (path, part_title, offset) in enumerate(sources):
        with open(os.path.join(root, path), encoding="utf-8") as fh:
            md = fh.read()
        file_title, body = strip_title(md)

        if part_title is not None:
            h = Paragraph(part_title or file_title, STYLES["h1"])
            h._toc_level = 1
            h._toc_text = part_title or file_title
            story.append(h)
            story.append(Spacer(1, 4 * mm))

        blocks = parse_blocks(body)
        story += blocks_to_flowables(
            blocks, level_offset=offset, skip_titles={"sum\u00e1rio", "documenta\u00e7\u00e3o"}
        )
        if idx < len(sources) - 1:
            story.append(PageBreak())

    doc = DocTemplate(out_path, title, subtitle)
    doc.multiBuild(story)
    return out_path


def main():
    global STYLES
    register_fonts()
    STYLES = build_styles()

    root = sys.argv[1] if len(sys.argv) > 1 else "."
    outdir = os.path.join(root, "docs", "pdf")
    os.makedirs(outdir, exist_ok=True)

    data = "2 de agosto de 2026"
    common = [("Sistema", "Base Operacional"), ("Data", data), ("Vers\u00e3o", "1.0")]

    jobs = [
        (
            "Documentacao-Completa.pdf",
            "Base Operacional",
            "Documenta\u00e7\u00e3o completa do sistema",
            common + [("Conte\u00fado", "Tutorial, manual operacional e documenta\u00e7\u00e3o t\u00e9cnica")],
            [
                ("README.md", "Vis\u00e3o geral", 1),
                ("docs/tutorial.md", "Tutorial de uso", 1),
                ("docs/manual-operacional.md", "Manual operacional", 1),
                ("docs/documentacao-tecnica.md", "Documenta\u00e7\u00e3o t\u00e9cnica", 1),
            ],
        ),
        (
            "Tutorial-de-Uso.pdf",
            "Tutorial de uso",
            "Base Operacional \u2014 do primeiro acesso ao processo arquivado",
            common + [("P\u00fablico", "Quem est\u00e1 come\u00e7ando a usar")],
            [("docs/tutorial.md", None, 0)],
        ),
        (
            "Manual-Operacional.pdf",
            "Manual operacional",
            "Base Operacional \u2014 guia de uso do sistema",
            common + [("P\u00fablico", "Uso di\u00e1rio do escrit\u00f3rio")],
            [("docs/manual-operacional.md", None, 0)],
        ),
        (
            "Documentacao-Tecnica.pdf",
            "Documenta\u00e7\u00e3o t\u00e9cnica",
            "Base Operacional \u2014 arquitetura e integra\u00e7\u00f5es",
            common + [("P\u00fablico", "Desenvolvimento e manuten\u00e7\u00e3o")],
            [("docs/documentacao-tecnica.md", None, 0)],
        ),
    ]

    for filename, title, subtitle, meta, sources in jobs:
        path = os.path.join(outdir, filename)
        build_pdf(path, title, subtitle, meta, sources, root)
        size = os.path.getsize(path) / 1024
        print(f"  {filename:32} {size:7.0f} KB")


if __name__ == "__main__":
    main()
