from __future__ import annotations

import os
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_CONNECTOR, MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Inches, Pt
from lxml import etree


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "deck_assets"
OUT = Path(os.environ.get("DECK_OUT", ROOT / "Metabolic_City_AI_EPICS_Pitch.pptx"))

# ---------- palette ----------
BG = RGBColor(0x08, 0x0F, 0x18)
BG_2 = RGBColor(0x0B, 0x14, 0x21)
CARD = RGBColor(0x10, 0x1B, 0x2A)
CARD_2 = RGBColor(0x13, 0x22, 0x33)
LINE = RGBColor(0x20, 0x35, 0x48)
TEXT = RGBColor(0xE8, 0xEF, 0xF7)
MUTED = RGBColor(0x91, 0xA4, 0xB7)
DIM = RGBColor(0x64, 0x7A, 0x90)
TEAL = RGBColor(0x2D, 0xD4, 0xBF)
TEAL_DARK = RGBColor(0x0D, 0x3B, 0x38)
BLUE = RGBColor(0x60, 0xA5, 0xFA)
BLUE_DARK = RGBColor(0x12, 0x2B, 0x4A)
AMBER = RGBColor(0xFB, 0xBF, 0x24)
AMBER_DARK = RGBColor(0x3B, 0x2B, 0x0C)
RED = RGBColor(0xF8, 0x71, 0x71)
RED_DARK = RGBColor(0x3A, 0x16, 0x1B)
GREEN_DARK = RGBColor(0x0E, 0x2E, 0x25)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

FONT = "Segoe UI"
FONT_SEMI = "Segoe UI Semibold"

SW, SH = 13.333, 7.5


# ---------- primitives ----------
def rgb(hex_str: str) -> RGBColor:
    return RGBColor.from_string(hex_str.replace("#", "").upper())


def add_rect(slide, left, top, width, height, fill=None, line=None, radius=True, line_width=0.8):
    shape_type = MSO_SHAPE.ROUNDED_RECTANGLE if radius else MSO_SHAPE.RECTANGLE
    shape = slide.shapes.add_shape(shape_type, Inches(left), Inches(top), Inches(width), Inches(height))
    if radius:
        try:
            shape.adjustments[0] = 0.08
        except Exception:
            pass
    if fill is None:
        shape.fill.background()
    else:
        shape.fill.solid()
        shape.fill.fore_color.rgb = fill
    if line is None:
        shape.line.fill.background()
    else:
        shape.line.color.rgb = line
        shape.line.width = Pt(line_width)
    shape.shadow.inherit = False
    return shape


def add_text(slide, text, left, top, width, height, size=14, color=TEXT, bold=False,
             font=FONT, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, line_spacing=1.0,
             margins=(0, 0, 0, 0), italic=False):
    tb = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(margins[0])
    tf.margin_right = Inches(margins[1])
    tf.margin_top = Inches(margins[2])
    tf.margin_bottom = Inches(margins[3])
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.text = text
    p.alignment = align
    p.line_spacing = line_spacing
    r = p.runs[0]
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.color.rgb = color
    return tb


def add_body(slide, lines, left, top, width, height, size=11, color=MUTED,
             bullet=False, spacing=7, line_spacing=1.0, font=FONT):
    tb = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = ("•  " if bullet else "") + str(line)
        p.font.name = font
        p.font.size = Pt(size)
        p.font.color.rgb = color
        p.space_after = Pt(spacing)
        p.line_spacing = line_spacing
    return tb


def add_pill(slide, text, left, top, width=None, fill=TEAL_DARK, color=TEAL, size=8.5,
             line=None, bold=True):
    if width is None:
        width = max(0.8, 0.012 * len(text) + 0.35)
    add_rect(slide, left, top, width, 0.28, fill=fill, line=line, radius=True)
    add_text(slide, text, left + 0.12, top + 0.045, width - 0.24, 0.19,
             size=size, color=color, bold=bold, align=PP_ALIGN.CENTER)


def add_arrow(slide, x1, y1, x2, y2, color=LINE, width=1.2, arrow=True, dash=False):
    conn = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    conn.line.color.rgb = color
    conn.line.width = Pt(width)
    if dash:
        conn.line.dash_style = 4  # dash
    if arrow:
        ln = conn.line._get_or_add_ln()
        tail = etree.SubElement(ln, qn("a:tailEnd"))
        tail.set("type", "triangle")
        tail.set("w", "sm")
        tail.set("len", "sm")
    return conn


def add_hex_pattern(slide, left, top, cols=5, rows=5, accent_cells=None):
    accent_cells = set(accent_cells or [])
    w, h = 0.62, 0.54
    for row in range(rows):
        for col in range(cols):
            x = left + col * 0.66 + (0.33 if row % 2 else 0)
            y = top + row * 0.50
            shape = slide.shapes.add_shape(MSO_SHAPE.HEXAGON, Inches(x), Inches(y), Inches(w), Inches(h))
            shape.shadow.inherit = False
            if (row, col) in accent_cells:
                shape.fill.solid()
                shape.fill.fore_color.rgb = TEAL_DARK
                shape.line.color.rgb = TEAL
            elif (row + col) % 5 == 0:
                shape.fill.solid()
                shape.fill.fore_color.rgb = BLUE_DARK
                shape.line.color.rgb = LINE
            else:
                shape.fill.solid()
                shape.fill.fore_color.rgb = RGBColor(0x0D, 0x18, 0x26)
                shape.line.color.rgb = RGBColor(0x1A, 0x2C, 0x3C)
            shape.line.width = Pt(0.7)


def add_section(slide, eyebrow, title, subtitle=None):
    add_text(slide, eyebrow.upper(), 0.65, 0.35, 9.0, 0.25, size=9, color=TEAL, bold=True)
    add_text(slide, title, 0.65, 0.64, 11.8, 0.55, size=27, color=TEXT, bold=True, font=FONT_SEMI)
    if subtitle:
        add_text(slide, subtitle, 0.67, 1.20, 11.6, 0.35, size=10.5, color=MUTED)


def add_footer(slide, page, total=17, label="METABOLIC CITY AI  ·  EPICS  ·  VIT BHOPAL"):
    add_rect(slide, 0.65, 7.10, 12.03, 0.008, fill=RGBColor(0x1A, 0x2A, 0x38), radius=False)
    add_text(slide, label, 0.65, 7.16, 8.0, 0.18, size=7.5, color=DIM, bold=True)
    add_text(slide, f"{page:02d} / {total:02d}", 11.82, 7.16, 0.85, 0.18, size=8, color=MUTED,
             bold=True, align=PP_ALIGN.RIGHT)


def add_notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def new_slide(prs, page, total=17, footer=True, bg=BG):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bgshape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(SW), Inches(SH))
    bgshape.fill.solid()
    bgshape.fill.fore_color.rgb = bg
    bgshape.line.fill.background()
    bgshape.shadow.inherit = False
    if footer:
        add_footer(slide, page, total)
    return slide


def add_metric(slide, x, y, w, h, value, label, note="", accent=TEAL):
    add_rect(slide, x, y, w, h, fill=CARD, line=LINE)
    add_rect(slide, x, y, 0.06, h, fill=accent, radius=False)
    add_text(slide, value, x + 0.22, y + 0.16, w - 0.38, 0.45, size=25, color=TEXT,
             bold=True, font=FONT_SEMI)
    add_text(slide, label, x + 0.22, y + 0.67, w - 0.38, 0.22, size=8.5, color=MUTED, bold=True)
    if note:
        add_text(slide, note, x + 0.22, y + 0.95, w - 0.38, 0.48, size=8, color=DIM, line_spacing=0.95)


def add_bullet_card(slide, x, y, w, h, title, lines, accent=TEAL, number=None):
    add_rect(slide, x, y, w, h, fill=CARD, line=LINE)
    add_rect(slide, x, y, w, 0.055, fill=accent, radius=False)
    if number:
        add_text(slide, number, x + 0.18, y + 0.18, 0.46, 0.22, size=8.5, color=accent, bold=True)
        add_text(slide, title, x + 0.64, y + 0.16, w - 0.82, 0.28, size=10.5, color=TEXT, bold=True)
        top = y + 0.56
    else:
        add_text(slide, title, x + 0.20, y + 0.18, w - 0.38, 0.28, size=10.5, color=TEXT, bold=True)
        top = y + 0.58
    add_body(slide, lines, x + 0.20, top, w - 0.38, h - (top - y) - 0.15, size=8.8, color=MUTED, spacing=4.5)


def add_grid_table(slide, x, y, col_widths, rows, row_h=0.54, header=True):
    total_w = sum(col_widths)
    for ri, row in enumerate(rows):
        yy = y + ri * row_h
        fill = RGBColor(0x15, 0x27, 0x39) if (header and ri == 0) else (CARD if ri % 2 else RGBColor(0x0E, 0x19, 0x27))
        add_rect(slide, x, yy, total_w, row_h, fill=fill, line=None, radius=False)
        add_rect(slide, x, yy + row_h - 0.008, total_w, 0.008, fill=LINE, radius=False)
        xx = x
        for ci, cell in enumerate(row):
            if isinstance(cell, tuple):
                text, color, bold = cell
            else:
                text, color, bold = cell, (TEXT if (header and ri == 0) else MUTED), (header and ri == 0)
            add_text(slide, str(text), xx + 0.08, yy + 0.09, col_widths[ci] - 0.16, row_h - 0.16,
                     size=8.4 if not (header and ri == 0) else 8.3, color=color, bold=bold,
                     anchor=MSO_ANCHOR.MIDDLE, line_spacing=0.92)
            xx += col_widths[ci]


def icon_dot(slide, x, y, color=TEAL, size=0.1):
    shape = slide.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x), Inches(y), Inches(size), Inches(size))
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    shape.shadow.inherit = False


# ---------- deck ----------
prs = Presentation()
prs.slide_width = Inches(SW)
prs.slide_height = Inches(SH)
prs.core_properties.title = "Metabolic City AI — EPICS Pitch"
prs.core_properties.author = "Metabolic City AI Team"
prs.core_properties.subject = "MERN + Python urban resilience platform"
prs.core_properties.keywords = "EPICS, VIT Bhopal, H3, MERN, FastAPI, LangGraph, RAG, urban resilience"

TOTAL = 18

# 1 — title
s = new_slide(prs, 1, TOTAL, footer=False)
add_rect(s, 0, 0, 0.09, SH, fill=TEAL, radius=False)
add_hex_pattern(s, 7.6, 0.55, cols=5, rows=6, accent_cells=[(1, 2), (2, 0), (3, 3), (4, 1)])
add_text(s, "EPICS  ·  VIT BHOPAL  ·  2026", 0.82, 0.72, 6.0, 0.28, size=9.5, color=TEAL, bold=True)
add_text(s, "Metabolic\nCity AI", 0.78, 1.12, 6.2, 1.85, size=47, color=TEXT, bold=True,
         font=FONT_SEMI, line_spacing=0.86)
add_text(s, "A working urban resilience platform for Bhopal, Indore and Sehore.",
         0.82, 3.10, 6.0, 0.48, size=17, color=RGBColor(0xC8, 0xD5, 0xE2), bold=False)
add_text(s, "MERN operations console  +  H3 risk engine  +  Python spatiotemporal intelligence.",
         0.82, 3.68, 6.2, 0.42, size=11.5, color=MUTED)
add_text(s, "Built to show what is measured, what is modelled, and what is still missing.",
         0.82, 4.10, 6.2, 0.42, size=11.5, color=AMBER)
add_pill(s, "MERN PLATFORM", 0.82, 4.95, 1.65)
add_pill(s, "H3 RISK ENGINE", 2.60, 4.95, 1.75, fill=BLUE_DARK, color=BLUE)
add_pill(s, "PYTHON INTELLIGENCE", 4.48, 4.95, 2.05, fill=TEAL_DARK, color=TEAL)
add_text(s, "Working prototype, not a finished municipal deployment. Every limitation in this deck is intentional.",
         0.82, 6.55, 6.5, 0.45, size=8.8, color=DIM, italic=True)
add_text(s, "11 November 2026", 0.82, 6.92, 3.0, 0.22, size=8.5, color=DIM, bold=True)
add_notes(s, "Open with the boundary: this is a working prototype. The deck is deliberately split into what is live, what is modelled, and what is still blocked on official data access. The project is MERN for operations and Python for spatial intelligence.")


# 2 — one-slide pitch
s = new_slide(prs, 2, TOTAL)
add_section(s, "01 · The pitch", "Cities do not lack data. They lack a shared picture of what is at risk right now.",
            "Metabolic City turns fragmented municipal signals into one H3 cell view, then gives operators a traceable path from alert to resolution.")
add_text(s, "One cell. One score. One audit trail.",
         0.67, 1.72, 5.3, 0.38, size=19, color=TEXT, bold=True, font=FONT_SEMI)
add_body(s, [
    "Weather, roads, traffic, citizen reports and field updates are reconciled against the same H3 grid.",
    "The operator sees the evidence behind the score, not just a coloured polygon.",
    "Every decision, dispatch and closure is recorded, so the next shift inherits context.",
], 0.67, 2.22, 5.55, 1.55, size=10.2, color=MUTED, bullet=True, spacing=8, line_spacing=0.98)
add_pill(s, "100 H3 CELLS", 0.67, 4.12, 1.35)
add_pill(s, "5,211 ROAD SEGMENTS", 2.13, 4.12, 1.85, fill=BLUE_DARK, color=BLUE)
add_pill(s, "2 SERVICES HEALTHY", 4.10, 4.12, 1.75, fill=TEAL_DARK, color=TEAL)

steps = [
    ("01", "OBSERVE", "Weather, roads, traffic,\ncitizen reports, field updates."),
    ("02", "PRIORITISE", "Deterministic 0–10 risk,\nalerts, confidence, forecast."),
    ("03", "RESOLVE", "Lock, decide, dispatch,\narrive, close, audit."),
]
for i, (num, title, desc) in enumerate(steps):
    x = 6.55 + i * 2.12
    add_rect(s, x, 1.78, 1.92, 2.65, fill=CARD, line=LINE)
    add_text(s, num, x + 0.18, 1.96, 0.5, 0.22, size=8, color=TEAL, bold=True)
    add_text(s, title, x + 0.18, 2.26, 1.55, 0.25, size=9.5, color=TEXT, bold=True)
    add_body(s, desc.split("\n"), x + 0.18, 2.75, 1.58, 1.1, size=8.6, color=MUTED, spacing=4)

add_rect(s, 0.67, 5.38, 11.95, 0.86, fill=AMBER_DARK, line=RGBColor(0x6B, 0x50, 0x16))
add_text(s, "STATUS", 0.87, 5.55, 0.75, 0.18, size=8, color=AMBER, bold=True)
add_text(s, "Working local prototype. Live weather, roads and traffic; no live Bhopal transit feed; current incidents are workflow/test records.",
         1.55, 5.50, 10.8, 0.48, size=9.4, color=RGBColor(0xF5, 0xD9, 0x9A), line_spacing=0.95)
add_notes(s, "This is the whole pitch in one slide. The product is the shared cell view and the audit trail, not the map. Say the status line out loud: live weather, roads and traffic; transit and municipal incidents are not live.")


# 3 — problem
s = new_slide(prs, 3, TOTAL)
add_section(s, "01 · The problem", "The problem is not another dashboard",
            "The operational gap is integration and traceability. A prettier map does not fix either.")
problems = [
    ("01", "Fragmented signals", [
        "Weather, traffic, complaints and field knowledge sit in separate systems.",
        "Each source has a different location format, time window and owner.",
    ], RED),
    ("02", "Slow triage", [
        "Operators manually reconcile severity, location and ownership.",
        "A road closure can disappear inside an averaged delay score.",
    ], AMBER),
    ("03", "Weak accountability", [
        "Status changes are spread across calls, messages and memory.",
        "The next shift cannot see who decided what, when, or why.",
    ], BLUE),
]
for i, (num, title, lines, accent) in enumerate(problems):
    x = 0.67 + i * 4.02
    add_bullet_card(s, x, 1.72, 3.75, 2.55, title, lines, accent=accent, number=num)
add_rect(s, 0.67, 4.62, 11.95, 1.18, fill=CARD, line=LINE)
add_text(s, "The community experiences the delay. The crew experiences the ambiguity.",
         0.90, 4.86, 11.45, 0.32, size=15.5, color=TEXT, bold=True, font=FONT_SEMI)
add_text(s, "Metabolic City is designed around the hand-off: source → cell → alert → decision → field status → audit.",
         0.90, 5.25, 11.45, 0.30, size=9.6, color=MUTED)
add_text(s, "Why now", 0.67, 6.12, 1.0, 0.22, size=8.2, color=TEAL, bold=True)
add_text(s, "Open data and low-cost APIs make a ward-level prototype possible without new hardware. The hard part is not ingestion; it is trust in the numbers.",
         1.52, 6.07, 11.0, 0.45, size=9.4, color=MUTED, line_spacing=0.95)
add_notes(s, "Frame the problem in operational terms, not technology terms. The city already has data and maps. The missing layer is a shared, auditable cell view and a hand-off that survives shift changes.")


# 4 — solution
s = new_slide(prs, 4, TOTAL)
add_section(s, "02 · The system", "What we built",
            "Three layers, one spatial key. The Python service is deliberately separate from the operational core.")
layers = [
    ("EXPERIENCE", "React 18 + Vite", "Operator console  ·  field crew  ·  admin  ·  citizen QR", TEAL),
    ("OPERATIONS", "Node.js + Express", "Auth  ·  telemetry  ·  H3 scoring  ·  alerts  ·  incidents  ·  SSE", BLUE),
    ("INTELLIGENCE", "Python 3.11 + FastAPI", "Cell memory  ·  multi-resolution  ·  graph  ·  RAG  ·  LangGraph", AMBER),
]
for i, (label, stack, desc, accent) in enumerate(layers):
    y = 1.72 + i * 1.31
    add_rect(s, 0.67, y, 8.55, 1.05, fill=CARD, line=LINE)
    add_rect(s, 0.67, y, 0.07, 1.05, fill=accent, radius=False)
    add_text(s, label, 0.92, y + 0.14, 1.2, 0.2, size=7.8, color=accent, bold=True)
    add_text(s, stack, 0.92, y + 0.36, 2.7, 0.28, size=12.5, color=TEXT, bold=True)
    add_text(s, desc, 3.65, y + 0.34, 5.25, 0.42, size=8.9, color=MUTED, line_spacing=0.95)
add_rect(s, 9.55, 1.72, 3.05, 3.92, fill=RGBColor(0x0C, 0x1A, 0x25), line=LINE)
add_text(s, "ONE CELL,\nTHREE SCALES", 9.82, 1.98, 2.5, 0.7, size=9.5, color=TEAL, bold=True, line_spacing=0.95)
for i, (res, name, desc) in enumerate([("RES 8", "street", "stored risk cells"), ("RES 6", "neighbourhood", "parent rollup"), ("RES 4", "city", "parent rollup")]):
    yy = 2.82 + i * 0.83
    add_rect(s, 9.82, yy, 2.48, 0.64, fill=CARD_2, line=RGBColor(0x1C, 0x31, 0x44), radius=True)
    add_text(s, res, 9.96, yy + 0.09, 0.62, 0.18, size=8.2, color=BLUE, bold=True)
    add_text(s, name, 10.62, yy + 0.07, 1.55, 0.18, size=8.5, color=TEXT, bold=True)
    add_text(s, desc, 10.62, yy + 0.28, 1.55, 0.18, size=7.5, color=DIM)
add_rect(s, 0.67, 5.93, 11.95, 0.72, fill=TEAL_DARK, line=RGBColor(0x1A, 0x5A, 0x54))
add_text(s, "MERN runs the workflow. Python explains the context. H3 is the shared spatial key.",
         0.90, 6.13, 11.45, 0.30, size=13.2, color=TEAL, bold=True)
add_notes(s, "Explain the separation of concerns. MERN is the operational system that owns auth, state and incident lifecycle. Python is an internal intelligence service that reads the same MongoDB and returns advisory output through the Node gateway.")


# 5 — architecture
s = new_slide(prs, 5, TOTAL)
add_section(s, "02 · The system", "End-to-end architecture",
            "The browser never calls Python directly. Node owns identity, authorization and the public API.")
# experience band
add_rect(s, 0.67, 1.67, 11.95, 0.82, fill=CARD, line=LINE)
add_text(s, "EXPERIENCE", 0.90, 1.82, 1.35, 0.2, size=7.6, color=TEAL, bold=True)
for i, label in enumerate(["Operator console", "Field crew", "Admin", "Citizen QR"]):
    add_pill(s, label, 2.18 + i * 2.22, 1.90, 1.92, fill=RGBColor(0x0B, 0x1F, 0x1D), color=TEAL, size=7.6)
# arrow
add_arrow(s, 6.62, 2.49, 6.62, 2.73, color=TEAL, width=1.5)
# operational core
add_rect(s, 0.67, 2.74, 11.95, 0.86, fill=CARD, line=LINE)
add_text(s, "OPERATIONAL CORE", 0.90, 2.90, 1.7, 0.2, size=7.6, color=BLUE, bold=True)
for i, label in enumerate(["Express REST", "JWT / RBAC", "SSE + Socket.IO", "Alerts / incidents"]):
    add_pill(s, label, 2.18 + i * 2.22, 2.98, 1.92, fill=BLUE_DARK, color=BLUE, size=7.5)
add_arrow(s, 6.62, 3.60, 6.62, 3.83, color=BLUE, width=1.5)
# state + intelligence
add_rect(s, 0.67, 3.85, 5.82, 1.58, fill=CARD, line=LINE)
add_text(s, "STATE", 0.90, 4.02, 0.8, 0.2, size=7.6, color=TEAL, bold=True)
add_text(s, "MongoDB Atlas", 0.90, 4.25, 2.10, 0.26, size=12.5, color=TEXT, bold=True)
add_text(s, "telemetry  ·  cells  ·  alerts\nincidents  ·  audit  ·  knowledge", 0.90, 4.65, 4.95, 0.44, size=8.9, color=MUTED, line_spacing=0.95)
add_rect(s, 6.82, 3.85, 5.80, 1.58, fill=CARD, line=LINE)
add_text(s, "INTELLIGENCE", 7.05, 4.02, 1.4, 0.2, size=7.6, color=AMBER, bold=True)
add_text(s, "Python FastAPI", 7.05, 4.25, 2.2, 0.26, size=12.5, color=TEXT, bold=True)
add_text(s, "cell memory  ·  multi-resolution  ·  graph\nhybrid RAG  ·  8-node LangGraph workflow", 7.05, 4.65, 5.05, 0.44, size=8.9, color=MUTED, line_spacing=0.95)
add_arrow(s, 6.49, 4.64, 6.82, 4.64, color=AMBER, width=1.2)
add_arrow(s, 6.82, 4.80, 6.49, 4.80, color=AMBER, width=1.2)
# sources
add_rect(s, 0.67, 5.69, 11.95, 0.72, fill=RGBColor(0x0B, 0x14, 0x1F), line=LINE)
add_text(s, "SOURCES", 0.90, 5.86, 1.0, 0.2, size=7.6, color=MUTED, bold=True)
for i, label in enumerate(["Open-Meteo", "TomTom", "OSM + elevation", "Citizen / field"]):
    add_text(s, label, 2.18 + i * 2.48, 5.84, 2.2, 0.22, size=9.2, color=RGBColor(0xC8, 0xD5, 0xE2), bold=True)
add_text(s, "Node gateway: /api/v1/intelligence  ·  browser never reaches Python directly", 0.90, 6.55, 11.5, 0.26,
         size=8.4, color=DIM, italic=True)
add_notes(s, "Walk top to bottom. Experience calls the Node API. Node owns auth and writes to MongoDB. Python reads MongoDB and is proxied through the Node gateway. The bottom band is the only external input surface. Do not imply Python is public-facing.")


# 6 — MERN platform
s = new_slide(prs, 6, TOTAL)
add_section(s, "03 · MERN platform", "MERN: the operational system of record",
            "MongoDB · Express · React · Node.js — one stack for the operator, field crew and admin workflow.")
add_pill(s, "MONGODB", 0.67, 1.63, 1.1, fill=GREEN_DARK, color=TEAL, size=7.4)
add_pill(s, "EXPRESS", 1.87, 1.63, 1.0, fill=BLUE_DARK, color=BLUE, size=7.4)
add_pill(s, "REACT", 2.97, 1.63, 0.9, fill=BLUE_DARK, color=BLUE, size=7.4)
add_pill(s, "NODE.JS", 3.97, 1.63, 0.95, fill=GREEN_DARK, color=TEAL, size=7.4)
features = [
    ("Identity & access", ["JWT access + refresh tokens", "Operator / field crew / admin roles"]),
    ("Telemetry ingestion", ["Weather, traffic, citizen, transit", "Stable event IDs for idempotency"]),
    ("H3 risk engine", ["Resolution-8 cells", "0–10 composite, confidence, degradation"]),
    ("Alert & incident loop", ["Locks, decisions, dispatch", "Field status and audit trail"]),
    ("Field operations", ["Task sync, GPS, photos", "Arrival, resolution, notes"]),
    ("Admin & analytics", ["Weight changes with dry-run", "1,053 audit entries in current DB"]),
]
for i, (title, lines) in enumerate(features):
    col, row = i % 3, i // 3
    x = 0.67 + col * 4.02
    y = 2.22 + row * 1.72
    add_bullet_card(s, x, y, 3.75, 1.50, title, lines, accent=TEAL if i % 2 == 0 else BLUE)
add_rect(s, 0.67, 5.86, 11.95, 0.66, fill=CARD, line=LINE)
add_text(s, "Engineering guardrails", 0.88, 6.02, 2.0, 0.2, size=8.2, color=TEAL, bold=True)
add_text(s, "7-layer security  ·  rate limits  ·  circuit breakers  ·  dead-letter queue  ·  idempotent ingestion  ·  live SSE updates  ·  audit logging",
         2.55, 5.98, 9.75, 0.34, size=8.6, color=MUTED)
add_notes(s, "This is the MERN half. Emphasize that this is not a UI prototype: it has auth, RBAC, idempotent ingestion, incident state, field sync and audit. The 1,053 audit entries are from the current local database.")


# 7 — risk engine
s = new_slide(prs, 7, TOTAL)
add_section(s, "03 · MERN platform", "How a cell gets its score",
            "A deterministic, explainable screening score — not a black-box prediction.")
add_rect(s, 0.67, 1.72, 7.65, 1.02, fill=RGBColor(0x0C, 0x1B, 0x27), line=RGBColor(0x1C, 0x4A, 0x45))
add_text(s, "R_c  =  0.4 · S_m  +  0.4 · S_c  +  0.2 · S_v", 0.92, 1.87, 5.4, 0.42, size=23, color=TEAL, bold=True, font=FONT_SEMI)
add_text(s, "threshold 7.0  ·  1-hour window  ·  30-min half-life", 0.94, 2.40, 5.8, 0.22, size=8.8, color=MUTED)
add_pill(s, "WEIGHTS NORMALIZED", 6.35, 1.96, 1.72, fill=TEAL_DARK, color=TEAL, size=7.1)
subs = [
    ("S_m  MOBILITY", ["TomTom speed and incidents", "Transit adapter exists; no feed", "Citizen mobility reports"], BLUE),
    ("S_c  CLIMATE", ["Open-Meteo rain, visibility, wind", "Inverse-distance interpolation", "Per-cell reading, not one city number"], TEAL),
    ("S_v  VULNERABILITY", ["OSM roads and watercourse distance", "Elevation, slope and relief", "Citizen distress reports"], AMBER),
]
for i, (title, lines, accent) in enumerate(subs):
    x = 0.67 + i * 2.58
    add_bullet_card(s, x, 3.02, 2.42, 2.05, title, lines, accent=accent)
add_rect(s, 8.58, 1.72, 4.04, 3.35, fill=CARD, line=LINE)
add_text(s, "WHAT IT IS / IS NOT", 8.83, 1.93, 3.4, 0.22, size=7.8, color=AMBER, bold=True)
add_text(s, "IS", 8.83, 2.30, 0.5, 0.2, size=8.4, color=TEAL, bold=True)
add_text(s, "a deterministic screening score with visible inputs and guardrails.", 9.33, 2.26, 2.9, 0.48, size=9.2, color=RGBColor(0xD7, 0xE2, 0xEE), line_spacing=0.95)
add_text(s, "IS NOT", 8.83, 2.93, 0.85, 0.2, size=8.4, color=RED, bold=True)
add_text(s, "a flood forecast, a dispatch decision, or a guarantee of outcomes.", 9.33, 2.89, 2.9, 0.52, size=9.2, color=RGBColor(0xD7, 0xE2, 0xEE), line_spacing=0.95)
add_text(s, "Guardrails", 8.83, 3.66, 1.0, 0.2, size=8.2, color=TEAL, bold=True)
add_body(s, ["Temporal decay", "Confidence / degradation flags", "Cascade risk from neighbours", "3-hour forecast, kept separate"], 8.83, 3.92, 3.35, 0.92, size=8.4, color=MUTED, bullet=True, spacing=2.5)
add_rect(s, 0.67, 5.35, 11.95, 0.72, fill=AMBER_DARK, line=RGBColor(0x6B, 0x50, 0x16))
add_text(s, "Current snapshot: 100 cells across 3 cities, zero critical cells.",
         0.90, 5.55, 11.45, 0.28, size=12.4, color=AMBER, bold=True)
add_text(s, "Calm conditions are reported as calm. The system does not inflate risk to look impressive.",
         0.90, 5.86, 11.45, 0.2, size=8.6, color=RGBColor(0xF5, 0xD9, 0x9A))
add_notes(s, "Explain the formula and the default weights. The most important line is the honesty line: the snapshot has zero critical cells. The score is a screening and triage aid, not a prediction guarantee. Do not claim flood prediction; the flood model is a separate screening layer and is not validated here.")


# 8 — operator loop
s = new_slide(prs, 8, TOTAL)
add_section(s, "03 · MERN platform", "From alert to resolution",
            "The operator loop is the product. The map is only the entry point.")
steps = [
    ("01", "OBSERVE", "Cell risk, alert score and the evidence behind it."),
    ("02", "LOCK", "A 60-second operator lock prevents duplicate decisions."),
    ("03", "DECIDE", "Approve or override, with a recorded reason."),
    ("04", "DISPATCH", "Crew, resources and dispatch text are attached to the incident."),
    ("05", "RESOLVE", "Acknowledge, arrive, close with note and photo."),
]
for i, (num, title, desc) in enumerate(steps):
    y = 1.72 + i * 0.80
    icon_dot(s, 0.74, y + 0.12, TEAL if i < 4 else AMBER, 0.11)
    add_text(s, num, 0.98, y + 0.02, 0.42, 0.2, size=7.8, color=TEAL if i < 4 else AMBER, bold=True)
    add_text(s, title, 1.45, y, 1.05, 0.22, size=8.8, color=TEXT, bold=True)
    add_text(s, desc, 2.55, y - 0.01, 3.98, 0.48, size=8.6, color=MUTED, line_spacing=0.93)
add_text(s, "STATUS MODEL", 0.72, 5.98, 1.2, 0.2, size=7.6, color=BLUE, bold=True)
add_text(s, "DETECTED  →  APPROVED  →  DISPATCHED  →  ACKNOWLEDGED  →  ARRIVED  →  RESOLVED",
         1.85, 5.94, 5.55, 0.28, size=7.7, color=RGBColor(0xC8, 0xD5, 0xE2), bold=True)
add_rect(s, 0.67, 6.35, 6.45, 0.48, fill=AMBER_DARK, line=RGBColor(0x6B, 0x50, 0x16))
add_text(s, "Current DB: 13 workflow/test incidents — not municipal history.", 0.85, 6.48, 6.05, 0.22, size=8.2, color=AMBER, bold=True)
# screenshot card
add_rect(s, 7.43, 1.60, 5.10, 5.25, fill=CARD, line=LINE)
pic = s.shapes.add_picture(str(ASSETS / "operator_panel.png"), Inches(7.58), Inches(1.74), width=Inches(4.80))
add_text(s, "Live operator console  ·  43 Bhopal cells  ·  260 telemetry events", 7.58, 6.52, 4.80, 0.2,
         size=7.4, color=DIM, italic=True)
add_notes(s, "Walk the five-step loop. The 60-second lock matters because it prevents two operators from dispatching the same cell. Land on the amber caveat: the 13 incidents are workflow/test records, not real Bhopal history. That honesty is part of the pitch.")


# 9 — Python divider
s = new_slide(prs, 9, TOTAL, footer=False)
add_hex_pattern(s, 9.0, 0.8, cols=4, rows=5, accent_cells=[(1, 1), (2, 3), (3, 0)])
add_text(s, "04 · PYTHON INTELLIGENCE", 0.82, 0.92, 6.2, 0.28, size=9.5, color=AMBER, bold=True)
add_text(s, "Python\nintelligence layer", 0.78, 1.32, 6.2, 1.75, size=42, color=TEXT, bold=True,
         font=FONT_SEMI, line_spacing=0.88)
add_text(s, "Five capabilities. One rule: advisory only.", 0.82, 3.25, 6.2, 0.36, size=16, color=RGBColor(0xC8, 0xD5, 0xE2))
add_text(s, "Reads the same MongoDB as Node. Never dispatches a crew, sends SMS or changes incident status.",
         0.82, 3.75, 6.8, 0.48, size=10.5, color=MUTED, line_spacing=0.98)
chips = ["CELL MEMORY", "MULTI-RESOLUTION", "GRAPH ANALYTICS", "HYBRID RAG", "LANGGRAPH"]
for i, chip in enumerate(chips):
    add_pill(s, chip, 0.82 + (i % 3) * 2.0, 4.62 + (i // 3) * 0.48, 1.82,
             fill=RGBColor(0x1B, 0x2A, 0x1A), color=AMBER, size=7.2)
add_text(s, "Internal service  ·  Node gateway  ·  no browser exposure", 0.82, 6.62, 6.5, 0.22, size=8.2, color=DIM, italic=True)
add_text(s, "09 / 18", 11.82, 7.16, 0.85, 0.18, size=8, color=MUTED, bold=True, align=PP_ALIGN.RIGHT)
add_notes(s, "This is the transition to the Python half. Say the rule clearly: advisory only. The Python service is an internal decision-support layer. It does not own auth, incident state or dispatch.")


# 10 — cell memory
s = new_slide(prs, 10, TOTAL)
add_section(s, "04 · Python intelligence", "Cell memory: a place with a history",
            "Each H3 cell can carry risk, incidents, resources and neighbour correlations over time.")
# memory diagram
add_rect(s, 0.67, 1.78, 7.10, 3.85, fill=CARD, line=LINE)
center = add_rect(s, 2.45, 2.88, 2.05, 1.12, fill=TEAL_DARK, line=TEAL)
add_text(s, "H3 CELL", 2.72, 3.08, 1.5, 0.22, size=8.2, color=TEAL, bold=True, align=PP_ALIGN.CENTER)
add_text(s, "memory", 2.72, 3.35, 1.5, 0.28, size=15, color=TEXT, bold=True, align=PP_ALIGN.CENTER)
memory_cards = [
    (1.02, 2.05, "RISK HISTORY", "trend, volatility,\nseasonality"),
    (4.95, 2.05, "INCIDENTS", "type, severity,\nresolution time"),
    (1.02, 3.85, "RESOURCES", "assigned, efficiency,\noutcome"),
    (4.95, 3.85, "NEIGHBOURS", "correlation, cascade\ndirection"),
]
for x, y, title, desc in memory_cards:
    add_rect(s, x, y, 1.72, 0.82, fill=CARD_2, line=LINE)
    add_text(s, title, x + 0.12, y + 0.11, 1.45, 0.18, size=7.2, color=BLUE, bold=True)
    add_text(s, desc, x + 0.12, y + 0.33, 1.45, 0.38, size=7.4, color=MUTED, line_spacing=0.9)
# connectors
add_arrow(s, 2.74, 2.88, 2.20, 2.87, color=LINE, width=0.8, arrow=False)
add_arrow(s, 2.74, 2.88, 4.95, 2.87, color=LINE, width=0.8, arrow=False)
add_arrow(s, 2.74, 4.00, 2.20, 3.87, color=LINE, width=0.8, arrow=False)
add_arrow(s, 2.74, 4.00, 4.95, 3.87, color=LINE, width=0.8, arrow=False)
add_text(s, "recurrence  ·  volatility  ·  seasonality  ·  personality profile",
         1.02, 5.12, 6.35, 0.22, size=8.2, color=TEAL, bold=True)
# resolution ladder
add_text(s, "MULTI-RESOLUTION", 8.15, 1.83, 2.1, 0.22, size=8.2, color=AMBER, bold=True)
levels = [
    ("RES 8", "street", "100 stored cells", 1.0, TEAL),
    ("RES 6", "neighbourhood", "computed by parent membership", 0.72, BLUE),
    ("RES 4", "city", "computed by parent membership", 0.48, AMBER),
]
for i, (res, name, desc, frac, accent) in enumerate(levels):
    y = 2.22 + i * 1.02
    add_text(s, res, 8.15, y, 0.62, 0.2, size=8, color=accent, bold=True)
    add_text(s, name, 8.82, y - 0.02, 1.95, 0.2, size=8.5, color=TEXT, bold=True)
    add_text(s, desc, 8.15, y + 0.25, 3.85, 0.22, size=7.6, color=MUTED)
    add_rect(s, 8.15, y + 0.52, 4.05, 0.16, fill=RGBColor(0x16, 0x26, 0x36), line=None, radius=True)
    add_rect(s, 8.15, y + 0.52, 4.05 * frac, 0.16, fill=accent, line=None, radius=True)
add_rect(s, 8.15, 5.42, 4.05, 0.86, fill=RGBColor(0x0C, 0x1B, 0x27), line=LINE)
add_text(s, "Built on request and persisted. Current DB: 100 materialized memory docs; 100 cells available.",
         8.34, 5.58, 3.65, 0.52, size=8.2, color=MUTED, line_spacing=0.95)
add_notes(s, "Explain that memory is not a new database of fake history. It is computed from stored risk history, incidents and resources, then persisted. All 100 cells have been materialized. Multi-resolution uses real parent membership, not string truncation.")


# 11 — graph + RAG
s = new_slide(prs, 11, TOTAL)
add_section(s, "04 · Python intelligence", "Graph context + hybrid retrieval",
            "The graph answers “what is connected?” The RAG layer answers “what has happened before?”")
# graph visual
add_rect(s, 0.67, 1.72, 5.65, 3.95, fill=CARD, line=LINE)
add_text(s, "H3 ADJACENCY GRAPH", 0.90, 1.90, 2.6, 0.2, size=7.8, color=TEAL, bold=True)
nodes = {
    "A": (2.00, 2.75), "B": (3.15, 2.45), "C": (4.30, 2.80),
    "D": (2.55, 3.55), "E": (3.70, 3.85), "F": (4.85, 3.55),
    "G": (3.10, 4.55), "H": (4.35, 4.55),
}
edges = [("A","B"),("B","C"),("A","D"),("B","D"),("B","E"),("C","E"),("C","F"),("D","G"),("E","G"),("E","H"),("F","H"),("G","H")]
for a, b in edges:
    add_arrow(s, *nodes[a], *nodes[b], color=RGBColor(0x2A, 0x4A, 0x5A), width=0.9, arrow=False)
for key, (x, y) in nodes.items():
    color = TEAL if key in ("B", "E") else (AMBER if key == "C" else BLUE)
    size = 0.26 if key in ("B", "E") else 0.18
    dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Inches(x - size/2), Inches(y - size/2), Inches(size), Inches(size))
    dot.fill.solid(); dot.fill.fore_color.rgb = color
    dot.line.color.rgb = RGBColor(0x08, 0x0F, 0x18); dot.line.width = Pt(1)
    dot.shadow.inherit = False
add_text(s, "critical hub", 3.05, 2.10, 0.95, 0.18, size=7, color=TEAL, bold=True)
add_text(s, "cascade direction", 4.40, 3.32, 1.2, 0.18, size=7, color=AMBER, bold=True)
add_body(s, ["Degree / betweenness / closeness", "Critical hub + higher-risk neighbours", "Weighted response route", "Missing cells are not invented"], 0.92, 4.92, 5.05, 0.62, size=8.2, color=MUTED, bullet=True, spacing=1.5)
# RAG
add_rect(s, 6.60, 1.72, 6.02, 3.95, fill=CARD, line=LINE)
add_text(s, "HYBRID RAG", 6.85, 1.90, 1.3, 0.2, size=7.8, color=AMBER, bold=True)
add_text(s, "23 knowledge documents", 6.85, 2.18, 3.0, 0.3, size=16, color=TEXT, bold=True, font=FONT_SEMI)
add_text(s, "13 historical incidents  ·  10 project playbooks", 6.86, 2.52, 4.9, 0.22, size=8.6, color=MUTED)
for i, (label, desc, color) in enumerate([
    ("SPATIAL", "neighbouring cells and same corridor", TEAL),
    ("SEMANTIC", "similar incident text and category", BLUE),
    ("TEMPORAL", "season, time of day, recurrence", AMBER),
]):
    y = 2.95 + i * 0.67
    add_pill(s, label, 6.86, y, 0.92, fill=RGBColor(0x0C, 0x1B, 0x27), color=color, size=7.0)
    add_text(s, desc, 7.90, y + 0.04, 4.40, 0.22, size=8.3, color=MUTED)
add_rect(s, 6.86, 5.02, 5.42, 0.42, fill=TEAL_DARK, line=RGBColor(0x1A, 0x5A, 0x54))
add_text(s, "RANKED CONTEXT  →  advisory brief", 7.02, 5.14, 5.05, 0.18, size=7.6, color=TEAL, bold=True)
add_text(s, "Cloudflare Workers AI embeddings and briefs when configured; deterministic local vectors and templates are the fallback. Playbooks are project-authored; isOfficial: false.",
         6.86, 5.62, 5.40, 0.40, size=7.6, color=DIM, line_spacing=0.92)
add_notes(s, "Graph analytics is NetworkX over real stored cells. RAG is hybrid retrieval over spatial, semantic and temporal signals. Be explicit: the hosted path is Cloudflare Workers AI bge-small-en-v1.5; deterministic hashed vectors are the no-account fallback. The 10 playbooks are project-authored templates, not official municipal SOPs.")


# 12 — LangGraph
s = new_slide(prs, 12, TOTAL)
add_section(s, "04 · Python intelligence", "LangGraph: eight advisory nodes",
            "A traceable incident-resolution workflow, not an autonomous dispatcher.")
nodes = [
    ("01", "DETECT", "incident / cell"), ("02", "RISK", "severity + urgency"),
    ("03", "CONTEXT", "RAG retrieval"), ("04", "RESOURCES", "skills + proximity"),
    ("05", "COMMUNICATE", "dispatch text"), ("06", "EXECUTE", "progress check"),
    ("07", "ESCALATE", "threshold breach"), ("08", "LEARN", "outcome sample"),
]
for i, (num, title, desc) in enumerate(nodes):
    col, row = i % 4, i // 4
    x = 0.70 + col * 2.54
    y = 1.78 + row * 1.32
    add_rect(s, x, y, 2.28, 0.98, fill=CARD, line=LINE)
    add_rect(s, x, y, 0.055, 0.98, fill=TEAL if row == 0 else AMBER, radius=False)
    add_text(s, num, x + 0.17, y + 0.12, 0.38, 0.18, size=7.2, color=TEAL if row == 0 else AMBER, bold=True)
    add_text(s, title, x + 0.55, y + 0.10, 1.55, 0.2, size=8.5, color=TEXT, bold=True)
    add_text(s, desc, x + 0.17, y + 0.48, 1.92, 0.32, size=7.6, color=MUTED)
    if i < 7:
        if col == 3:
            add_arrow(s, x + 1.14, y + 0.99, x - 1.40, y + 1.31, color=LINE, width=1.0)
        else:
            add_arrow(s, x + 2.28, y + 0.49, x + 2.54, y + 0.49, color=LINE, width=1.0)
add_rect(s, 0.70, 4.56, 9.95, 0.78, fill=RGBColor(0x0C, 0x1B, 0x27), line=LINE)
add_text(s, "ADVISORY ONLY", 0.90, 4.73, 1.6, 0.2, size=8.2, color=AMBER, bold=True)
add_text(s, "No crew assignment, SMS or incident-status mutation. The operator remains the decision-maker.",
         2.15, 4.70, 8.25, 0.28, size=9.2, color=RGBColor(0xD7, 0xE2, 0xEE))
add_rect(s, 10.82, 1.78, 1.82, 3.56, fill=TEAL_DARK, line=RGBColor(0x1A, 0x5A, 0x54))
add_text(s, "VERIFIED\nLOCAL RUN", 11.02, 1.98, 1.45, 0.55, size=8.0, color=TEAL, bold=True, line_spacing=0.95)
add_text(s, "8", 11.02, 2.62, 1.0, 0.38, size=27, color=TEXT, bold=True)
add_text(s, "trace nodes", 11.02, 3.02, 1.3, 0.18, size=7.2, color=MUTED)
add_text(s, "CRITICAL", 11.02, 3.38, 1.3, 0.2, size=8.2, color=AMBER, bold=True)
add_text(s, "immediate", 11.02, 3.58, 1.3, 0.18, size=7.4, color=MUTED)
add_text(s, "7.8 / 10", 11.02, 3.88, 1.3, 0.28, size=13, color=TEXT, bold=True)
add_text(s, "effective risk", 11.02, 4.18, 1.3, 0.18, size=7.2, color=MUTED)
add_text(s, "dry-run alerts", 11.02, 4.48, 1.3, 0.18, size=7.2, color=MUTED)
add_text(s, "5 runs recorded  ·  learning stores outcome samples; retraining is deferred.",
         0.72, 5.55, 10.0, 0.24, size=8.3, color=DIM)
add_notes(s, "Walk the eight nodes. The verified run produced a trace with eight nodes, a CRITICAL/immediate recommendation, 7.8/10 effective risk and dry-run notifications. No crew, SMS or status changed. The learning node stores outcome samples; model retraining is a separate offline job.")


# 13 — honest data ledger
s = new_slide(prs, 13, TOTAL)
add_section(s, "05 · Evidence & boundaries", "The honest data ledger",
            "If it is not in this table, we do not claim it.")
rows = [
    ("LAYER", "SOURCE", "STATUS", "WHAT IT MEANS"),
    ("Weather", "Open-Meteo", ("LIVE + IDW", TEAL, True), "100 events; interpolated per cell, not one city reading."),
    ("Roads & terrain", "OSM + elevation", ("REAL STATIC", BLUE, True), "5,211 road segments; 100 terrain cells; real names and watercourses."),
    ("Traffic", "TomTom", ("LIVE", TEAL, True), "60 events: 46 flow + 14 incidents; 60-minute polling; not bus data."),
    ("Transit", "GTFS-RT", ("NO LIVE FEED", AMBER, True), "Zero GTFS rows; GTFS_RT_URL unset; simulation disabled."),
    ("Incidents", "Operator workflow", ("DEMO / TEST", RED, True), "13 records created during development; not municipal history."),
    ("Citizen reports", "QR / public API", ("AVAILABLE", BLUE, True), "Path exists; zero citizen rows in the current DB."),
    ("Intelligence", "Python service", ("LIVE LOCAL", TEAL, True), "23 docs; 5 agent runs; advisory only; Cloudflare Workers AI + local fallback."),
    ("Performance", "Not measured", ("NOT CLAIMED", RED, True), "No 40–60% response-time or resolution claim."),
]
add_grid_table(s, 0.67, 1.62, [1.10, 2.03, 1.47, 7.35], rows, row_h=0.52)
add_text(s, "This ledger is the boundary of the project. It is also the answer to the first viva question: “what is actually real?”",
         0.68, 6.72, 11.9, 0.24, size=8.4, color=DIM, italic=True)
add_notes(s, "This is the most important slide for credibility. Read the statuses. Weather and traffic are live but weather is interpolated. Transit is not live. The 13 incidents are test records. Citizen reports are supported but there are zero rows. The intelligence service is live locally but advisory. No performance improvement is claimed.")


# 14 — verified snapshot
s = new_slide(prs, 14, TOTAL)
add_section(s, "05 · Evidence & boundaries", "Verified system snapshot",
            "Local development stack, 11 November 2026. Not a production SLA.")
metrics = [
    ("100", "H3 CELLS", "43 Bhopal · 32 Indore · 25 Sehore", TEAL),
    ("5,211", "OSM ROAD SEGMENTS", "Real road network + 100 terrain cells", BLUE),
    ("260", "TELEMETRY EVENTS", "100 weather · 100 GIS · 60 traffic", TEAL),
    ("150", "ALERTS", "28 currently open", AMBER),
    ("13", "TEST INCIDENTS", "5 approved · 4 escalated · 2 detected · 2 resolved", RED),
    ("5", "AGENT RUNS", "23 knowledge docs · 8-node traces", AMBER),
]
for i, (value, label, note, accent) in enumerate(metrics):
    col, row = i % 3, i // 3
    x = 0.67 + col * 2.42
    y = 1.72 + row * 2.00
    add_metric(s, x, y, 2.28, 1.78, value, label, note, accent)
# screenshot
add_rect(s, 8.02, 1.68, 4.62, 4.15, fill=CARD, line=LINE)
pic = s.shapes.add_picture(str(ASSETS / "intelligence_hero.png"), Inches(8.18), Inches(1.86), width=Inches(4.30))
add_text(s, "Intelligence page  ·  local dev  ·  service healthy", 8.18, 5.42, 4.30, 0.2, size=7.4, color=DIM, italic=True)
add_rect(s, 0.67, 5.92, 11.95, 0.62, fill=CARD, line=LINE)
add_text(s, "2 live services healthy", 0.88, 6.08, 1.85, 0.2, size=8.4, color=TEAL, bold=True)
add_text(s, "Node API + Python FastAPI  ·  frontend on Vite  ·  100 materialized memory docs  ·  1,053 audit entries",
         2.65, 6.05, 9.55, 0.24, size=8.5, color=MUTED)
add_notes(s, "Use these numbers instead of adjectives. 100 cells, 5,211 road segments, 260 telemetry events, 150 alerts with 28 open, 13 test incidents, 5 agent runs. The 60 traffic readings are road measurements, not bus data. Two services are healthy. Note that this is a local dev measurement, not a production benchmark.")


# 15 — EPICS feasibility
s = new_slide(prs, 15, TOTAL)
add_section(s, "06 · EPICS & next", "EPICS fit: feasible, useful, honest",
            "VIT Bhopal evaluates economic, societal, environmental, demographic feasibility and implementation. Here is the honest read.")
feas = [
    ("ECONOMIC", ["Open-source stack", "Existing APIs + request budget", "No new hardware"], TEAL),
    ("SOCIETAL", ["Citizen QR reporting", "Transparent alerts", "Field accountability"], BLUE),
    ("ENVIRONMENTAL", ["Flood / traffic resilience screening", "No emissions claim", "Climate data is measured"], AMBER),
    ("DEMOGRAPHIC", ["Bhopal, Indore, Sehore", "English UI today", "Local-language next"], BLUE),
    ("IMPLEMENTATION", ["Working local stack", "Tests + docs", "Official access pending"], TEAL),
]
for i, (title, lines, accent) in enumerate(feas):
    x = 0.67 + i * 2.40
    add_bullet_card(s, x, 1.72, 2.18, 2.55, title, lines, accent=accent)
add_rect(s, 0.67, 4.65, 11.95, 1.05, fill=AMBER_DARK, line=RGBColor(0x6B, 0x50, 0x16))
add_text(s, "The missing evidence is community validation — not another feature.",
         0.90, 4.87, 11.45, 0.32, size=15, color=AMBER, bold=True, font=FONT_SEMI)
add_text(s, "Next: 15–25 citizen and stakeholder interviews, 5 field observations, 3 review sessions, then a ward-level pilot.",
         0.90, 5.28, 11.45, 0.24, size=9.0, color=RGBColor(0xF5, 0xD9, 0x9A))
add_text(s, "What works today", 0.67, 6.08, 1.4, 0.2, size=7.8, color=TEAL, bold=True)
add_text(s, "Working software  ·  real weather/roads/traffic  ·  explainable risk  ·  incident lifecycle  ·  Python intelligence  ·  documented limits",
         1.90, 6.04, 10.7, 0.24, size=8.3, color=MUTED)
add_notes(s, "Map the project to the five EPICS criteria. The strongest columns are implementation and economic feasibility. The weakest is community validation. Say that directly: the next step is not more code, it is 15–25 real interviews and a ward-level pilot.")


# 16 — limits + roadmap
s = new_slide(prs, 16, TOTAL)
add_section(s, "06 · EPICS & next", "What we do not claim — and what comes next",
            "The engineering is ahead of the evidence. Close that gap before adding modules.")
add_rect(s, 0.67, 1.72, 5.55, 3.95, fill=CARD, line=LINE)
add_text(s, "NOT CLAIMED", 0.92, 1.92, 1.5, 0.2, size=8.2, color=RED, bold=True)
not_claims = [
    "Live Bhopal transit",
    "Real municipal incident history",
    "Measured 40–60% response improvement",
    "Production municipal deployment",
    "Official municipal SOPs",
]
for i, text in enumerate(not_claims):
    y = 2.32 + i * 0.56
    icon_dot(s, 0.94, y + 0.09, RED, 0.09)
    add_text(s, text, 1.18, y, 4.72, 0.25, size=9.8, color=RGBColor(0xD7, 0xE2, 0xEE))
add_text(s, "These are boundaries, not failures. They keep the demo defensible.",
         0.94, 5.18, 4.90, 0.24, size=8.2, color=DIM, italic=True)
# roadmap
add_text(s, "NEXT 90 DAYS", 6.60, 1.84, 1.5, 0.2, size=8.2, color=TEAL, bold=True)
roadmap = [
    ("NOW", "Mark demo data. Freeze features. Record a backup demo."),
    ("2 WEEKS", "Promote TomTom / corroborated citizen alerts to DETECTED; targeted cell recalculation."),
    ("4–6 WEEKS", "Request GTFS / ICCC access; build a labelled replay fixture for the transit adapter."),
    ("8–12 WEEKS", "15–25 citizen interviews; 3 stakeholder reviews; ward-level pilot plan."),
]
for i, (when, what) in enumerate(roadmap):
    y = 2.22 + i * 0.86
    add_text(s, when, 6.60, y, 1.0, 0.2, size=7.8, color=TEAL if i < 2 else AMBER, bold=True)
    add_text(s, what, 7.62, y - 0.02, 4.85, 0.55, size=8.9, color=MUTED, line_spacing=0.95)
    if i < 3:
        add_arrow(s, 7.62, y + 0.53, 7.62, y + 0.80, color=LINE, width=0.9)
add_rect(s, 6.60, 5.72, 6.02, 0.55, fill=TEAL_DARK, line=RGBColor(0x1A, 0x5A, 0x54))
add_text(s, "Ship the honest boundary, then earn the next data source.", 6.80, 5.87, 5.60, 0.22, size=9.2, color=TEAL, bold=True)
add_notes(s, "This is the roadmap slide. The left column is a pre-emptive answer to the toughest questions. The right column is what to do next. Emphasize that marking demo data and promoting real alerts are higher value than adding more Python features before the review.")


# 17 — demo + close
s = new_slide(prs, 17, TOTAL)
add_section(s, "06 · EPICS & next", "Seven-minute demo flow",
            "Show the working loop, then show the boundary. Do not hide either.")
demo = [
    ("0:00", "LANDING / LOGIN", "Role-based entry: operator, field crew, admin."),
    ("1:00", "OPERATOR MAP", "100 cells across 3 cities; calm conditions shown honestly."),
    ("2:30", "CELL DETAIL", "Risk, evidence, alerts and data confidence."),
    ("3:30", "DECISION", "Lock, approve/override, dispatch, audit."),
    ("5:00", "INTELLIGENCE", "Memory, graph, RAG and agent trace."),
    ("6:00", "BOUNDARIES", "Live vs demo vs missing; next steps."),
]
for i, (time, title, desc) in enumerate(demo):
    y = 1.72 + i * 0.67
    add_text(s, time, 0.72, y + 0.04, 0.55, 0.18, size=8.2, color=TEAL, bold=True)
    add_text(s, title, 1.42, y, 1.55, 0.22, size=8.7, color=TEXT, bold=True)
    add_text(s, desc, 3.05, y - 0.01, 4.0, 0.38, size=8.5, color=MUTED, line_spacing=0.93)
add_rect(s, 7.42, 1.68, 5.22, 3.30, fill=CARD, line=LINE)
add_text(s, "Q&A READY", 7.66, 1.90, 1.3, 0.2, size=8.2, color=AMBER, bold=True)
qa = [
    "What is live today?",
    "Why is there no Bhopal transit feed?",
    "How accurate is the score?",
    "What would you do with municipal access?",
]
for i, q in enumerate(qa):
    add_text(s, f"0{i+1}", 7.68, 2.28 + i * 0.60, 0.32, 0.18, size=7.8, color=TEAL, bold=True)
    add_text(s, q, 8.10, 2.24 + i * 0.60, 4.15, 0.25, size=9.2, color=RGBColor(0xD7, 0xE2, 0xEE))
add_text(s, "Backup: recorded walkthrough + labelled demo data. Never present test incidents as live.",
         7.66, 4.62, 4.70, 0.26, size=7.5, color=DIM, italic=True)
add_text(s, "Thank you.", 0.70, 5.48, 3.0, 0.62, size=32, color=TEXT, bold=True, font=FONT_SEMI)
add_text(s, "Metabolic City AI  ·  EPICS  ·  VIT Bhopal", 0.72, 6.18, 5.2, 0.24, size=9.2, color=TEAL, bold=True)
add_text(s, "A city-scale prototype with the data boundaries written down.", 0.72, 6.48, 5.6, 0.24, size=8.8, color=MUTED, italic=True)
add_notes(s, "Close on the demo flow. Six minutes is enough if you move quickly. The Q&A slide is a cue card for the four questions evaluators are most likely to ask. The final line is the thesis: a city-scale prototype with the data boundaries written down.")


# 18 — appendix: transit status
s = new_slide(prs, 18, TOTAL)
add_section(s, "Appendix · transit status", "What “transit” means in this build",
            "No live bus feed. Today’s mobility score is a road-traffic signal, not a transit-performance measurement.")
transit_cards = [
    ("LIVE", "TomTom road traffic",
     "46 flow readings + 14 incident readings at the last snapshot. This is the road data currently feeding mobility.", TEAL),
    ("DORMANT", "GTFS-Realtime adapter",
     "The adapter exists, but GTFS_RT_URL is unset, so the poller never starts. Current GTFS_TRANSIT rows: zero.", AMBER),
    ("DISABLED", "Simulated transit",
     "TRANSIT_SIMULATION_ENABLED=false. The static route/stop list is hand-maintained, not an official GTFS import.", RED),
]
for i, (status, title, body, accent) in enumerate(transit_cards):
    x = 0.67 + i * 4.08
    add_rect(s, x, 1.72, 3.78, 2.02, fill=CARD, line=LINE)
    add_rect(s, x, 1.72, 3.78, 0.055, fill=accent, radius=False)
    add_text(s, status, x + 0.20, 1.92, 1.5, 0.18, size=7.6, color=accent, bold=True)
    add_text(s, title, x + 0.20, 2.16, 3.38, 0.26, size=11.2, color=TEXT, bold=True, font=FONT_SEMI)
    add_text(s, body, x + 0.20, 2.54, 3.36, 1.02, size=8.5, color=MUTED, line_spacing=0.96)

add_rect(s, 0.67, 4.00, 5.75, 2.40, fill=RGBColor(0x0C, 0x1B, 0x27), line=LINE)
add_text(s, "WHAT THE SCORE ACTUALLY USES", 0.89, 4.20, 3.5, 0.2, size=8.0, color=TEAL, bold=True)
actual = [
    "0 GTFS transit events",
    "60 road-traffic readings: 46 flow + 14 incidents",
    "100 weather + 100 terrain events",
    "Mobility = road congestion and disruption, not bus punctuality",
]
for i, text in enumerate(actual):
    icon_dot(s, 0.92, 4.60 + i * 0.42, TEAL if i < 3 else AMBER, 0.08)
    add_text(s, text, 1.14, 4.54 + i * 0.42, 5.02, 0.38, size=8.7,
             color=RGBColor(0xD7, 0xE2, 0xEE) if i < 3 else AMBER, line_spacing=0.95)

add_rect(s, 6.55, 4.00, 6.07, 2.40, fill=CARD, line=LINE)
add_text(s, "TO TURN ON REAL TRANSIT", 6.77, 4.20, 3.4, 0.2, size=8.0, color=AMBER, bold=True)
steps = [
    ("01", "City supplies a GTFS-RT URL, directly or through an AVLS adapter."),
    ("02", "Feed provides vehicle positions and trip/stop identifiers."),
    ("03", "Set GTFS_RT_URL; the adapter polls and writes GTFS_TRANSIT events."),
    ("04", "Validate stop attribution, delay maths and replay against known runs."),
]
for i, (num, text) in enumerate(steps):
    y = 4.54 + i * 0.37
    add_text(s, num, 6.77, y, 0.34, 0.18, size=7.4, color=TEAL, bold=True)
    add_text(s, text, 7.15, y - 0.02, 5.18, 0.32, size=8.2, color=MUTED, line_spacing=0.94)

add_rect(s, 0.67, 6.55, 11.95, 0.42, fill=AMBER_DARK, line=RGBColor(0x6B, 0x50, 0x16))
add_text(s, "Pitch line: “We have a transit adapter ready; we do not have a live transit feed, so we do not claim bus performance.”",
         0.88, 6.66, 11.55, 0.22, size=8.9, color=AMBER, bold=True)
add_notes(s, "Use this appendix only if a judge asks why transit is missing. Be direct: there are zero GTFS_TRANSIT rows. The GTFS-Realtime adapter is code, not a data source, and GTFS_RT_URL is unset. The simulated transit generator is disabled because a modelled bus delay is not a measurement. Today's mobility score comes from TomTom road flow and incidents. If the city provides a feed, the adapter can be activated, but it needs stop-ID mapping and validation; the current code reads vehicle.trip.stopId, which is not a standard GTFS-RT field, so it must be tested against the real feed before it is trusted.")




prs.save(OUT)
print(f"WROTE {OUT}")
print(f"SLIDES {len(prs.slides)}")
