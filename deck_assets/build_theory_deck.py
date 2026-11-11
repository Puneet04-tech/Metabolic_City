"""Build the Metabolic City technical theory deck (36 slides, 16:9)."""
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "deck_assets"
OUT = ROOT / "Metabolic_City_AI_Technical_Theory.pptx"
POSTER = ROOT / "Metabolic_City_AI_System_Architecture.png"
TOTAL = 36

NAVY = "0B1B2B"; INK = "12263A"; MUTED = "5B7083"; FAINT = "8A9BAD"
BG = "F5F7FA"; CARD = "FFFFFF"; LINE = "D8E2EC"
TEAL = "0F766E"; TEAL_S = "E7F4F1"; BLUE = "1D4ED8"; BLUE_S = "EBF1FF"
AMBER = "B45309"; AMBER_S = "FFF5E7"; RED = "B91C1C"; RED_S = "FDECEC"
GREEN = "15803D"; GREEN_S = "EAF7EF"; PURPLE = "6D28D9"; PURPLE_S = "F3EEFF"
FONT = "Segoe UI"

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]
SW, SH = 13.333, 7.5


def C(h):
    return RGBColor.from_string(h)


def shape(slide, kind, x, y, w, h, fill=None, line=None, lw=0.8, radius=False):
    s = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill:
        s.fill.solid(); s.fill.fore_color.rgb = C(fill)
    else:
        s.fill.background()
    if line:
        s.line.color.rgb = C(line); s.line.width = Pt(lw)
    else:
        s.line.fill.background()
    return s


def text(slide, x, y, w, h, value, size=10, color=INK, bold=False,
         align=PP_ALIGN.LEFT, font=FONT, anchor=MSO_ANCHOR.TOP,
         italic=False, spacing=1.0, margin=0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]; p.alignment = align
    p.line_spacing = spacing
    r = p.add_run(); r.text = str(value)
    r.font.name = font; r.font.size = Pt(size); r.font.bold = bold
    r.font.italic = italic; r.font.color.rgb = C(color)
    return box


def multi(slide, x, y, w, h, lines, size=10, color=INK, lead=TEAL,
          bullet=False, gap=5, spacing=0.96, margin=0):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame; tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(margin)
    tf.margin_top = tf.margin_bottom = 0
    first = True
    for item in lines:
        p = tf.paragraphs[0] if first else tf.add_paragraph()
        first = False
        p.space_after = Pt(gap); p.line_spacing = spacing
        if isinstance(item, tuple):
            head, rest = item
            r = p.add_run(); r.text = ("• " if bullet else "") + head
            r.font.name = FONT; r.font.size = Pt(size); r.font.bold = True
            r.font.color.rgb = C(lead)
            if rest:
                r2 = p.add_run(); r2.text = "  " + rest
                r2.font.name = FONT; r2.font.size = Pt(size)
                r2.font.color.rgb = C(color)
        else:
            r = p.add_run(); r.text = ("• " if bullet else "") + str(item)
            r.font.name = FONT; r.font.size = Pt(size)
            r.font.color.rgb = C(color)
    return box


def header(slide, eyebrow, title, subtitle=None, dark=False):
    fg = "FFFFFF" if dark else NAVY
    sub = "B9CAD9" if dark else MUTED
    shape(slide, MSO_SHAPE.RECTANGLE, 0.55, 0.42, 0.34, 0.05, TEAL)
    text(slide, 1.0, 0.33, 10.3, 0.22, eyebrow.upper(), 8, TEAL, True)
    text(slide, 0.55, 0.62, 12.2, 0.52, title, 24, fg, True)
    if subtitle:
        text(slide, 0.55, 1.13, 12.2, 0.34, subtitle, 10, sub)


def footer(slide, page, note="Metabolic City AI  ·  Technical theory  ·  local prototype, November 2026"):
    shape(slide, MSO_SHAPE.RECTANGLE, 0.55, 7.11, 12.23, 0.008, LINE)
    text(slide, 0.55, 7.18, 10.6, 0.2, note, 7, FAINT)
    text(slide, 11.5, 7.18, 1.28, 0.2, f"{page:02d} / {TOTAL}", 7, FAINT,
         align=PP_ALIGN.RIGHT)


def new_slide(page, eyebrow=None, title=None, subtitle=None, chrome=True):
    s = prs.slides.add_slide(BLANK)
    bg = s.background.fill; bg.solid(); bg.fore_color.rgb = C(BG)
    if chrome:
        header(s, eyebrow, title, subtitle)
        footer(s, page)
    return s


def card(slide, x, y, w, h, kicker, title, lines, accent=TEAL,
         fill=CARD, size=8.4, title_size=10.5, gap=4):
    shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, fill, LINE)
    shape(slide, MSO_SHAPE.RECTANGLE, x, y, 0.045, h, accent)
    text(slide, x + 0.18, y + 0.13, w - 0.32, 0.18, kicker.upper(), 7, accent, True)
    text(slide, x + 0.18, y + 0.35, w - 0.32, 0.28, title, title_size, NAVY, True)
    multi(slide, x + 0.18, y + 0.72, w - 0.34, h - 0.82, lines,
          size=size, gap=gap, bullet=False)


def metric(slide, x, y, w, h, value, label, note=None, accent=TEAL, fill=CARD):
    shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, fill, LINE)
    shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, 0.04, accent)
    text(slide, x + 0.16, y + 0.18, w - 0.3, 0.42, value, 21, accent, True)
    text(slide, x + 0.16, y + 0.62, w - 0.3, 0.22, label.upper(), 7, NAVY, True)
    if note:
        text(slide, x + 0.16, y + 0.86, w - 0.3, h - 0.92, note, 7.2, MUTED, spacing=0.95)


def pill(slide, x, y, w, h, label, fill, fg, size=7.4, bold=True):
    s = shape(slide, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill, None)
    s.adjustments[0] = 0.4
    text(slide, x, y + (h - 0.15) / 2 - 0.01, w, 0.18, label, size, fg, bold,
         align=PP_ALIGN.CENTER)


def table(slide, x, y, widths, rows, row_h=0.38, size=8.2, head_size=7.6,
          head_fill=NAVY, zebra=True):
    xx = x
    for i, w in enumerate(widths):
        c = rows[0][i]
        shape(slide, MSO_SHAPE.RECTANGLE, xx, y, w, row_h, head_fill, LINE, 0.6)
        text(slide, xx + 0.1, y + 0.08, w - 0.18, row_h - 0.1, c, head_size,
             "FFFFFF", True)
        xx += w
    for r, row in enumerate(rows[1:]):
        yy = y + row_h * (r + 1)
        xx = x
        bg = "FFFFFF" if (r % 2 == 0 or not zebra) else "F8FAFC"
        for i, w in enumerate(widths):
            val = row[i]
            color = INK; bold = False
            if isinstance(val, tuple):
                val, color = val[0], val[1]
                bold = len(val) > 0 and False
            shape(slide, MSO_SHAPE.RECTANGLE, xx, yy, w, row_h, bg, LINE, 0.5)
            text(slide, xx + 0.1, yy + 0.07, w - 0.16, row_h - 0.08,
                 val, size, color, bold, spacing=0.9)
            xx += w


def formula(slide, x, y, w, h, expr, note=None, fill=NAVY, fg="FFFFFF", size=13):
    shape(slide, MSO_SHAPE.RECTANGLE, x, y, w, h, fill, None)
    text(slide, x + 0.2, y + 0.16, w - 0.4, h - 0.28, expr, size, fg, True,
         spacing=1.0)
    if note:
        text(slide, x + 0.2, y + h - 0.32, w - 0.4, 0.22, note, 7, "B9CAD9")


def arrow(slide, x, y, w=0.3, h=0.14, color=FAINT):
    s = shape(slide, MSO_SHAPE.RIGHT_ARROW, x, y, w, h, color, None)
    return s


def notes(slide, body):
    slide.notes_slide.notes_text_frame.text = body


# 01 — Cover
s = prs.slides.add_slide(BLANK)
bg = s.background.fill; bg.solid(); bg.fore_color.rgb = C(NAVY)
for i in range(9):
    shape(s, MSO_SHAPE.HEXAGON, 10.4 + (i % 3) * 0.92, 0.25 + (i // 3) * 0.94,
          0.82, 0.72, None, "21445F", 0.8)
shape(s, MSO_SHAPE.RECTANGLE, 0, 0, 0.12, 7.5, TEAL)
text(s, 0.82, 0.8, 9.0, 0.3, "METABOLIC CITY AI  /  EPICS", 9, "70D6C8", True)
text(s, 0.82, 1.32, 11.4, 1.5, "The city as a\nliving system.", 46, "FFFFFF", True, spacing=0.9)
text(s, 0.82, 3.15, 10.6, 0.62,
     "Theory, architecture and implementation of an evidence-first urban risk platform.",
     16, "D6E2EC")
shape(s, MSO_SHAPE.RECTANGLE, 0.82, 4.02, 2.25, 0.04, TEAL)
text(s, 0.82, 4.26, 5.2, 0.3, "TECHNICAL THEORY DECK", 8, "70D6C8", True)
text(s, 0.82, 4.56, 5.2, 0.3, "36 slides  ·  November 2026", 9, "B9CAD9")
text(s, 0.82, 6.55, 11.6, 0.5,
     "A local, working prototype. Every number in this deck is labelled by how it was produced.",
     8.5, "8FA6B8")
text(s, 11.0, 6.55, 1.5, 0.25, "v1.0", 8, "70D6C8", True, align=PP_ALIGN.RIGHT)
notes(s, "This is the technical theory deck, not the pitch. It explains why the model is built the way it is, then follows a signal through the full system. The evidence labels matter: measured, static, modelled, simulated, demo and unavailable are different claims.")

# 02 — Evidence rules
def evidence_slide():
    s = new_slide(2, "Reading this deck", "Six evidence classes, never blended",
                  "Every data point and every chart carries the weakest label in its chain.")
    items = [
        ("MEASURED / LIVE", "Direct provider readings or stored API responses.", "TomTom flow and incidents; weather provider observations; citizen GPS.", TEAL),
        ("REAL STATIC", "Project-loaded geometry or reference data.", "5,211 OSM road segments; 100 terrain cells; H3 cell boundaries.", BLUE),
        ("INTERPOLATED", "Computed between measured points.", "Inverse-distance weather at cell centroids; res-6 and res-4 parent rollups.", AMBER),
        ("MODELLED", "Deterministic scoring from defined inputs.", "Composite risk, mobility, climate, vulnerability, forecasts.", PURPLE),
        ("SIMULATED", "Generated locally to exercise a path.", "Citizen reports and field outbox entries; transit when simulation is enabled.", "7C3AED"),
        ("UNAVAILABLE", "Absent, not zero; never filled with fiction.", "GTFS-Realtime today: URL unset, 0 rows, adapter dormant.", RED),
    ]
    for i, (k, d, ex, col) in enumerate(items):
        x = 0.55 + (i % 3) * 4.12; y = 1.56 + (i // 3) * 2.03
        card(s, x, y, 3.91, 1.83, k, d, [("In this build:", ex)], accent=col, size=8.2)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 5.72, 12.23, 0.87, TEAL_S, None)
    text(s, 0.8, 5.9, 2.4, 0.24, "THE HOUSE RULE", 8, TEAL, True)
    text(s, 0.8, 6.17, 11.6, 0.34,
         "A missing input lowers confidence and is reported as missing. It is never replaced by a believable number.",
         11.5, NAVY, True)
    notes(s, "The deck uses six labels. Measured means a provider reading reached the database. Real static means project-loaded geometry. Interpolated means computed between points. Modelled means a deterministic score. Simulated means generated to test a path. Unavailable means absent and explicitly not filled. Do not promote a modelled score to a measurement because it looks precise.")

# 03 — System at a glance
def glance_slide():
    s = new_slide(3, "System at a glance", "Three runtimes, one operational record",
                  "A MERN core owns state; Python may advise; the browser never talks to Python.")
    text(s, 0.55, 1.55, 2.2, 0.22, "REQUEST PATH", 7.5, FAINT, True)
    layers = [
        ("EXPERIENCE", "React 18 + Vite", "Operator console, field crew, admin, public citizen report. Role-shaped routes and an offline field outbox.", BLUE),
        ("OPERATIONAL CORE", "Node.js + Express + Socket.IO", "Authentication, validation, ingestion, H3 risk engine, alerts, incidents, audit, SSE and Socket.IO fan-out.", TEAL),
        ("SHARED STATE", "MongoDB Atlas + Mongoose", "One system of record for cells, telemetry, alerts, incidents, evidence, knowledge and audit. Python reads it; Node owns writes.", AMBER),
        ("INTELLIGENCE", "Python FastAPI", "Cell memory, multi-resolution H3, graph analytics, hybrid RAG and a LangGraph advisory workflow. Internal only.", PURPLE),
    ]
    for i, (k, t, d, col) in enumerate(layers):
        y = 1.85 + i * 1.14
        shape(s, MSO_SHAPE.RECTANGLE, 0.55, y, 6.25, 0.98, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, 0.55, y, 0.055, 0.98, col)
        text(s, 0.75, y + 0.12, 2.15, 0.2, k, 7, col, True)
        text(s, 2.8, y + 0.1, 3.7, 0.24, t, 10.5, NAVY, True)
        text(s, 0.75, y + 0.4, 5.85, 0.52, d, 8.2, MUTED, spacing=0.94)
        if i < 3:
            text(s, 3.45, y + 0.98, 0.4, 0.16, "↓", 11, FAINT, True, align=PP_ALIGN.CENTER)
    metric(s, 7.1, 1.55, 2.72, 1.32, "100", "spatial cells", "43 Bhopal · 32 Indore · 25 Sehore", TEAL)
    metric(s, 10.0, 1.55, 2.78, 1.32, "260", "telemetry events", "100 weather · 100 GIS · 60 traffic", BLUE)
    metric(s, 7.1, 3.03, 2.72, 1.32, "150", "alerts", "28 open · 96 resolved · 26 expired", AMBER)
    metric(s, 10.0, 3.03, 2.78, 1.32, "13", "incidents", "5 approved · 4 escalated", PURPLE)
    shape(s, MSO_SHAPE.RECTANGLE, 7.1, 4.52, 5.68, 1.95, CARD, LINE)
    text(s, 7.3, 4.7, 5.2, 0.22, "WHAT IS ACTUALLY RUNNING", 7.5, TEAL, True)
    multi(s, 7.3, 5.0, 5.25, 1.35, [
        ("Live:", "Node, Python and Mongo; Cloudflare Workers AI when configured, deterministic fallbacks otherwise."),
        ("Dormant:", "GTFS-Realtime; simulation switch is off and no feed is configured."),
        ("Not claimed:", "live Bhopal municipal feed, production SLA, measured 40–60% improvement."),
    ], size=8.1, gap=4, bullet=True)
    notes(s, "The architecture is deliberately boring at the core: Node is the only writer to the operational database. Python reads and returns advisory results. The numbers are a snapshot of the local database, not a production city feed.")

# 04 — Theory
def theory_slide():
    s = new_slide(4, "Theory", "Urban metabolism, made operational",
                  "The metaphor is useful only where it produces a measurable state and a testable action.")
    text(s, 0.55, 1.55, 2.6, 0.22, "METABOLIC INPUTS", 7.5, FAINT, True)
    ins = [("Mobility", "people and goods moving", BLUE), ("Climate", "rain, heat, wind, visibility", TEAL),
           ("Terrain", "water, slope, flood exposure", AMBER), ("Signals", "citizen and field reports", PURPLE)]
    for i, (t, d, col) in enumerate(ins):
        y = 1.86 + i * 1.02
        shape(s, MSO_SHAPE.RECTANGLE, 0.55, y, 2.95, 0.84, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, 0.55, y, 0.05, 0.84, col)
        text(s, 0.72, y + 0.1, 2.6, 0.2, t, 9.5, NAVY, True)
        text(s, 0.72, y + 0.36, 2.6, 0.4, d, 7.6, MUTED)
    shape(s, MSO_SHAPE.RECTANGLE, 3.85, 1.86, 4.95, 3.84, NAVY, None)
    text(s, 4.1, 2.02, 4.45, 0.22, "THE CITY AS A COUPLED SYSTEM", 7.5, "70D6C8", True)
    text(s, 4.1, 2.38, 4.4, 0.62, "Stress does not stay\nin one sector.", 22, "FFFFFF", True, spacing=0.92)
    text(s, 4.1, 3.18, 4.35, 1.55,
         "Rain slows traffic. A blocked road raises local exposure. Repeated reports raise vulnerability. Those effects meet in a shared spatial unit, not in separate departmental dashboards.",
         9.0, "D6E2EC", spacing=0.98)
    shape(s, MSO_SHAPE.RECTANGLE, 4.1, 4.9, 4.35, 0.55, "17364D", None)
    text(s, 4.25, 5.04, 4.05, 0.3, "H3 res 8 is the common unit of account.", 8.2, "A9E7DD", True)
    text(s, 9.25, 1.55, 3.5, 0.22, "EMERGENT OUTPUTS", 7.5, FAINT, True)
    outs = [("Congestion", "mobility score"), ("Flood exposure", "climate + terrain"),
            ("Service demand", "vulnerability + reports"), ("Operational priority", "risk + confidence")]
    for i, (t, d) in enumerate(outs):
        y = 1.86 + i * 1.02
        shape(s, MSO_SHAPE.RECTANGLE, 9.25, y, 3.53, 0.84, CARD, LINE)
        text(s, 9.42, y + 0.1, 3.2, 0.2, t, 9.5, NAVY, True)
        text(s, 9.42, y + 0.36, 3.2, 0.4, d, 7.6, MUTED)
    text(s, 3.55, 3.55, 0.3, 0.3, "→", 18, FAINT, True)
    text(s, 8.95, 3.55, 0.3, 0.3, "→", 18, FAINT, True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 6.03, 12.23, 0.65, TEAL_S, None)
    text(s, 0.8, 6.18, 11.8, 0.3,
         "The theory earns its place when it changes a decision: which cell to inspect, with what evidence, and at what confidence.",
         9.6, TEAL, True)
    notes(s, "Urban metabolism is a framing device, not a validated biophysical model. It gives four input families and a coupling argument. The platform makes that argument operational by scoring a shared H3 cell and carrying the evidence and confidence beside the score.")

# 05 — Principles
def principles_slide():
    s = new_slide(5, "Design stance", "Six principles that constrain the build",
                  "These are implementation rules, not slogans; each one has a visible consequence in the code.")
    ps = [
        ("01", "One spatial unit", "H3 res 8 is the join key across risk, alerts, incidents, evidence and analytics. Res 6 and res 4 are rollups, not separate truths.", TEAL),
        ("02", "Evidence before eloquence", "A score carries inputs, source types, freshness, completeness and confidence. Missing is a state, not a zero.", BLUE),
        ("03", "Human authority", "The system ranks and recommends. A human approves, overrides, dispatches and closes. Python cannot change incident status.", AMBER),
        ("04", "Deterministic by default", "The risk engine is arithmetic and windows, not an opaque model. Forecasts are trend projections and are labelled as such.", PURPLE),
        ("05", "Advisory intelligence", "Memory, graph, RAG and agents read the record and add context. They do not become a second source of operational truth.", "7C3AED"),
        ("06", "Operable under failure", "Idempotency, dead-letter queues, circuit breakers, provider fallbacks, SSE reconnect and an offline field outbox are part of the design.", GREEN),
    ]
    for i, (n, t, d, col) in enumerate(ps):
        x = 0.55 + (i % 3) * 4.12; y = 1.56 + (i // 3) * 2.15
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 3.91, 1.96, CARD, LINE)
        text(s, x + 0.18, y + 0.14, 0.55, 0.34, n, 17, col, True)
        text(s, x + 0.78, y + 0.16, 2.95, 0.28, t, 10.6, NAVY, True)
        text(s, x + 0.18, y + 0.62, 3.55, 1.2, d, 8.5, MUTED, spacing=0.97)
    text(s, 0.55, 6.1, 12.2, 0.45, "A principle that cannot be pointed to in a route, schema or test is not a principle yet.",
         9.5, FAINT, italic=True)
    notes(s, "The principles explain several choices that otherwise look over-engineered: the 100 kB JSON cap, idempotency keys, the 60-second cell lock, the no-zero-fill rule and the Python boundary. Each is a response to a concrete failure mode.")

# 06 — Architecture poster
def architecture_slide():
    s = prs.slides.add_slide(BLANK)
    s.shapes.add_picture(str(POSTER), 0, 0, width=prs.slide_width, height=prs.slide_height)
    notes(s, "This is the complete system architecture. Read it left to right: channels, external signals, the Node operational core, the shared Mongo state, and the Python intelligence layer. The evidence boundary and cross-cutting guarantees sit below. The poster is also a standalone PNG at 3200 by 1800.")

# 07 — MERN
def mern_slide():
    s = new_slide(7, "Architecture", "MERN, with explicit responsibilities",
                  "The stack is not a slogan: each tier has a boundary and a failure mode.")
    rows = [
        ["Tier", "Technology", "Owns", "Does not own"],
        ["M", "MongoDB Atlas + Mongoose", "Operational record: cells, telemetry, alerts, incidents, users, audit, evidence, knowledge.", "Business rules, scoring, authorisation."],
        ["E", "Express 4 on Node.js 20", "HTTP edge, auth, validation, orchestration, risk engine, incident workflow, realtime fan-out.", "Heavy spatiotemporal analytics or LLM work."],
        ["R", "React 18 + Vite + Tailwind", "Role-shaped operator, field, admin and public experiences; live map; offline outbox.", "Direct database access or Python calls."],
        ["N", "Node.js runtime", "The same process that serves the API also runs ingestion, risk cycles and Socket.IO.", "A separate always-on worker tier."],
    ]
    table(s, 0.55, 1.55, [0.62, 2.65, 5.1, 3.86], rows, row_h=0.60, size=8.3)
    card(s, 0.55, 5.05, 3.9, 1.65, "Why this shape", "Fast to operate",
         ["One language across the API and UI; one database; no service mesh. A small team can trace a request end to end."], accent=TEAL)
    card(s, 4.62, 5.05, 3.9, 1.65, "Trade-off", "Not a microservice estate",
         ["Analysis is isolated in Python, but the operational core remains a modular monolith. Scaling means separating cycles and sockets, not pretending they are already separate."], accent=AMBER)
    card(s, 8.69, 5.05, 4.09, 1.65, "Boundary", "Node is the writer",
         ["Python reads the shared database and returns advisory output. No Python route can approve an incident, dispatch a crew or send an SMS."], accent=PURPLE)
    notes(s, "MERN is used literally: MongoDB, Express, React and Node. The important architectural point is not the acronym but the write boundary. Node owns operational writes. Python is an internal advisory service. The frontend sees only the Node API.")

# 08 — Request pipeline
def pipeline_slide():
    s = new_slide(8, "Operational core", "Every API request crosses the same edge",
                  "Security and traceability are middleware concerns before they are route concerns.")
    steps = [
        ("01", "Helmet", "secure headers", BLUE), ("02", "CORS", "exact allow-list", BLUE),
        ("03", "Body limit", "100 kB JSON", TEAL), ("04", "Rate limit", "300 / min / IP", TEAL),
        ("05", "Audit", "mutations + latency", AMBER), ("06", "Idempotency", "replay-safe writes", AMBER),
        ("07", "Auth", "JWT access + refresh", PURPLE), ("08", "Validation", "express-validator", PURPLE),
        ("09", "Route", "thin controller", GREEN), ("10", "Service", "risk / workflow / data", GREEN),
    ]
    for i, (n, t, d, col) in enumerate(steps):
        x = 0.55 + (i % 5) * 2.48; y = 1.55 + (i // 5) * 1.72
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 2.18, 1.24, CARD, LINE)
        text(s, x + 0.14, y + 0.1, 0.35, 0.22, n, 8.2, col, True)
        text(s, x + 0.14, y + 0.36, 1.9, 0.26, t, 9.8, NAVY, True)
        text(s, x + 0.14, y + 0.72, 1.9, 0.4, d, 7.4, MUTED)
        if i % 5 < 4:
            arrow(s, x + 2.2, y + 0.53, 0.22, 0.12, LINE)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.72, 6.0, 1.85, CARD, LINE)
    text(s, 0.75, 4.89, 5.5, 0.22, "TWO PATHS THAT LOOK SIMILAR", 7.5, TEAL, True)
    multi(s, 0.75, 5.18, 5.55, 1.28, [
        ("Public citizen report:", "rate-limited separately, no JWT, coordinates validated, category constrained, captcha-free local prototype."),
        ("Machine ingest:", "shared-secret ingest auth for collector writes, not a user token; still validated and idempotent."),
    ], size=8.2, gap=5, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 6.79, 4.72, 5.99, 1.85, CARD, LINE)
    text(s, 6.99, 4.89, 5.5, 0.22, "FAILURE BEHAVIOUR", 7.5, AMBER, True)
    multi(s, 6.99, 5.18, 5.55, 1.28, [
        ("Rate limit:", "429 with Retry-After; authenticated traffic is keyed per user, not just IP."),
        ("Validation:", "400 before any model write; malformed coordinates or enums never reach the engine."),
        ("Idempotency:", "same key and body return the stored response; same key with a different body is rejected."),
    ], size=8.2, gap=4, bullet=True)
    notes(s, "The middleware order is visible in server.js. Helmet, then the exact CORS allow-list, then a 100 kB JSON limit, morgan logging, a global rate limiter, latency and audit middleware, idempotency for writes, auth and role checks, validation, then the route. The audit middleware records mutations, not just page views.")

# 09 — API surface
def api_slide():
    s = new_slide(9, "Operational core", "A small, explicit API surface",
                  "Thin routes, service-layer rules, role checks at the edge.")
    rows = [
        ["Base route", "Representative endpoints", "Purpose", "Access"],
        ["/api/v1/auth", "signup · login · refresh · me · logout", "Session lifecycle, refresh rotation, current identity.", "public / JWT"],
        ["/api/v1/spatial-cells", "summary · list · :h3 · neighbors · recalculate", "Cell state, risk evidence, neighbour context.", "all roles"],
        ["/api/v1/alerts", "list · summary · acknowledge · resolve", "Triage queue and all-clear workflow.", "operator / field"],
        ["/api/v1/incidents", "list · detail · action · lock · approve · dispatch", "Governed incident state machine and cell lock.", "operator / field / admin"],
        ["/api/v1/telemetry", "citizen · ingest · batch · weather · transit · stats", "Public reports, collector ingest, operational counters.", "mixed"],
        ["/api/v1/intelligence", "status · cell/:h3 · multi-resolution · graph · rag · agents", "Node-authenticated proxy to FastAPI.", "internal"],
        ["/api/v1/spatial-analysis", "multi-resolution · neighbor-aware · temporal · nearby", "Cross-cell analytics and autocorrelation.", "all roles"],
        ["/api/v1/admin", "weights · dry-run · users · audit-logs · recalculate-all", "Governance, calibration and system administration.", "administrator"],
        ["/api/v1/system", "sources · status · forecast-accuracy", "Source health, pipeline state, forecast error.", "operator / admin"],
        ["/api/v1/stream", "h3 (SSE)", "Live cell and alert stream for the console.", "JWT"],
        ["/api/v1/qr", "generate · batch-generate · decode", "Public report entry points and location tags.", "operator / public"],
    ]
    table(s, 0.55, 1.52, [2.02, 4.38, 4.48, 1.35], rows, row_h=0.415, size=7.6, head_size=7.2)
    text(s, 0.55, 6.45, 12.2, 0.42,
         "All application routes sit under /api/v1. Health probes are intentionally unauthenticated; machine ingest uses a shared secret, not a user JWT.",
         8.2, MUTED, italic=True)
    notes(s, "The route list is not the product. The point is the split: routes validate and delegate; services own risk, workflow and ingestion logic. Intelligence is proxied through Node so the Python service is never exposed to the browser.")

# 10 — Operational data model
def operational_schema_slide():
    s = new_slide(10, "Data model", "Operational collections: state that moves",
                  "Current local counts in brackets; camel-case and lowercase collection names reflect the running code.")
    rows = [
        ["Collection", "Count", "Core fields", "Why it exists"],
        ["spatialcells", "100", "h3Index · resolution · city · riskScore · riskBand · scores{mobility,climate,vulnerability} · confidence · trend · lastUpdated", "The current operational state of each H3 cell."],
        ["telemetryevents", "260", "sourceType · h3Index · timestamp · rawPayload · normalizedScores · dedupeHash", "Append-only evidence ledger behind every score."],
        ["alerts", "150", "alertType · severity · h3Index · status · firstSeen · lastSeen · resolvedAt", "Triage objects with their own clock and all-clear grace."],
        ["incidents", "13", "status · priority · assignedTo · cellLock · timeline · evidence · resolution", "The human workflow around a confirmed disruption."],
        ["users", "11", "name · email · role · isActive · passwordHash · refreshTokens", "Identity, role and session revocation."],
        ["auditlogs", "1,053", "actor · action · resource · before / after · ip · requestId · createdAt", "Who changed what, when, and from where."],
        ["tokensessions", "106", "userId · tokenHash · expiresAt · revokedAt · userAgent", "Refresh-token rotation and logout revocation."],
        ["celllocks", "runtime", "h3Index · lockedBy · lockedAt · expiresAt", "A 60-second decision lock that stops two operators colliding."],
    ]
    table(s, 0.55, 1.55, [1.72, 0.7, 7.15, 2.66], rows, row_h=0.47, size=7.4, head_size=7.2)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 6.36, 12.23, 0.44, TEAL_S, None)
    text(s, 0.75, 6.47, 11.8, 0.24,
         "Indexes follow the query paths: unique h3Index, recent telemetry by cell and time, alert status, incident status, audit time.",
         8.2, TEAL, True)
    notes(s, "These are the moving parts. spatialcells is the current projection; telemetryevents is the evidence trail; alerts and incidents are separate because they have different clocks and different authority. Audit logs are not decorative: 1,053 rows exist in the local database.")

# 11 — Evidence schema
def evidence_schema_slide():
    s = new_slide(11, "Data model", "Evidence and intelligence: state that explains",
                  "Static geometry, forecast history, memory and knowledge are separate from the live projection.")
    rows = [
        ["Collection", "Count", "What is stored", "Evidence class"],
        ["roadsegments", "5,211", "OSM geometry, road class, length, speed context, terrain join.", "Real static"],
        ["terraincells", "100", "Elevation, slope, relief, water distance, flood susceptibility, vulnerability score.", "Real static + derived"],
        ["forecastsnapshots", "5,124", "Forecast horizon, predicted risk, inputs and issued-at time, for later error review.", "Modelled"],
        ["cell_memories", "100", "Per-cell samples, hourly summaries, neighbour correlations, next-hour and 3-hour projections.", "Modelled"],
        ["knowledge_documents", "23", "13 historical incident summaries + 10 project-authored playbooks; embeddings and metadata.", "Project-authored"],
        ["agent_runs", "5", "Graph state, retrieved evidence, recommendation, dry-run notifications, human decision.", "Advisory / demo"],
    ]
    table(s, 0.55, 1.55, [2.0, 0.9, 6.85, 2.48], rows, row_h=0.54, size=7.9, head_size=7.2)
    card(s, 0.55, 5.45, 3.9, 1.3, "Separate stores, not copies", "One database",
         ["All collections live in the same MongoDB. Separation is by purpose and retention, not by a second infrastructure estate."], accent=TEAL, size=8.0)
    card(s, 4.62, 5.45, 3.9, 1.3, "Knowledge is authored", "Not municipal policy",
         ["Playbooks are project-authored and marked isOfficial:false. They are retrieval context, not an authoritative SOP."], accent=AMBER, size=8.0)
    card(s, 8.69, 5.45, 4.09, 1.3, "Forecast audit", "Prediction is recorded",
         ["Snapshots let the system compare later observations with the forecast that was actually issued at the time."], accent=PURPLE, size=8.0)
    notes(s, "The schema deliberately separates evidence from the live cell projection. Road and terrain data are static inputs. Forecast snapshots and memory are modelled. Knowledge documents are project-authored, and the playbooks are explicitly not official. None of these should be mistaken for a municipal record.")

# 12 — Auth
def auth_slide():
    s = new_slide(12, "Trust boundary", "Authentication, roles and the write gate",
                  "JWT access tokens, rotating refresh sessions, role checks and an audit trail.")
    rows = [
        ["Role", "Works with", "Can do", "Cannot do"],
        ["Operator", "Live map, alerts, incidents, field status", "Acknowledge, approve, override, dispatch, resolve within policy.", "Change scoring weights, manage users, read raw audit."],
        ["Field crew", "Assigned tasks, field detail, offline outbox", "Accept, arrive, upload evidence, resolve assigned work.", "Approve incidents, dispatch others, see city-wide admin."],
        ["Administrator", "Weights, users, sources, audit, system health", "Calibrate, dry-run weights, recalculate, activate users, inspect audit.", "Bypass the incident state machine or erase the audit trail."],
        ["Citizen", "Public QR report page", "Submit a rate-limited report with coordinates and category.", "Read any operational data or internal endpoint."],
    ]
    table(s, 0.55, 1.55, [1.35, 3.12, 4.55, 3.21], rows, row_h=0.68, size=8.1)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 5.12, 7.65, 1.68, CARD, LINE)
    text(s, 0.75, 5.28, 7.0, 0.22, "SESSION MODEL", 7.5, TEAL, True)
    flow = [("Login", "bcrypt check"), ("Access", "short-lived JWT"), ("Refresh", "rotated hash"), ("Logout", "revoke session")]
    for i, (t, d) in enumerate(flow):
        x = 0.78 + i * 1.83
        shape(s, MSO_SHAPE.RECTANGLE, x, 5.57, 1.55, 0.94, TEAL_S, None)
        text(s, x + 0.1, 5.68, 1.35, 0.2, t, 8.6, NAVY, True)
        text(s, x + 0.1, 5.96, 1.35, 0.38, d, 7.0, MUTED)
    card(s, 8.43, 5.12, 4.35, 1.68, "Hard boundaries", "Defence in depth",
         ["Helmet and strict CORS. Auth before validation. Role checks on every protected route. Idempotency for writes. Audit on mutations. Refresh tokens stored hashed and revocable."], accent=PURPLE, size=7.9)
    notes(s, "Authentication is not a single middleware. Access tokens are short-lived; refresh tokens are stored hashed and rotated; logout revokes the session. Role checks are applied per route. The public citizen endpoint is intentionally separate and rate-limited. Audit logging captures mutations so a role claim can be checked against what actually happened.")

# 13 — Ingestion
def ingestion_slide():
    s = new_slide(13, "Signal pipeline", "From provider reading to cell evidence",
                  "Collect, normalise, de-duplicate, spatially join, score, then record provenance.")
    steps = [
        ("01", "POLL", "Weather every 60 s; TomTom flow and incidents within a monthly budget; GTFS only if configured.", BLUE),
        ("02", "NORMALISE", "Map provider payloads into a common event shape with sourceType, timestamp and quality flags.", TEAL),
        ("03", "DEDUPE", "Hash source, cell, timestamp and payload; replay-safe writes and idempotency keys.", TEAL),
        ("04", "SPATIAL JOIN", "Assign an H3 res-8 cell; interpolate weather from the five nearest readings by inverse distance.", AMBER),
        ("05", "SCORE", "Run deterministic mobility, climate and vulnerability formulas; compute completeness and confidence.", PURPLE),
        ("06", "PERSIST", "Append telemetry, update the cell projection, record forecast snapshots and audit metadata.", GREEN),
    ]
    for i, (n, t, d, col) in enumerate(steps):
        x = 0.55 + i * 2.06
        shape(s, MSO_SHAPE.RECTANGLE, x, 1.55, 1.86, 2.15, CARD, LINE)
        text(s, x + 0.14, 1.68, 0.4, 0.22, n, 8.0, col, True)
        text(s, x + 0.14, 1.96, 1.6, 0.24, t, 9.2, NAVY, True)
        text(s, x + 0.14, 2.28, 1.6, 1.28, d, 7.4, MUTED, spacing=0.95)
        if i < 5:
            arrow(s, x + 1.89, 2.52, 0.14, 0.1, LINE)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 3.95, 6.05, 2.62, CARD, LINE)
    text(s, 0.75, 4.1, 5.0, 0.22, "WEATHER: PROVIDER FALLBACK CHAIN", 7.5, TEAL, True)
    chain = ["OpenWeatherMap", "WeatherAPI", "wttr.in", "Open-Meteo", "synthetic fallback"]
    for i, t in enumerate(chain):
        y = 4.42 + i * 0.39
        pill(s, 0.78, y, 1.72, 0.27, f"0{i+1}", TEAL_S, TEAL, 7)
        text(s, 2.62, y + 0.04, 3.65, 0.22, t, 8.2, NAVY, bool(i == 4))
        if i < 4:
            text(s, 2.22, y + 0.27, 0.3, 0.13, "↓", 7, FAINT)
    text(s, 0.78, 6.48, 5.6, 0.2, "Synthetic is labelled, never passed off as an observation.", 7.2, AMBER, True)
    shape(s, MSO_SHAPE.RECTANGLE, 6.78, 3.95, 6.0, 2.62, CARD, LINE)
    text(s, 6.98, 4.1, 5.4, 0.22, "BUDGETS AND GUARDRAILS", 7.5, AMBER, True)
    multi(s, 6.98, 4.42, 5.55, 1.95, [
        ("Traffic:", "TomTom flow and incident calls share a monthly request budget; budget state is exposed through system status."),
        ("Transit:", "GTFS-RT poller runs only when GTFS_RT_URL is set; today it is unset, so the adapter is dormant."),
        ("Missing data:", "omitted from the score, recorded as missing, and reflected in confidence. No zero-fill."),
        ("Static layers:", "OSM and terrain are loaded once, not polled as if they were live."),
    ], size=7.9, gap=5, bullet=True)
    notes(s, "The pipeline is evidence-first. A provider payload is normalised, de-duplicated, joined to H3, scored and stored with its source type. Weather has a five-provider fallback chain ending in an explicitly synthetic fallback. Traffic is budgeted. GTFS is dormant because no URL is configured. Missing data is never zero-filled.")

# 14 — H3
def h3_slide():
    s = new_slide(14, "Spatial theory", "H3: a grid that behaves like a city",
                  "Hexagons reduce edge bias and give every observation one stable join key.")
    shape(s, MSO_SHAPE.HEXAGON, 0.72, 1.55, 2.2, 1.95, TEAL_S, TEAL, 1.2)
    shape(s, MSO_SHAPE.HEXAGON, 1.42, 1.86, 1.05, 0.95, TEAL, None)
    text(s, 0.88, 3.66, 2.0, 0.3, "one cell, many signals", 8.2, TEAL, True, align=PP_ALIGN.CENTER)
    rows = [
        ["Resolution", "Avg edge", "Avg area", "Use in this build"],
        ["4", "3.23 km", "288 km²", "City rollup; 4 parent cells."],
        ["6", "1.22 km", "36.1 km²", "Neighbourhood rollup; 16 parents."],
        ["8", "0.461 km", "0.737 km²", "Street-level operational cell; 100 stored."],
    ]
    table(s, 3.38, 1.55, [1.05, 1.15, 1.2, 3.25], rows, row_h=0.62, size=8.0)
    shape(s, MSO_SHAPE.RECTANGLE, 3.38, 4.02, 6.65, 2.45, CARD, LINE)
    text(s, 3.58, 4.18, 6.1, 0.22, "WHY HEXAGONS", 7.5, TEAL, True)
    multi(s, 3.58, 4.48, 6.15, 1.82, [
        ("Equal neighbours:", "six equidistant neighbours, unlike a square grid's four edge and four corner neighbours."),
        ("Stable hierarchy:", "each res-8 cell rolls into exactly one res-6 and res-4 parent."),
        ("Shared join key:", "telemetry, risk, alerts, incidents, memory, RAG and graph all use h3Index."),
        ("Boundary honesty:", "cell edges are analysis units, not walls; neighbour and parent context are explicit."),
    ], size=8.0, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 10.2, 1.55, 2.58, 4.92, NAVY, None)
    text(s, 10.4, 1.73, 2.2, 0.22, "H3 OPERATIONS USED", 7.2, "70D6C8", True)
    ops = ["latLngToCell", "cellToBoundary", "gridDisk", "cellToParent", "cellToChildren", "greatCircleDistance"]
    for i, op in enumerate(ops):
        y = 2.12 + i * 0.54
        text(s, 10.42, y, 2.1, 0.22, op, 8.3, "FFFFFF", True)
        text(s, 10.42, y + 0.21, 2.1, 0.18, "h3-js", 6.8, "8FA6B8")
    text(s, 10.4, 5.63, 2.15, 0.55, "No custom tiling layer. H3 is the spatial contract.", 7.6, "A9E7DD", True)
    notes(s, "Resolution 8 is the operational cell, roughly 0.46 km edge length and 0.74 square kilometres. Resolution 6 and 4 are parent rollups. The platform uses h3-js for conversion, boundaries, neighbours, parents and children. The grid is an analysis contract, not a claim that a city is physically hexagonal.")

# 15 — Lifecycle
def lifecycle_slide():
    s = new_slide(15, "Risk engine", "The life of a cell score",
                  "Every cycle rebuilds the score from the last 60 minutes of evidence, then reconciles alerts.")
    stages = [
        ("01", "WINDOW", "Select telemetry in the last 60 minutes for the cell; older evidence decays but is not silently promoted."),
        ("02", "WEIGHT", "Apply exp(-ln2 × age / 30 min) so a reading loses half its influence every half hour."),
        ("03", "SUBSCORES", "Compute mobility, climate and vulnerability; track each component's completeness."),
        ("04", "COMPOSITE", "R = 0.4·mobility + 0.4·climate + 0.2·vulnerability; apply neighbour cascade when active."),
        ("05", "CONFIDENCE", "Start at 1.0; subtract 0.35 for missing mobility or climate, 0.20 for vulnerability, 0.10 for sparse data."),
        ("06", "BAND + TREND", "Map to LOW / MODERATE / HIGH / CRITICAL and compare with the previous score for direction."),
        ("07", "FORECAST", "Project next-hour and 3-hour risk from slope; attach hourly weather forecast where available."),
        ("08", "PUBLISH", "Upsert the cell, record a forecast snapshot, emit SSE / Socket.IO, then reconcile alerts."),
    ]
    for i, (n, t, d) in enumerate(stages):
        x = 0.55 + (i % 4) * 3.1; y = 1.52 + (i // 4) * 2.2
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 2.92, 1.98, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 2.92, 0.045, TEAL if i < 4 else PURPLE)
        text(s, x + 0.16, y + 0.16, 0.42, 0.24, n, 8.2, TEAL if i < 4 else PURPLE, True)
        text(s, x + 0.16, y + 0.45, 2.55, 0.24, t, 10.0, NAVY, True)
        text(s, x + 0.16, y + 0.79, 2.58, 1.05, d, 7.5, MUTED, spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 6.08, 12.23, 0.66, TEAL_S, None)
    text(s, 0.78, 6.22, 11.8, 0.32,
         "A cell is a projection, not a record. The evidence stays append-only; the projection is rebuilt and can be recalculated by an administrator.",
         9.4, TEAL, True)
    notes(s, "The lifecycle is deterministic. It reads a 60-minute window, applies exponential time decay with a 30-minute half-life, computes three subscores, combines them, adjusts confidence, assigns a band and trend, projects forward, records a snapshot and publishes. Alerts are reconciled after the cell score, not before.")

# 16 — Composite
def composite_slide():
    s = new_slide(16, "Risk theory", "Composite risk is a weighted index",
                  "A transparent arithmetic score with explicit weights, bands and confidence penalties.")
    formula(s, 0.55, 1.55, 7.15, 1.18, "R = 0.4·M + 0.4·C + 0.2·V",
            "M mobility  ·  C climate  ·  V vulnerability  ·  each subscore normalised to 0–10")
    rows = [
        ["Band", "Score", "Operational meaning"],
        [("CRITICAL", RED), "≥ 7.0", "Immediate human review; strongest alerting and escalation."],
        [("HIGH", "C2410C"), "5.0–6.99", "Priority inspection; likely incident candidate."],
        [("MODERATE", AMBER), "3.0–4.99", "Watch, verify, and prepare a response."],
        [("LOW", GREEN), "< 3.0", "Routine monitoring; not evidence of safety."],
    ]
    table(s, 8.0, 1.55, [1.3, 1.2, 3.28], rows, row_h=0.52, size=7.8)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 3.02, 3.85, 1.68, CARD, LINE)
    text(s, 0.75, 3.18, 3.4, 0.22, "CONFIDENCE IS SEPARATE", 7.5, AMBER, True)
    multi(s, 0.75, 3.48, 3.45, 1.08, [
        "Starts at 1.0 and is reduced by missing evidence.",
        "-0.35 mobility  ·  -0.35 climate",
        "-0.20 vulnerability  ·  -0.10 sparse data",
    ], size=7.6, gap=2, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 4.62, 3.02, 3.08, 1.68, CARD, LINE)
    text(s, 4.82, 3.18, 2.7, 0.22, "CASCADE", 7.5, PURPLE, True)
    text(s, 4.82, 3.48, 2.65, 0.95, "A critical neighbour can lift a cell's score through an explicit cascade adjustment. The neighbour relationship is recorded, not hidden in a black box.", 7.6, MUTED, spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 7.9, 3.02, 4.88, 1.68, NAVY, None)
    text(s, 8.1, 3.18, 4.4, 0.22, "ILLUSTRATIVE ARITHMETIC", 7.3, "70D6C8", True)
    text(s, 8.1, 3.47, 4.4, 0.62, "M 4.2  ·  C 2.8  ·  V 3.0", 12, "FFFFFF", True)
    text(s, 8.1, 4.03, 4.3, 0.42, "R = 1.68 + 1.12 + 0.60 = 3.40  →  MODERATE", 9.2, "A9E7DD", True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.94, 12.23, 1.57, CARD, LINE)
    text(s, 0.75, 5.1, 11.6, 0.22, "WHAT THE SCORE DOES—AND DOES NOT—MEAN", 7.5, TEAL, True)
    multi(s, 0.75, 5.4, 11.7, 0.98, [
        ("It does:", "rank cells for human attention, expose the evidence behind the rank, and trigger a separate alert workflow."),
        ("It does not:", "predict a flood, certify safety, or replace a municipal emergency decision. A low score is not a guarantee."),
    ], size=8.4, gap=5, bullet=True)
    text(s, 0.55, 6.62, 12.2, 0.25, "Snapshot: mean cell risk 0.3052, peak 2.31, zero critical cells. Those are stored values, not a city-wide safety claim.", 7.7, FAINT, italic=True)
    notes(s, "The composite is deliberately simple arithmetic: 0.4 mobility, 0.4 climate, 0.2 vulnerability. Bands are fixed thresholds. Confidence is a separate axis, reduced by missing inputs, so a high score built on thin evidence is visibly different from a high score built on complete evidence. The worked example is illustrative, not a database row.")

# 17 — Mobility
def mobility_slide():
    s = new_slide(17, "Risk theory  /  mobility", "Mobility: delay, speed and citizen signal",
                  "Traffic is the dominant live input; the formula separates chronic delay from a sharp peak.")
    formula(s, 0.55, 1.55, 7.2, 1.05, "M = 0.6·delay + 0.3·speed + 0.1·citizenMobility",
            "Each component normalised to 0–10; missing traffic does not become a zero.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 2.83, 7.2, 1.7, CARD, LINE)
    text(s, 0.75, 2.99, 6.7, 0.22, "DELAY SCORE", 7.5, BLUE, True)
    text(s, 0.75, 3.28, 6.75, 0.34, "0.70 × weighted average delay + 0.30 × peak delay", 11.5, NAVY, True)
    text(s, 0.75, 3.73, 6.75, 0.6, "A 15-minute delay maps to 10. The weighted average is normalised by the number of observed segments, so one bad road does not dominate the cell.", 8.1, MUTED, spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.7, 3.46, 1.8, CARD, LINE)
    text(s, 0.73, 4.86, 3.0, 0.22, "SPEED SCORE", 7.5, TEAL, True)
    text(s, 0.73, 5.15, 3.0, 0.42, "Observed speed relative to expected road speed.", 8.5, INK, spacing=0.95)
    text(s, 0.73, 5.65, 3.0, 0.55, "Road class and free-flow context matter; a slow motorway is not the same as a slow residential street.", 7.4, MUTED, spacing=0.94)
    shape(s, MSO_SHAPE.RECTANGLE, 4.19, 4.7, 3.56, 1.8, CARD, LINE)
    text(s, 4.37, 4.86, 3.0, 0.22, "CITIZEN MOBILITY", 7.5, PURPLE, True)
    text(s, 4.37, 5.15, 3.1, 0.42, "A small weight for reported obstruction or slow movement.", 8.5, INK, spacing=0.95)
    text(s, 4.37, 5.65, 3.1, 0.55, "It adds local context; it cannot outvote measured road flow because its weight is only 0.1.", 7.4, MUTED, spacing=0.94)
    metric(s, 7.98, 2.83, 2.25, 1.7, "36", "flow readings", "TomTom flow events stored", BLUE)
    metric(s, 10.42, 2.83, 2.36, 1.7, "14", "incident readings", "TomTom incident events", AMBER)
    shape(s, MSO_SHAPE.RECTANGLE, 7.98, 4.7, 4.8, 1.8, AMBER_S, None)
    text(s, 8.18, 4.86, 4.3, 0.22, "MISSING TRAFFIC", 7.5, AMBER, True)
    text(s, 8.18, 5.14, 4.4, 0.95, "Mobility is marked unavailable, not set to zero. The cell loses 0.35 confidence, and the score must be read as a partial view rather than a quiet street.", 8.4, INK, spacing=0.96)
    text(s, 7.98, 6.58, 4.7, 0.2, "In this build: 46 flow + 14 incident readings, not continuous city coverage.", 7.0, FAINT, italic=True)
    notes(s, "Mobility is 60 percent delay, 30 percent speed and 10 percent citizen mobility. The delay score blends a 70 percent weighted average with a 30 percent peak, with a 15-minute delay normalized to 10. The important discipline is missing-data handling: no traffic means no mobility score, lower confidence, not a zero that reads as safe.")

# 18 — Climate
def climate_slide():
    s = new_slide(18, "Risk theory  /  climate", "Climate: rain, visibility and wind",
                  "Weather is measured at provider points, interpolated to cells, then converted into a hazard score.")
    formula(s, 0.55, 1.55, 7.25, 1.05, "C = 0.70·rain + 0.15·visibility + 0.15·wind",
            "Rain dominates; visibility and wind add hazard when conditions deteriorate.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 2.82, 3.85, 1.65, CARD, LINE)
    text(s, 0.73, 2.98, 3.4, 0.22, "RAIN", 7.5, BLUE, True)
    text(s, 0.73, 3.28, 3.35, 0.42, "10 · min(1, rain / 50)^0.85", 12, NAVY, True)
    text(s, 0.73, 3.76, 3.35, 0.55, "50 mm is the saturation point. The exponent compresses the top end rather than letting extreme rain dominate without bound.", 7.4, MUTED, spacing=0.94)
    shape(s, MSO_SHAPE.RECTANGLE, 4.58, 2.82, 3.85, 1.65, CARD, LINE)
    text(s, 4.76, 2.98, 3.4, 0.22, "VISIBILITY + WIND", 7.5, TEAL, True)
    text(s, 4.76, 3.28, 3.35, 0.38, "Hazard below 5 km; wind above 8 m/s.", 10.2, NAVY, True, spacing=0.95)
    text(s, 4.76, 3.78, 3.35, 0.55, "These are guardrails for conditions that matter operationally even when rainfall is modest.", 7.4, MUTED, spacing=0.94)
    shape(s, MSO_SHAPE.RECTANGLE, 8.62, 2.82, 4.16, 1.65, CARD, LINE)
    text(s, 8.8, 2.98, 3.7, 0.22, "SPATIAL INTERPOLATION", 7.5, AMBER, True)
    text(s, 8.8, 3.27, 3.75, 0.4, "Five nearest weather readings, inverse-distance weighted.", 9.2, NAVY, True, spacing=0.95)
    text(s, 8.8, 3.76, 3.75, 0.55, "The result is a modelled cell value, not a measurement taken at the cell centroid.", 7.4, MUTED, spacing=0.94)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.72, 7.55, 1.78, CARD, LINE)
    text(s, 0.75, 4.88, 7.0, 0.22, "A WEATHER READING IS NOT A FLOOD MAP", 7.5, AMBER, True)
    multi(s, 0.75, 5.18, 7.1, 1.12, [
        ("Measured:", "provider rainfall, visibility and wind at sample points."),
        ("Modelled:", "cell-level climate hazard after interpolation and weighting."),
        ("Not available:", "street-level flood depth, drainage capacity, or a validated inundation forecast."),
    ], size=8.1, gap=4, bullet=True)
    metric(s, 8.4, 4.72, 2.05, 1.78, "100", "weather events", "across three cities", TEAL)
    metric(s, 10.65, 4.72, 2.13, 1.78, "5", "providers", "fallback chain", BLUE)
    text(s, 0.55, 6.62, 12.2, 0.2, "Climate is a screening signal. It tells an operator where to look; it does not certify a road as flooded or safe.", 7.3, FAINT, italic=True)
    notes(s, "Climate is 70 percent rain, 15 percent visibility and 15 percent wind. Rain uses a saturating curve at 50 mm with an exponent of 0.85. Weather is interpolated from the five nearest provider readings by inverse distance. That makes the cell value modelled, not measured. A high climate score is a reason to inspect, not a flood depth measurement.")

# 19 — Vulnerability
def vulnerability_slide():
    s = new_slide(19, "Risk theory  /  vulnerability", "Vulnerability: terrain plus distress",
                  "Static exposure sets the baseline; citizen reports can raise it but cannot erase it.")
    formula(s, 0.55, 1.55, 7.2, 1.02, "V = 0.75·baseline + 0.25·citizenDistress",
            "If no baseline exists, citizen distress is used directly; it is not silently discarded.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 2.78, 4.55, 2.7, CARD, LINE)
    text(s, 0.75, 2.94, 4.0, 0.22, "BASELINE EXPOSURE", 7.5, AMBER, True)
    fields = [("floodSusceptibility", "terrain-derived flood exposure"), ("waterDistanceM", "distance to mapped water"),
              ("slopeDeg / reliefM", "terrain roughness"), ("road exposure", "road segments in the cell")]
    for i, (t, d) in enumerate(fields):
        y = 3.28 + i * 0.51
        text(s, 0.75, y, 1.55, 0.2, t, 7.8, NAVY, True)
        text(s, 2.35, y, 2.55, 0.2, d, 7.5, MUTED)
    shape(s, MSO_SHAPE.RECTANGLE, 5.35, 2.78, 3.2, 2.7, CARD, LINE)
    text(s, 5.55, 2.94, 2.8, 0.22, "CITIZEN DISTRESS", 7.5, PURPLE, True)
    text(s, 5.55, 3.27, 2.8, 0.44, "Count × 2.0, capped at 10.", 11.0, NAVY, True, spacing=0.95)
    text(s, 5.55, 3.82, 2.78, 1.4, "Repeated reports in one cell raise the score. The cap prevents a single burst of duplicate submissions from taking over the composite.", 8.0, MUTED, spacing=0.96)
    shape(s, MSO_SHAPE.RECTANGLE, 8.8, 2.78, 3.98, 2.7, NAVY, None)
    text(s, 9.0, 2.94, 3.5, 0.22, "WHY 75 / 25", 7.4, "70D6C8", True)
    text(s, 9.0, 3.27, 3.5, 0.62, "The ground truth of place outranks a noisy signal.", 14, "FFFFFF", True, spacing=0.95)
    text(s, 9.0, 4.0, 3.5, 1.25, "Terrain does not refresh every minute. Citizen reports do. The weights keep the slow, structural exposure dominant while still allowing a real local event to move the cell.", 8.1, "D6E2EC", spacing=0.98)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 5.75, 12.23, 0.78, AMBER_S, None)
    text(s, 0.78, 5.9, 11.8, 0.48,
         "Current data: 100 terrain cells and 5,211 road segments. Vulnerability is a static-derived baseline plus reports—not a live structural survey.",
         9.0, AMBER, True, spacing=0.95)
    notes(s, "Vulnerability is 75 percent terrain baseline and 25 percent citizen distress. The baseline uses terrain fields such as flood susceptibility, water distance, slope and relief, plus road exposure. Citizen distress is count times two, capped at ten. Repeated reports move the score, but structural exposure remains dominant. This is not a building-level vulnerability survey.")

# 20 — Time and forecast
def temporal_slide():
    s = new_slide(20, "Risk theory  /  time", "Time decay and honest forecasts",
                  "Recent evidence matters more; projections are slope extrapolations, not a trained ML model.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 6.2, 2.35, CARD, LINE)
    text(s, 0.75, 1.7, 5.7, 0.22, "EXPONENTIAL DECAY", 7.5, TEAL, True)
    text(s, 0.75, 2.0, 5.7, 0.36, "w(age) = exp(−ln2 × age / 30 min)", 13.5, NAVY, True)
    text(s, 0.75, 2.42, 5.65, 0.28,
         "Half-life 30 min; window 60 min. A 30-minute-old reading counts half as much.", 7.7, MUTED, spacing=0.95)
    for i, (a, w) in enumerate([("0 min", 1.0), ("15 min", 0.71), ("30 min", 0.5), ("45 min", 0.35), ("60 min", 0.25)]):
        x = 0.9 + i * 1.12
        h = 0.70 * w
        shape(s, MSO_SHAPE.RECTANGLE, x, 3.34 - h, 0.72, h, TEAL if i < 3 else "7FB8B1", None)
        text(s, x, 3.36, 0.72, 0.18, a, 6.8, MUTED, align=PP_ALIGN.CENTER)
        text(s, x, 3.53, 0.72, 0.18, f"{w:.2f}", 7.0, TEAL, True, align=PP_ALIGN.CENTER)
    text(s, 0.75, 3.72, 5.7, 0.2, "Weight applied to evidence at age t", 6.8, FAINT, italic=True)
    shape(s, MSO_SHAPE.RECTANGLE, 7.0, 1.55, 5.78, 2.35, CARD, LINE)
    text(s, 7.2, 1.7, 5.2, 0.22, "TREND, NOT A PROMISE", 7.5, PURPLE, True)
    rows = [("Surging", "> +1.5"), ("Rising", "> +0.3"), ("Stable", "−0.3 to +0.3"), ("De-escalating", "< −0.3")]
    for i, (lab, val) in enumerate(rows):
        y = 2.03 + i * 0.42
        text(s, 7.2, y, 1.8, 0.2, lab, 8.2, NAVY, True)
        text(s, 9.0, y, 1.4, 0.2, val, 8.2, MUTED)
    text(s, 10.5, 2.03, 2.0, 1.55, "Trend is a direction of change in the composite, used to prioritise review.", 7.6, MUTED, spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.18, 6.2, 2.35, NAVY, None)
    text(s, 0.75, 4.34, 5.7, 0.22, "FORECAST METHOD", 7.3, "70D6C8", True)
    text(s, 0.75, 4.64, 5.7, 0.42, "next hour = current + slope × 0.6", 11.0, "FFFFFF", True)
    text(s, 0.75, 5.05, 5.7, 0.42, "next 3 hours = current + slope × 1.8", 11.0, "FFFFFF", True)
    text(s, 0.75, 5.53, 5.65, 0.82, "Weather forecast is attached when available. Flood screening is a separate heuristic. The model is explicitly not trained ML and has no learned parameters.", 8.0, "B9CAD9", spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 7.0, 4.18, 5.78, 2.35, CARD, LINE)
    text(s, 7.2, 4.34, 5.2, 0.22, "FORECAST AUDIT", 7.5, TEAL, True)
    text(s, 7.2, 4.64, 5.3, 0.6, "5,124 forecast snapshots are stored.", 13.5, NAVY, True)
    text(s, 7.2, 5.22, 5.3, 1.08, "Each snapshot records what was issued, so future observations can be compared with the actual forecast rather than a reconstructed one. No accuracy claim is made in this deck without that comparison.", 8.2, MUTED, spacing=0.97)
    notes(s, "Time decay is a 30-minute half-life over a 60-minute window. Trend thresholds are plus or minus 1.5 for surging, 0.3 for rising and de-escalating. Forecasts are simple slope extrapolations: current plus slope times 0.6 for the next hour and times 1.8 for three hours. They are explicitly not trained ML. Forecast snapshots exist so that accuracy can be audited later.")

# 21 — Alerts
def alerts_slide():
    s = new_slide(21, "Workflow", "Alerts are not the risk score",
                  "A cell score ranks; an alert opens a time-bound obligation to respond.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 5.45, 2.48, CARD, LINE)
    text(s, 0.75, 1.7, 4.9, 0.22, "TRIGGER FAMILIES", 7.5, BLUE, True)
    triggers = [("Traffic incident", "provider incident or severe congestion"),
                ("Congestion", "sustained delay above the cell threshold"),
                ("Weather hazard", "rain, visibility or wind condition"),
                ("Citizen report", "categorised public submission")]
    for i, (t, d) in enumerate(triggers):
        y = 2.03 + i * 0.46
        text(s, 0.75, y, 1.72, 0.2, t, 8.0, NAVY, True)
        text(s, 2.5, y, 3.25, 0.2, d, 7.4, MUTED)
    shape(s, MSO_SHAPE.RECTANGLE, 6.25, 1.55, 3.0, 2.48, CARD, LINE)
    text(s, 6.45, 1.7, 2.5, 0.22, "STATUS", 7.5, TEAL, True)
    for i, (st, col) in enumerate([("OPEN", RED), ("ACKNOWLEDGED", AMBER), ("RESOLVED", GREEN), ("EXPIRED", FAINT)]):
        y = 2.03 + i * 0.45
        pill(s, 6.45, y, 1.32, 0.28, st, "FFFFFF", col, 7)
        shape(s, MSO_SHAPE.RECTANGLE, 6.45, y, 1.32, 0.28, None, col, 0.7)
        text(s, 7.9, y + 0.04, 1.15, 0.18, ["needs action", "owned", "closed", "timed out"][i], 7.1, MUTED)
    shape(s, MSO_SHAPE.RECTANGLE, 9.55, 1.55, 3.23, 2.48, NAVY, None)
    text(s, 9.75, 1.7, 2.8, 0.22, "CURRENT QUEUE", 7.3, "70D6C8", True)
    text(s, 9.75, 2.0, 2.8, 0.52, "150", 30, "FFFFFF", True)
    text(s, 9.75, 2.56, 2.8, 0.22, "alerts stored", 8.2, "B9CAD9")
    text(s, 9.75, 2.92, 2.8, 0.28, "28 open  ·  96 resolved", 8.0, "A9E7DD", True)
    text(s, 9.75, 3.22, 2.8, 0.28, "26 expired", 8.0, "D6E2EC")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.27, 12.23, 2.05, CARD, LINE)
    text(s, 0.75, 4.43, 11.5, 0.22, "CLOCK RULES", 7.5, AMBER, True)
    stages = [("Detect", "score / provider condition"), ("Open", "status OPEN, firstSeen set"),
              ("Acknowledge", "ownership and operator identity"), ("All-clear", "15-minute grace before resolve"),
              ("Expire", "30 minutes without resolution")]
    for i, (t, d) in enumerate(stages):
        x = 0.8 + i * 2.4
        shape(s, MSO_SHAPE.RECTANGLE, x, 4.76, 2.05, 0.96, TEAL_S if i < 4 else AMBER_S, None)
        text(s, x + 0.12, 4.86, 1.8, 0.2, t, 8.5, NAVY, True)
        text(s, x + 0.12, 5.13, 1.8, 0.45, d, 7.0, MUTED, spacing=0.93)
        if i < 4:
            text(s, x + 2.06, 5.12, 0.28, 0.2, "→", 9, FAINT, True)
    text(s, 0.75, 5.9, 11.8, 0.28,
         "A resolved alert still preserves its telemetry, operator, timestamps and resolution note. Expiry is a timeout, not a deletion.",
         8.2, MUTED, italic=True)
    notes(s, "Alerts are separate operational objects. They are triggered by incident, congestion, weather or citizen-report conditions; they are not simply composite risk above a threshold. Statuses are OPEN, ACKNOWLEDGED, RESOLVED and EXPIRED. Resolution has a 15-minute all-clear grace, and an unresolved alert expires after 30 minutes. Current queue: 150 total, 28 open, 96 resolved, 26 expired.")

# 22 — Incidents
def incidents_slide():
    s = new_slide(22, "Workflow", "Incident lifecycle: a human decision record",
                  "Dispatched work has a state machine, a 60-second cell lock and an evidence trail.")
    states = [("DETECTED", "alert / report"), ("APPROVED", "operator validates"), ("OVERRIDDEN", "operator changes priority"),
              ("DISPATCHED", "crew assigned"), ("ACKNOWLEDGED", "crew accepts"), ("ARRIVED", "on scene"),
              ("RESOLVED", "work complete"), ("ESCALATED", "higher authority")]
    for i, (st, d) in enumerate(states):
        x = 0.55 + (i % 4) * 3.12; y = 1.55 + (i // 4) * 1.22
        col = RED if st in ("DETECTED", "ESCALATED") else (AMBER if st in ("APPROVED", "OVERRIDDEN", "DISPATCHED") else (GREEN if st == "RESOLVED" else BLUE))
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 2.92, 0.92, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 0.05, 0.92, col)
        text(s, x + 0.16, y + 0.14, 2.55, 0.22, st, 8.6, col, True)
        text(s, x + 0.16, y + 0.44, 2.55, 0.3, d, 7.8, MUTED)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 4.1, 6.05, 2.4, CARD, LINE)
    text(s, 0.75, 4.25, 5.5, 0.22, "THE CELL LOCK", 7.5, TEAL, True)
    text(s, 0.75, 4.56, 5.55, 0.4, "One decision at a time. 60 seconds.", 12.0, NAVY, True)
    multi(s, 0.75, 5.04, 5.55, 1.22, [
        "A lock is taken before approve, override or dispatch.",
        "It expires automatically, so a disconnected operator cannot freeze a cell.",
        "Lock ownership and expiry are explicit; collisions return a visible conflict.",
    ], size=8.1, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 6.78, 4.1, 6.0, 2.4, NAVY, None)
    text(s, 6.98, 4.25, 5.4, 0.22, "WHAT THE RECORD PRESERVES", 7.3, "70D6C8", True)
    multi(s, 6.98, 4.56, 5.45, 1.7, [
        ("Timeline:", "each transition with actor, time and note."),
        ("Evidence:", "linked telemetry, citizen reports and field uploads."),
        ("Decision:", "approval, override reason, crew assignment and resolution."),
        ("Snapshot:", "13 incidents: 5 approved, 4 escalated, 2 resolved, 2 detected."),
    ], size=8.0, gap=4, bullet=True, color="FFFFFF", lead="A9E7DD")
    notes(s, "Incidents are the human workflow, not the risk score. The state machine includes detected, approved, overridden, dispatched, acknowledged, arrived, resolved and escalated. A 60-second cell lock prevents two operators from making conflicting decisions. The record preserves the timeline, evidence and decision rationale. Current local data: 13 incidents.")

# 23 — Field and citizen
def field_slide():
    s = new_slide(23, "Last mile", "Field crews and citizens close the loop",
                  "The browser is not the only edge; offline work and public reporting are first-class paths.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 6.05, 4.95, CARD, LINE)
    text(s, 0.75, 1.7, 5.5, 0.22, "FIELD CREW", 7.5, BLUE, True)
    text(s, 0.75, 2.0, 5.55, 0.32, "Assigned work that survives a dead zone.", 12.0, NAVY, True)
    multi(s, 0.75, 2.46, 5.55, 2.2, [
        ("Task list:", "assigned incidents, priority, location, evidence requirements."),
        ("Offline outbox:", "status updates and reports queue locally when connectivity fails."),
        ("Sync:", "batched replay with client-generated IDs; the server can reject or reconcile duplicates."),
        ("Evidence:", "GPS, arrival and resolution notes, photo upload where configured."),
        ("Boundary:", "the crew can resolve assigned work; it cannot approve or dispatch itself."),
    ], size=8.0, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.75, 4.95, 5.55, 1.35, BLUE_S, None)
    text(s, 0.92, 5.1, 5.2, 0.22, "OFFLINE IS A STATE, NOT AN ERROR", 7.3, BLUE, True)
    text(s, 0.92, 5.4, 5.2, 0.75, "The UI shows queued, syncing, failed and synced states. A failed sync remains visible; it is not silently dropped.", 8.1, INK, spacing=0.96)
    shape(s, MSO_SHAPE.RECTANGLE, 6.78, 1.55, 6.0, 4.95, CARD, LINE)
    text(s, 6.98, 1.7, 5.4, 0.22, "PUBLIC CITIZEN REPORT", 7.5, PURPLE, True)
    text(s, 6.98, 2.0, 5.45, 0.32, "A QR code, a location, a category.", 12.0, NAVY, True)
    multi(s, 6.98, 2.46, 5.45, 2.2, [
        ("Entry:", "QR code or public report page; no account required."),
        ("Limits:", "60 reports per 5 minutes per IP; coordinate and category validation."),
        ("Payload:", "category, description, optional photo, geolocation."),
        ("Treatment:", "a citizen report is a signal, not a confirmed incident."),
        ("Abuse:", "rate limits and validation reduce noise; the local prototype does not claim a full moderation stack."),
    ], size=8.0, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 6.98, 4.95, 5.6, 1.35, PURPLE_S, None)
    text(s, 7.15, 5.1, 5.2, 0.22, "CITIZEN DATA IS LABELLED", 7.3, PURPLE, True)
    text(s, 7.15, 5.4, 5.2, 0.75, "Reports are marked as citizen-sourced and kept distinct from provider telemetry. They raise distress but cannot masquerade as a measured road or weather reading.", 8.0, INK, spacing=0.95)
    notes(s, "The field experience assumes unreliable connectivity: an outbox stores updates and replays them in batches. The public citizen path needs no account; it is rate-limited at 60 reports per five minutes per IP in the local implementation. Citizen reports are labelled and treated as a signal, not as verified incident truth.")

# 24 — Admin
def admin_slide():
    s = new_slide(24, "Governance", "Administration is calibration, not a back door",
                  "Weights are versioned and dry-run; every mutation is attributable.")
    card(s, 0.55, 1.55, 3.9, 1.75, "01  Calibrate", "Weights with a dry run",
         ["Inspect current weights, submit candidate weights, see the effect before committing. A versioned change is audited."], accent=TEAL, size=8.0)
    card(s, 4.62, 1.55, 3.9, 1.75, "02  Recalculate", "Rebuild, do not overwrite",
         ["Recalculate all cells from stored evidence. The evidence ledger remains append-only; the projection is rebuilt."], accent=BLUE, size=8.0)
    card(s, 8.69, 1.55, 4.09, 1.75, "03  Govern users", "Activate, deactivate, inspect",
         ["User status changes and role assignment are audited. Deactivation revokes operational access."], accent=AMBER, size=8.0)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 3.55, 7.55, 3.0, CARD, LINE)
    text(s, 0.75, 3.7, 7.0, 0.22, "AUDIT: THE OPERATIONAL MEMORY", 7.5, PURPLE, True)
    text(s, 0.75, 4.0, 7.0, 0.42, "1,053 audit rows in the local database.", 14.0, NAVY, True)
    multi(s, 0.75, 4.48, 7.0, 1.82, [
        ("Actor and role:", "who made the request, not just which service."),
        ("Action and resource:", "weight change, incident transition, user status, recalc."),
        ("Before and after:", "the material change is recorded for reversible review."),
        ("Request context:", "requestId, IP and timestamp support tracing and incident review."),
    ], size=8.0, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 8.3, 3.55, 4.48, 1.4, NAVY, None)
    text(s, 8.5, 3.7, 4.0, 0.22, "WHAT ADMIN CANNOT DO", 7.3, "70D6C8", True)
    text(s, 8.5, 4.0, 4.0, 0.8, "No silent incident edit. No audit deletion. No bypass of the 60-second lock or the state machine.", 9.1, "FFFFFF", True, spacing=0.96)
    shape(s, MSO_SHAPE.RECTANGLE, 8.3, 5.12, 4.48, 1.43, CARD, LINE)
    text(s, 8.5, 5.27, 4.0, 0.22, "SYSTEM HEALTH", 7.3, TEAL, True)
    multi(s, 8.5, 5.55, 4.05, 0.9, [
        "Source status and last success",
        "Forecast error and snapshot coverage",
        "Node / Python health and queue depth",
    ], size=7.4, gap=2, bullet=True)
    notes(s, "Administration is deliberately constrained. Weight changes support a dry run before commit. Recalculation rebuilds projections from evidence rather than editing history. User status changes are audited. The audit trail is an operational record: 973 rows locally. Admin can calibrate, but cannot silently rewrite an incident or erase the trail.")

# 25 — Source ledger
def sources_slide():
    s = new_slide(25, "Provenance", "The source ledger is part of the product",
                  "Each family has an owner, a cadence, an evidence class and a visible failure mode.")
    rows = [
        ["Source family", "Status", "Evidence", "Volume", "Failure behaviour"],
        ["Weather providers", ("LIVE", TEAL), "Measured → interpolated", "100 events · avg nearest 2.132 km", "Fallback chain, then labelled synthetic; confidence drops."],
        ["TomTom flow", ("LIVE", TEAL), "Measured provider flow", "46 events", "Budget guard; missing mobility, not zero."],
        ["TomTom incidents", ("LIVE", TEAL), "Measured provider incidents", "14 events", "Last-known state is not silently promoted."],
        ["OSM + elevation", ("STATIC", BLUE), "Real static geometry", "5,211 roads · 100 terrain", "Load-time dependency; no invented geometry."],
        ["Citizen + field GPS", ("AVAILABLE", PURPLE), "Reported / simulated", "runtime", "Labelled, rate-limited, queued offline."],
        ["GTFS-Realtime", ("DORMANT", RED), "Unavailable", "0 rows", "No transit claim; adapter stays off until configured."],
    ]
    table(s, 0.55, 1.55, [2.35, 1.16, 2.85, 2.46, 3.41], rows, row_h=0.61, size=7.8, head_size=7.2)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 5.95, 12.23, 0.7, AMBER_S, None)
    text(s, 0.78, 6.1, 11.8, 0.4,
         "A source can be unavailable without breaking the platform; /v1/data-quality makes freshness and interpolation visible, never a measured zero.",
         9.4, AMBER, True)
    notes(s, "The source ledger is a user-facing accountability surface. Weather, traffic flow and traffic incidents are live. OSM and elevation are static. Citizen and field reports are reported or simulated and labelled. GTFS is dormant because no URL is configured. The ledger makes the difference visible instead of burying it in logs.")

# 26 — Transit
def transit_slide():
    s = new_slide(26, "Scope boundary", "Transit is present in the architecture, absent from the data",
                  "The adapter is real; the feed is not. The deck keeps that distinction visible.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 4.0, 4.95, CARD, LINE)
    text(s, 0.75, 1.7, 3.5, 0.22, "CURRENT STATE", 7.5, RED, True)
    text(s, 0.75, 2.0, 3.5, 0.55, "Dormant.", 27, RED, True)
    multi(s, 0.75, 2.72, 3.55, 2.9, [
        ("GTFS_RT_URL", "unset"),
        ("TRANSIT_SIMULATION_ENABLED", "false"),
        ("Telemetry rows", "0 transit events"),
        ("Poll cadence", "10 s only when configured"),
        ("UI treatment", "service status, not live arrivals"),
    ], size=8.2, gap=6, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.75, 5.62, 3.55, 0.62, RED_S, None)
    text(s, 0.9, 5.76, 3.3, 0.3, "No Bhopal live-transit claim.", 8.4, RED, True)
    shape(s, MSO_SHAPE.RECTANGLE, 4.78, 1.55, 8.0, 2.38, CARD, LINE)
    text(s, 4.98, 1.7, 7.3, 0.22, "WHAT THE ADAPTER EXPECTS", 7.5, AMBER, True)
    multi(s, 4.98, 2.02, 7.4, 1.72, [
        ("Feed shape:", "GTFS-Realtime protobuf with trip updates or vehicle positions."),
        ("Project contract:", "the adapter reads a non-standard vehicle.trip.stopId field; a standard feed must be checked before enabling."),
        ("Join:", "positions would map to H3 and join the same cell evidence path as other measured signals."),
        ("Never:", "invent arrivals to fill a polished UI."),
    ], size=8.0, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 4.78, 4.12, 8.0, 2.38, NAVY, None)
    text(s, 4.98, 4.27, 7.3, 0.22, "WHAT ENABLING IT WOULD REQUIRE", 7.3, "70D6C8", True)
    reqs = [("01", "A real GTFS-RT endpoint"), ("02", "A compatibility check against the adapter"),
            ("03", "A key or auth method if the feed needs one"), ("04", "A field-mapping test before any UI claim")]
    for i, (n, t) in enumerate(reqs):
        y = 4.62 + i * 0.4
        text(s, 5.0, y, 0.4, 0.2, n, 7.2, "A9E7DD", True)
        text(s, 5.45, y, 6.9, 0.2, t, 8.1, "FFFFFF")
    text(s, 4.98, 6.22, 7.4, 0.2, "Simulation is for path testing only; it is never presented as a city feed.", 7.0, "8FA6B8", italic=True)
    notes(s, "Transit is the clearest example of an honest boundary. The code contains a GTFS-Realtime poller, but GTFS_RT_URL is unset, simulation is disabled and there are zero transit telemetry rows. The adapter also expects a non-standard trip.stopId field. So the deck does not claim live Bhopal transit. Enabling it needs a real feed, compatibility work and a mapping test.")

# 27 — Frontend and realtime
def frontend_slide():
    s = new_slide(27, "Experience layer", "One API, four role-shaped surfaces",
                  "The frontend is a client of Node only; live updates arrive over SSE with Socket.IO as a parallel channel.")
    channels = [("OPERATOR", "Live H3 map, cell evidence, alert queue, incident action, dispatch.", BLUE),
                ("FIELD", "Assigned tasks, GPS, status transitions, evidence upload, offline outbox.", AMBER),
                ("ADMIN", "Weights, dry-run, users, sources, audit, forecast accuracy.", PURPLE),
                ("CITIZEN", "QR entry, geotagged report, category and description. No account.", TEAL)]
    for i, (t, d, col) in enumerate(channels):
        y = 1.55 + i * 0.99
        shape(s, MSO_SHAPE.RECTANGLE, 0.55, y, 4.0, 0.84, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, 0.55, y, 0.05, 0.84, col)
        text(s, 0.74, y + 0.1, 3.5, 0.2, t, 7.5, col, True)
        text(s, 0.74, y + 0.34, 3.6, 0.42, d, 7.7, MUTED, spacing=0.93)
    text(s, 0.55, 5.62, 4.0, 0.2, "ROLE-AWARE ROUTING, SAME DESIGN SYSTEM", 6.8, FAINT, True)
    shape(s, MSO_SHAPE.RECTANGLE, 4.82, 1.55, 4.0, 4.95, CARD, LINE)
    text(s, 5.02, 1.7, 3.5, 0.22, "LIVE PATH", 7.5, TEAL, True)
    flow = [("Node", "risk cycle / alert write"), ("SSE", "GET /api/v1/stream/h3"), ("useLiveCells", "parse + batch"), ("Map + panels", "incremental update")]
    for i, (t, d) in enumerate(flow):
        y = 2.1 + i * 0.95
        shape(s, MSO_SHAPE.RECTANGLE, 5.02, y, 3.58, 0.72, TEAL_S if i < 3 else NAVY, None)
        text(s, 5.14, y + 0.08, 3.35, 0.2, t, 8.6, NAVY if i < 3 else "FFFFFF", True)
        text(s, 5.14, y + 0.33, 3.35, 0.2, d, 7.0, MUTED if i < 3 else "B9CAD9")
        if i < 3:
            text(s, 6.6, y + 0.73, 0.3, 0.18, "↓", 8, FAINT, True)
    text(s, 5.02, 5.97, 3.6, 0.42, "Heartbeat every 15 s; reconnect backoff 2–30 s.", 7.1, MUTED, italic=True)
    shape(s, MSO_SHAPE.RECTANGLE, 9.0, 1.55, 3.78, 4.95, NAVY, None)
    text(s, 9.2, 1.7, 3.3, 0.22, "REALTIME CHOICES", 7.3, "70D6C8", True)
    multi(s, 9.2, 2.05, 3.35, 4.0, [
        ("SSE is primary:", "one-way server updates over a normal authenticated HTTP stream."),
        ("Socket.IO:", "parallel event channel with an optional Redis adapter for multi-node fan-out."),
        ("Batching:", "cell and alert bursts are coalesced so the map does not re-render per event."),
        ("Resilience:", "buffer, reconnect, refetch the snapshot after a gap."),
        ("Security:", "the stream is protected; the browser never receives a Python token or database credential."),
    ], size=7.9, gap=5, bullet=True, color="FFFFFF", lead="A9E7DD")
    notes(s, "The frontend has four role-shaped surfaces but one API. SSE is the primary live channel; Socket.IO is also present and can use Redis for multi-node fan-out. The client batches updates, has a heartbeat and reconnects with exponential backoff from two to thirty seconds. After a gap it refetches the snapshot rather than assuming it missed nothing.")

# 28 — Python architecture
def python_slide():
    s = new_slide(28, "Intelligence layer", "Python is an advisory instrument, not a second core",
                  "FastAPI reads shared state and returns context; Node owns every operational write.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 7.7, 4.95, CARD, LINE)
    text(s, 0.75, 1.7, 7.1, 0.22, "FASTAPI SERVICE  ·  INTERNAL PORT", 7.5, PURPLE, True)
    modules = [("Cell memory", "samples, hourly summaries, neighbour correlation, next-hour projection", PURPLE),
               ("H3 multi-resolution", "parent and child rollups with contribution shares", TEAL),
               ("Graph analytics", "centrality, critical nodes, weighted routes", BLUE),
               ("Hybrid RAG", "semantic + spatial + temporal + outcome retrieval", AMBER),
               ("LangGraph agents", "evidence assembly, recommendation, dry-run notifications", GREEN),
               ("Health / status", "feature flags, provider state, Mongo connectivity", FAINT)]
    for i, (t, d, col) in enumerate(modules):
        x = 0.75 + (i % 2) * 3.75; y = 2.08 + (i // 2) * 1.35
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 3.5, 1.12, "FAFBFC", LINE)
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 0.04, 1.12, col)
        text(s, x + 0.15, y + 0.12, 3.15, 0.2, t, 8.8, NAVY, True)
        text(s, x + 0.15, y + 0.4, 3.18, 0.58, d, 7.3, MUTED, spacing=0.93)
    shape(s, MSO_SHAPE.RECTANGLE, 8.5, 1.55, 4.28, 2.3, NAVY, None)
    text(s, 8.7, 1.7, 3.8, 0.22, "BOUNDARY CONTRACT", 7.3, "70D6C8", True)
    multi(s, 8.7, 2.02, 3.85, 1.66, [
        "Node authenticates and proxies every call.",
        "Python never dispatches, sends SMS or changes incident status.",
        "No second database and no separate source of truth.",
        "Cloudflare Workers AI when configured; deterministic fallbacks remain available.",
    ], size=7.8, gap=3, bullet=True, color="FFFFFF", lead="A9E7DD")
    shape(s, MSO_SHAPE.RECTANGLE, 8.5, 4.02, 4.28, 2.48, CARD, LINE)
    text(s, 8.7, 4.17, 3.8, 0.22, "FAILURE MODE", 7.5, AMBER, True)
    text(s, 8.7, 4.48, 3.85, 0.46, "Intelligence degrades; operations continue.", 10.8, NAVY, True, spacing=0.95)
    text(s, 8.7, 5.02, 3.85, 1.2, "If FastAPI is down, the operator still has cells, alerts, incidents and evidence. The UI shows intelligence unavailable instead of inventing a recommendation.", 8.0, MUTED, spacing=0.96)
    text(s, 0.55, 6.65, 12.2, 0.2, "Current local health: five features available, Mongo connected, Cloudflare providers active with local fallbacks.", 7.2, FAINT, italic=True)
    notes(s, "Python is a FastAPI service with five feature families: cell memory, multi-resolution H3, graph analytics, hybrid RAG and the LangGraph workflow. Node authenticates and proxies. Python reads the same Mongo database and returns advisory output. If it fails, the operational console continues without it. Nothing in Python can dispatch a crew or change incident state.")

# 29 — Memory and multi-resolution
def memory_slide():
    s = new_slide(29, "Intelligence", "Memory is local; resolution is hierarchical",
                  "The system remembers recent cell behaviour and can explain which parent or child contributes to risk.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 6.1, 4.95, CARD, LINE)
    text(s, 0.75, 1.7, 5.5, 0.22, "CELL MEMORY", 7.5, PURPLE, True)
    text(s, 0.75, 2.0, 5.55, 0.34, "288 samples per stored memory cycle.", 12.5, NAVY, True)
    multi(s, 0.75, 2.46, 5.55, 2.4, [
        ("What it keeps:", "time-stamped risk and component samples, hourly summaries, neighbour correlations."),
        ("Neighbour logic:", "Pearson correlation across nearby cell histories; not causation."),
        ("Projection:", "next hour = current + slope × 0.6; next 3 hours = current + slope × 1.8."),
        ("What it is not:", "not a trained sequence model, not a learned forecast, not a substitute for observation."),
    ], size=8.0, gap=4, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.75, 4.95, 5.55, 1.35, PURPLE_S, None)
    text(s, 0.92, 5.1, 5.2, 0.22, "CURRENTLY STORED", 7.3, PURPLE, True)
    text(s, 0.92, 5.4, 5.2, 0.7, "100 cell memories. Materialized across every stored cell; still not enough to claim city-wide predictive coverage.", 8.3, INK, spacing=0.96)
    shape(s, MSO_SHAPE.RECTANGLE, 6.83, 1.55, 5.95, 4.95, NAVY, None)
    text(s, 7.03, 1.7, 5.4, 0.22, "MULTI-RESOLUTION H3", 7.3, "70D6C8", True)
    levels = [("RES 4", "city / parent", "0.737 km² cells roll up"), ("RES 6", "neighbourhood", "16 res-8 children"), ("RES 8", "street cell", "operational score")]
    for i, (r, name, d) in enumerate(levels):
        y = 2.1 + i * 0.86
        text(s, 7.05, y, 0.95, 0.22, r, 9.0, "A9E7DD", True)
        text(s, 8.0, y, 2.1, 0.22, name, 9.0, "FFFFFF", True)
        text(s, 10.0, y, 2.6, 0.22, d, 7.2, "8FA6B8")
    shape(s, MSO_SHAPE.RECTANGLE, 7.05, 4.8, 5.4, 0.72, "17364D", None)
    text(s, 7.22, 4.94, 5.1, 0.3, "contribution = cell risk ÷ parent total", 10.5, "FFFFFF", True)
    text(s, 7.05, 5.65, 5.4, 0.68, "The rollup is an explanation tool: it shows which child cells concentrate a parent's risk. It is not a second risk engine.", 8.0, "B9CAD9", spacing=0.95)
    notes(s, "Cell memory stores samples and summaries, not a trained model. It computes neighbour correlation with Pearson and projects next hour and three hours using slope multipliers. All 100 stored cells have materialized memories, so this is a working capability, not city-scale predictive evidence. Multi-resolution H3 rolls cells up to resolution 6 and 4 and reports each child's share of parent risk.")

# 30 — Graph
def graph_slide():
    s = new_slide(30, "Intelligence", "Graph analytics: where the network is exposed",
                  "A cell graph turns neighbour risk into structural questions about chokepoints and routes.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 5.6, 4.95, CARD, LINE)
    text(s, 0.75, 1.7, 5.1, 0.22, "GRAPH CONSTRUCTION", 7.5, BLUE, True)
    formula(s, 0.75, 2.04, 5.15, 0.78, "edge weight = 1 + |risk(A) − risk(B)|",
            "A larger risk gap makes the edge more expensive to cross.", fill=NAVY, fg="FFFFFF", size=9.0)
    multi(s, 0.75, 3.02, 5.1, 2.1, [
        ("Nodes:", "H3 cells with a current operational state."),
        ("Edges:", "neighbour relationships; risk difference becomes traversal cost."),
        ("Library:", "NetworkX over the cell/neighbour graph."),
        ("Scale today:", "100 nodes; the local graph is a working demo, not a metropolitan-scale benchmark."),
    ], size=8.1, gap=5, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.75, 5.18, 5.15, 1.1, BLUE_S, None)
    text(s, 0.92, 5.32, 4.85, 0.22, "WHY WEIGHT BY RISK DIFFERENCE?", 7.2, BLUE, True)
    text(s, 0.92, 5.6, 4.85, 0.52, "It makes a route through uniformly risky cells cheaper than a route across a sharp risk boundary, where conditions change quickly.", 7.7, INK, spacing=0.94)
    shape(s, MSO_SHAPE.RECTANGLE, 6.35, 1.55, 6.43, 4.95, NAVY, None)
    text(s, 6.55, 1.7, 5.8, 0.22, "WHAT IT ANSWERS", 7.3, "70D6C8", True)
    qs = [("01", "Critical nodes", "Which cells sit on the most connective paths between high-risk areas?"),
          ("02", "Centrality", "Betweenness and degree expose hubs that a local score alone would miss."),
          ("03", "Composite ranking", "0.6 × betweenness + 0.4 × degree; structural importance, not emergency priority."),
          ("04", "Weighted routes", "Least-cost paths between cells, with high risk gaps priced in."),
          ("05", "Cut vertices", "Nodes whose removal fragments the graph; useful for contingency review.")]
    for i, (n, t, d) in enumerate(qs):
        y = 2.1 + i * 0.8
        text(s, 6.58, y, 0.4, 0.2, n, 7.2, "A9E7DD", True)
        text(s, 7.05, y, 5.35, 0.2, t, 8.5, "FFFFFF", True)
        text(s, 7.05, y + 0.24, 5.4, 0.42, d, 7.2, "B9CAD9", spacing=0.93)
    notes(s, "The graph uses H3 cells as nodes and neighbour relationships as edges. Edge weight is one plus the absolute risk difference, so crossing a sharp boundary is more expensive. It computes degree, betweenness, a composite ranking of 60 percent betweenness and 40 percent degree, critical nodes, cut vertices and weighted routes. This is structural analysis, not dispatch priority.")

# 31 — Hybrid RAG
def rag_slide():
    s = new_slide(31, "Intelligence", "Retrieval is hybrid, because place matters",
                  "Semantic similarity alone is not enough for an incident in a specific cell and season.")
    formula(s, 0.55, 1.55, 7.5, 1.08, "score = 0.50·semantic + 0.25·spatial + 0.15·temporal + 0.10·outcome",
            "Top-k results are evidence for a brief; they are not instructions.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 2.86, 3.85, 3.6, CARD, LINE)
    text(s, 0.75, 3.01, 3.4, 0.22, "THREE RETRIEVAL SIGNALS", 7.5, TEAL, True)
    signals = [("Semantic", "cosine similarity of the query and document vectors.", "0.50"),
               ("Spatial", "same cell, H3 distance, or shared res-6 parent.", "0.25"),
               ("Temporal", "season and hour-of-day proximity; playbooks are season-neutral.", "0.15"),
               ("Outcome", "resolved incidents outrank open or unverified context.", "0.10")]
    for i, (t, d, w) in enumerate(signals):
        y = 3.36 + i * 0.74
        text(s, 0.75, y, 1.05, 0.2, t, 8.4, NAVY, True)
        text(s, 1.82, y, 2.05, 0.46, d, 7.4, MUTED, spacing=0.93)
        text(s, 3.88, y, 0.36, 0.2, w, 8.4, TEAL, True)
    shape(s, MSO_SHAPE.RECTANGLE, 4.62, 2.86, 3.4, 3.6, CARD, LINE)
    text(s, 4.82, 3.01, 3.0, 0.22, "EMBEDDINGS", 7.5, PURPLE, True)
    text(s, 4.82, 3.32, 3.0, 0.4, "384 dimensions, locally reproducible.", 10.0, NAVY, True, spacing=0.95)
    multi(s, 4.82, 3.82, 3.0, 2.45, [
        ("Hosted:", "Cloudflare Workers AI @cf/baai/bge-small-en-v1.5, 384 dimensions."),
        ("Fallback:", "deterministic hashed lexical vectors with no external account."),
        ("Briefs:", "Cloudflare Workers AI llama-3.3-70b when configured; deterministic template fallback."),
        ("Storage:", "vectors live on knowledge_documents in MongoDB; no separate vector database."),
    ], size=7.6, gap=5, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 8.24, 2.86, 4.54, 3.6, NAVY, None)
    text(s, 8.44, 3.01, 4.0, 0.22, "CORPUS, TODAY", 7.3, "70D6C8", True)
    text(s, 8.44, 3.34, 4.0, 0.5, "23 documents", 20, "FFFFFF", True)
    text(s, 8.44, 3.92, 4.0, 0.24, "13 historical incidents + 10 playbooks", 8.2, "D6E2EC")
    multi(s, 8.44, 4.38, 4.0, 1.72, [
        "Playbooks are project-authored, not official SOPs.",
        "isOfficial:false is stored and returned.",
        "A past incident is context, not proof that the same action will work.",
        "Sources and snippets are returned with the score.",
    ], size=7.6, gap=3, bullet=True, color="FFFFFF", lead="A9E7DD")
    text(s, 0.55, 6.62, 12.2, 0.2, "Hosted briefs use Cloudflare Workers AI; the deterministic template remains the fallback.", 7.2, FAINT, italic=True)
    notes(s, "RAG scores 50 percent semantic, 25 percent spatial, 15 percent temporal and 10 percent outcome. That lets an incident in the same cell and season outrank a marginally closer wording elsewhere. The hosted embedding is Cloudflare Workers AI bge-small-en-v1.5 at 384 dimensions. A deterministic hashed lexical vector remains the no-account fallback. Briefs use Cloudflare llama-3.3-70b when configured, with a deterministic template fallback. There are 23 documents: 13 historical incidents and 10 project-authored playbooks. Playbooks are marked isOfficial false.")

# 32 — LangGraph
def langgraph_slide():
    s = new_slide(32, "Intelligence", "Eight nodes, one advisory workflow",
                  "LangGraph assembles evidence and a recommendation; it never performs the dispatch.")
    nodes = [("detect_incident", "category from cell context"), ("risk_assessment", "cell + alert + forecast"),
             ("context_retrieval", "hybrid RAG top-k"), ("resource_allocation", "playbook + crew options"),
             ("communication", "brief + dry-run plan"), ("execution", "read persisted progress"),
             ("escalation_agent", "recommend or hold"), ("learning_agent", "store outcome sample")]
    for i, (t, d) in enumerate(nodes):
        x = 0.55 + (i % 4) * 3.1; y = 1.55 + (i // 4) * 2.12
        col = TEAL if i < 4 else (AMBER if i < 7 else GREEN)
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 2.92, 1.48, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, x, y, 2.92, 0.045, col)
        text(s, x + 0.16, y + 0.18, 2.55, 0.22, f"0{i+1}", 7.5, col, True)
        text(s, x + 0.16, y + 0.45, 2.55, 0.24, t, 8.8, NAVY, True)
        text(s, x + 0.16, y + 0.8, 2.55, 0.46, d, 7.2, MUTED, spacing=0.93)
        if i % 4 < 3:
            arrow(s, x + 2.94, y + 0.64, 0.12, 0.1, LINE)
    text(s, 11.95, 3.3, 0.55, 0.22, "↓", 10, FAINT, True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 5.85, 12.23, 0.92, AMBER_S, None)
    text(s, 0.78, 6.0, 11.7, 0.56,
         "Hard stops: no dispatch, no SMS, no incident status change, no online retraining. Notifications are queued as dry-run plans.",
         10.5, AMBER, True, spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 6.95, 12.23, 0.01, AMBER)
    notes(s, "The graph has eight nodes in a fixed sequence: detect incident, risk assessment, context retrieval, resource allocation, communication, execution, escalation agent and learning agent. It resolves category, severity and urgency, retrieves top-k evidence, prepares resource and crew options, writes a grounded brief, reads persisted progress, recommends escalation, and stores an outcome sample. The run is marked dryRun true. Notifications are not sent, status is not changed and retraining is deferred offline.")

# 33 — Reliability and security
def reliability_slide():
    s = new_slide(33, "Non-functional", "Reliability, security and the honest performance line",
                  "Operational safeguards are implemented; scale and penetration-test claims are not.")
    cols = [
        ("SECURITY", BLUE, ["Helmet + strict CORS allow-list", "JWT access, rotating refresh", "Role checks per route", "Audit on every mutation", "Hashed, revocable sessions"]),
        ("DATA INTEGRITY", TEAL, ["Idempotency keys for writes", "Dedupe hashes on telemetry", "Append-only evidence ledger", "No zero-fill for missing data", "Explicit source provenance"]),
        ("RUNTIME SAFETY", AMBER, ["300 req/min global limiter", "60 citizen reports / 5 min", "100 kB JSON body cap", "Dead-letter queue + circuit breakers", "Graceful shutdown and health checks"]),
        ("WHAT IS NOT CLAIMED", RED, ["No penetration test", "No production SLA", "No metropolitan load benchmark", "No external uptime guarantee"]),
    ]
    for i, (t, col, items) in enumerate(cols):
        x = 0.55 + i * 3.1
        shape(s, MSO_SHAPE.RECTANGLE, x, 1.55, 2.92, 3.85, CARD, LINE)
        shape(s, MSO_SHAPE.RECTANGLE, x, 1.55, 2.92, 0.05, col)
        text(s, x + 0.17, 1.72, 2.55, 0.22, t, 7.5, col, True)
        multi(s, x + 0.17, 2.08, 2.58, 3.1, items, size=7.8, gap=7, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 5.65, 7.55, 1.2, CARD, LINE)
    text(s, 0.75, 5.8, 7.0, 0.22, "OBSERVABILITY", 7.5, PURPLE, True)
    text(s, 0.75, 6.08, 7.0, 0.62, "Health endpoints, source status, forecast accuracy, audit logs and per-node agent traces. A failed provider is visible; it is not quietly replaced by a happy path.", 8.1, MUTED, spacing=0.95)
    shape(s, MSO_SHAPE.RECTANGLE, 8.3, 5.65, 4.48, 1.2, NAVY, None)
    text(s, 8.5, 5.8, 4.0, 0.22, "PERFORMANCE HONESTY", 7.3, "70D6C8", True)
    text(s, 8.5, 6.08, 4.0, 0.6, "Local requests are fast enough to operate. No claim of measured throughput or a production latency SLO is made.", 8.1, "FFFFFF", spacing=0.95)
    notes(s, "The safeguards are real and visible in the middleware and services: strict CORS, short-lived access tokens, rotating refresh sessions, role checks, idempotency, dedupe, rate limits, a 100 kB body cap, DLQ, circuit breakers and health checks. What is not claimed matters just as much: no penetration test, no production SLA and no metropolitan load benchmark.")

# 34 — Verified snapshot
def snapshot_slide():
    s = new_slide(34, "Verification", "What the local snapshot actually shows",
                  "Current database counts, source freshness and reachable services. This is not a production benchmark.")
    metrics = [("100", "spatial cells", "43 Bhopal · 32 Indore · 25 Sehore", TEAL),
               ("260", "telemetry events", "100 weather · 100 GIS · 46 flow · 14 incidents", BLUE),
               ("150", "alerts", "28 open · 96 resolved · 26 expired", AMBER),
               ("13", "incidents", "5 approved · 4 escalated · 2 resolved · 2 detected", PURPLE)]
    for i, (v, lab, note, col) in enumerate(metrics):
        metric(s, 0.55 + i * 3.1, 1.55, 2.92, 1.36, v, lab, note, col)
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 3.12, 7.55, 3.25, CARD, LINE)
    text(s, 0.75, 3.27, 7.0, 0.22, "DATA AND RUNTIME EVIDENCE", 7.5, TEAL, True)
    rows = [
        ["Road segments", "5,211", "Terrain cells", "100"],
        ["Forecast snapshots", "5,124", "Knowledge documents", "23"],
        ["Cell memories", "100", "Agent runs", "5"],
        ["Users", "11", "Audit logs", "1,053"],
        ["Transit telemetry", "0", "Token sessions", "106"],
    ]
    for r, row in enumerate(rows):
        y = 3.65 + r * 0.46
        for c, val in enumerate(row):
            x = 0.75 + c * 1.92
            text(s, x, y, 1.62, 0.2, val, 8.2, NAVY if c % 2 == 0 else TEAL, c % 2 == 0)
            if c % 2 == 0:
                text(s, x + 0.02, y + 0.02, 1.62, 0.2, "", 7, MUTED)
    text(s, 0.75, 5.94, 7.0, 0.22, "Node /api/health and Python /health were reachable; five Python features and Mongo were available.", 7.1, MUTED, italic=True)
    shape(s, MSO_SHAPE.RECTANGLE, 8.3, 3.12, 4.48, 1.52, GREEN_S, None)
    text(s, 8.48, 3.27, 4.0, 0.22, "VERIFIED HERE", 7.3, GREEN, True)
    multi(s, 8.48, 3.57, 4.05, 0.9, [
        "Database counts and /v1/data-quality queried locally",
        "Health endpoints reachable",
        "Weather interpolated by IDW; 0 synthetic / 0 simulated",
    ], size=7.5, gap=3, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 8.3, 4.82, 4.48, 1.55, RED_S, None)
    text(s, 8.48, 4.97, 4.0, 0.22, "NOT ESTABLISHED HERE", 7.3, RED, True)
    multi(s, 8.48, 5.27, 4.05, 0.98, [
        "No full CI result is claimed by this deck",
        "No production load test",
        "No municipal data-sharing agreement",
    ], size=7.5, gap=3, bullet=True)
    notes(s, "This is the verification slide. The counts are current local Mongo values: 100 cells, 260 telemetry events, 150 alerts, 13 incidents, 5,211 road segments, 5,124 forecast snapshots and 1,053 audit rows. The data-quality endpoint reported 0 synthetic and 0 simulated events, with weather interpolated by IDW. Node and Python health were reachable. This deck does not claim a full CI pass, a production load test or a municipal data agreement.")

# 35 — Limits and roadmap
def limits_slide():
    s = new_slide(35, "Limits and next", "What this system is not—yet",
                  "Naming the limits is part of the engineering, not a disclaimer at the end.")
    shape(s, MSO_SHAPE.RECTANGLE, 0.55, 1.55, 3.9, 4.95, CARD, LINE)
    text(s, 0.75, 1.7, 3.4, 0.22, "EVIDENCE LIMITS", 7.5, AMBER, True)
    multi(s, 0.75, 2.04, 3.45, 4.1, [
        ("Coverage:", "100 cells is a demonstrator, not a city census."),
        ("Traffic:", "46 flow readings cannot represent every road at every hour."),
        ("Weather:", "provider points are interpolated; not street-level gauges."),
        ("Vulnerability:", "terrain proxy, not social or household vulnerability."),
        ("Transit:", "zero rows; the adapter is dormant, not live."),
        ("Citizen data:", "unverified and not a representative sample."),
        ("Forecast:", "no accuracy claim until issued forecasts are compared with observations."),
    ], size=7.8, gap=6, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 4.62, 1.55, 3.9, 4.95, CARD, LINE)
    text(s, 4.82, 1.7, 3.4, 0.22, "OPERATIONAL LIMITS", 7.5, RED, True)
    multi(s, 4.82, 2.04, 3.45, 4.1, [
        ("Forecast:", "slope extrapolation, not learned prediction."),
        ("Memory:", "100 stored cell memories; still not citywide learning."),
        ("Agents:", "5 runs, dry-run only; no notification delivery."),
        ("Security:", "hardened flow, but not penetration-tested."),
        ("Scale:", "no measured metropolitan throughput."),
        ("Transit mapping:", "the adapter expects a non-standard stop field."),
        ("RAG corpus:", "23 documents, including 10 project-authored playbooks."),
    ], size=7.8, gap=6, bullet=True)
    shape(s, MSO_SHAPE.RECTANGLE, 8.69, 1.55, 4.09, 4.95, NAVY, None)
    text(s, 8.89, 1.7, 3.5, 0.22, "NEXT, IN ORDER", 7.3, "70D6C8", True)
    phases = [("01", "Validate", "Compare forecasts with observations; publish error by horizon."),
              ("02", "Extend", "Add a compatible transit feed and more traffic probes."),
              ("03", "Ground", "Replace terrain-only vulnerability with field and social data."),
              ("04", "Harden", "Load test, penetration test, backup and restore drills."),
              ("05", "Govern", "Data-sharing agreement, retention policy and human review.")]
    for i, (n, t, d) in enumerate(phases):
        y = 2.1 + i * 0.76
        text(s, 8.9, y, 0.35, 0.2, n, 7.2, "A9E7DD", True)
        text(s, 9.35, y, 3.0, 0.2, t, 8.5, "FFFFFF", True)
        text(s, 9.35, y + 0.23, 3.1, 0.35, d, 7.0, "B9CAD9", spacing=0.93)
    text(s, 0.55, 6.62, 12.2, 0.2, "The roadmap is ordered by evidence value: validate first, then broaden coverage, then harden for scale.", 7.2, FAINT, italic=True)
    notes(s, "The limits are concrete. A hundred cells is not a city census. Forty-six flow readings are not full road coverage. Weather is interpolated. Vulnerability is a terrain proxy. Transit has zero rows. Forecasts are not learned. There are 100 cell memories and five dry-run agent runs. Security is hardened but not penetration-tested. The roadmap starts with validation, because more coverage without validation only creates more confident noise.")

# 36 — Conclusion
def conclusion_slide():
    s = prs.slides.add_slide(BLANK)
    bg = s.background.fill; bg.solid(); bg.fore_color.rgb = C(NAVY)
    shape(s, MSO_SHAPE.RECTANGLE, 0, 0, 0.12, 7.5, TEAL)
    for i in range(6):
        shape(s, MSO_SHAPE.HEXAGON, 10.75 + (i % 3) * 0.86, 4.3 + (i // 3) * 0.86,
              0.72, 0.62, None, "21445F", 0.8)
    text(s, 0.82, 0.72, 8.0, 0.22, "CONCLUSION", 8.5, "70D6C8", True)
    text(s, 0.82, 1.18, 10.7, 1.35, "A city model is only\nas good as its evidence.", 34, "FFFFFF", True, spacing=0.92)
    claims = [("It is real", "The API, database, risk engine, alert workflow, field path and Python service run together."),
              ("It is bounded", "Advisory intelligence cannot dispatch, send, or rewrite operational state."),
              ("It is inspectable", "Every score points back to source, time, formula and confidence.")]
    for i, (t, d) in enumerate(claims):
        y = 3.2 + i * 0.88
        text(s, 0.82, y, 1.9, 0.24, t, 9.0, "A9E7DD", True)
        text(s, 2.72, y - 0.02, 7.6, 0.52, d, 9.0, "D6E2EC", spacing=0.95)
        shape(s, MSO_SHAPE.RECTANGLE, 0.82, y + 0.66, 9.6, 0.01, "2B4A60")
    shape(s, MSO_SHAPE.RECTANGLE, 0.82, 5.95, 7.0, 0.05, TEAL)
    text(s, 0.82, 6.14, 10.8, 0.42,
         "The next honest step is not a bigger claim. It is a measured comparison between what was forecast and what happened.",
         10.5, "FFFFFF", True)
    text(s, 0.82, 6.88, 9.0, 0.22, "Metabolic City AI  ·  EPICS  ·  November 2026", 7.2, "8FA6B8")
    text(s, 11.0, 6.88, 1.5, 0.22, "36 / 36", 7.2, "70D6C8", True, align=PP_ALIGN.RIGHT)
    notes(s, "The conclusion is deliberately modest. The system is real enough to run end to end, bounded enough that intelligence cannot seize operational authority, and inspectable enough that a score can be traced to evidence. The next step is validation: compare issued forecasts with observed outcomes before making stronger claims.")


# Build in order. Cover is already slide 1.
for fn in [
    evidence_slide, glance_slide, theory_slide, principles_slide, architecture_slide,
    mern_slide, pipeline_slide, api_slide, operational_schema_slide, evidence_schema_slide,
    auth_slide, ingestion_slide, h3_slide, lifecycle_slide, composite_slide, mobility_slide,
    climate_slide, vulnerability_slide, temporal_slide, alerts_slide, incidents_slide,
    field_slide, admin_slide, sources_slide, transit_slide, frontend_slide, python_slide,
    memory_slide, graph_slide, rag_slide, langgraph_slide, reliability_slide,
    snapshot_slide, limits_slide, conclusion_slide,
]:
    fn()

prs.save(OUT)
print(f"wrote {OUT} with {len(prs.slides)} slides")
