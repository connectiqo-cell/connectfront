# -*- coding: utf-8 -*-
"""Generate Connectiqo Manual Mentor Payout architecture report (PDF)."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    CondPageBreak,
    Flowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT_PATH = Path(__file__).with_name("Connectiqo_Manual_Mentor_Payout_Report.pdf")

NAVY = colors.HexColor("#0F2744")
TEAL = colors.HexColor("#0D7377")
TEAL_DARK = colors.HexColor("#0A5C5F")
GOLD = colors.HexColor("#B8860B")
INK = colors.HexColor("#1A2332")
MUTED = colors.HexColor("#5B6573")
RULE = colors.HexColor("#D5DCE3")
PALE = colors.HexColor("#F4F7F8")
PALE_TEAL = colors.HexColor("#E8F3F3")
PALE_GOLD = colors.HexColor("#F8F1DE")
PALE_RED = colors.HexColor("#FDECEC")
PALE_GREEN = colors.HexColor("#E7F6EE")
PALE_AMBER = colors.HexColor("#FEF4E6")
RED = colors.HexColor("#B42318")
GREEN = colors.HexColor("#027A48")
AMBER = colors.HexColor("#B54708")
WHITE = colors.white


def register_fonts() -> tuple[str, str, str]:
    regular = Path(r"C:\Windows\Fonts\segoeui.ttf")
    bold = Path(r"C:\Windows\Fonts\segoeuib.ttf")
    italic = Path(r"C:\Windows\Fonts\segoeuii.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Body", str(regular)))
        pdfmetrics.registerFont(TTFont("Body-Bold", str(bold)))
        if italic.exists():
            pdfmetrics.registerFont(TTFont("Body-Italic", str(italic)))
            return "Body", "Body-Bold", "Body-Italic"
        return "Body", "Body-Bold", "Body"
    return "Helvetica", "Helvetica-Bold", "Helvetica-Oblique"


FONT, FONT_B, FONT_I = register_fonts()


def styles():
    base = getSampleStyleSheet()
    s = {
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            fontName=FONT_B,
            fontSize=9,
            textColor=TEAL,
            alignment=TA_LEFT,
            letterSpacing=1.4,
            spaceAfter=8,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName=FONT_B,
            fontSize=28,
            leading=34,
            textColor=NAVY,
            spaceAfter=10,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            fontName=FONT,
            fontSize=12.5,
            leading=18,
            textColor=MUTED,
            spaceAfter=6,
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName=FONT_B,
            fontSize=16,
            leading=21,
            textColor=NAVY,
            spaceBefore=16,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName=FONT_B,
            fontSize=12.5,
            leading=17,
            textColor=TEAL_DARK,
            spaceBefore=12,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "h3",
            fontName=FONT_B,
            fontSize=11,
            leading=15,
            textColor=NAVY,
            spaceBefore=8,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "body",
            fontName=FONT,
            fontSize=9.5,
            leading=13.6,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=7,
        ),
        "body_left": ParagraphStyle(
            "body_left",
            fontName=FONT,
            fontSize=9.5,
            leading=13.6,
            textColor=INK,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "caption": ParagraphStyle(
            "caption",
            fontName=FONT_I,
            fontSize=8,
            leading=11,
            textColor=MUTED,
            spaceBefore=2,
            spaceAfter=10,
        ),
        "cell": ParagraphStyle(
            "cell",
            fontName=FONT,
            fontSize=8.2,
            leading=11.4,
            textColor=INK,
        ),
        "cell_b": ParagraphStyle(
            "cell_b",
            fontName=FONT_B,
            fontSize=8.2,
            leading=11.4,
            textColor=NAVY,
        ),
        "th": ParagraphStyle(
            "th",
            fontName=FONT_B,
            fontSize=8,
            leading=11,
            textColor=WHITE,
        ),
        "toc": ParagraphStyle(
            "toc",
            fontName=FONT,
            fontSize=10,
            leading=16,
            textColor=INK,
        ),
        "footer": ParagraphStyle(
            "footer",
            fontName=FONT,
            fontSize=7.5,
            textColor=MUTED,
        ),
        "code": ParagraphStyle(
            "code",
            fontName="Courier",
            fontSize=7.6,
            leading=10.4,
            textColor=NAVY,
            backColor=PALE,
            leftIndent=6,
            rightIndent=6,
            spaceBefore=4,
            spaceAfter=8,
        ),
        "callout_title": ParagraphStyle(
            "callout_title",
            fontName=FONT_B,
            fontSize=9.5,
            leading=13,
            textColor=NAVY,
            spaceAfter=3,
        ),
        "callout_body": ParagraphStyle(
            "callout_body",
            fontName=FONT,
            fontSize=8.6,
            leading=12.2,
            textColor=INK,
        ),
        "step_no": ParagraphStyle(
            "step_no",
            fontName=FONT_B,
            fontSize=10,
            textColor=WHITE,
            alignment=TA_CENTER,
        ),
        "meta": ParagraphStyle(
            "meta",
            fontName=FONT,
            fontSize=9,
            leading=13,
            textColor=MUTED,
        ),
        "li": ParagraphStyle(
            "li",
            fontName=FONT,
            fontSize=9.5,
            leading=13.4,
            textColor=INK,
        ),
        "file": ParagraphStyle(
            "file",
            fontName="Courier",
            fontSize=7.2,
            leading=10,
            textColor=MUTED,
            spaceAfter=1,
        ),
    }
    return s


S = styles()


class Chart(Flowable):
    """A painted flowchart that occupies a fixed width/height in the story."""

    def __init__(self, painter, height, width=170 * mm):
        super().__init__()
        self._painter = painter
        self._h = height
        self._w = width

    def wrap(self, *_a):
        return self._w, self._h

    def draw(self):
        self.canv.saveState()
        self._painter(self.canv, self._w, self._h)
        self.canv.restoreState()


def _wrap(text, font, size, max_w):
    words = text.replace("\n", " \n ").split()
    lines, cur = [], ""
    for w in words:
        if w == "\n":
            if cur:
                lines.append(cur)
            cur = ""
            continue
        trial = (cur + " " + w).strip()
        if stringWidth(trial, font, size) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [""]


def _fill_text(c, x, y, text, font, size, color, max_w, leading=None):
    leading = leading or size + 2.2
    lines = _wrap(text, font, size, max_w)
    total = (len(lines) - 1) * leading
    c.setFillColor(color)
    c.setFont(font, size)
    top = y + total / 2
    for i, line in enumerate(lines):
        c.drawCentredString(x, top - i * leading - size * 0.3, line)


def _round_box(c, x, y, w, h, fill, stroke, title, sub="", radius=5):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(1.1)
    c.roundRect(x - w / 2, y - h / 2, w, h, radius, fill=1, stroke=1)
    if sub:
        _fill_text(c, x, y + 4.5, title, FONT_B, 7.6, NAVY, w - 10, 9.4)
        _fill_text(c, x, y - 6.5, sub, FONT, 6.6, MUTED, w - 10, 8.4)
    else:
        _fill_text(c, x, y, title, FONT_B, 7.8, NAVY, w - 10, 9.6)


def _terminator(c, x, y, w, h, title, fill=NAVY):
    c.setFillColor(fill)
    c.setStrokeColor(fill)
    c.roundRect(x - w / 2, y - h / 2, w, h, h / 2, fill=1, stroke=0)
    _fill_text(c, x, y, title, FONT_B, 8, WHITE, w - 12, 10)


def _diamond(c, x, y, w, h, title):
    p = c.beginPath()
    p.moveTo(x, y + h / 2)
    p.lineTo(x + w / 2, y)
    p.lineTo(x, y - h / 2)
    p.lineTo(x - w / 2, y)
    p.close()
    c.setFillColor(PALE_AMBER)
    c.setStrokeColor(AMBER)
    c.setLineWidth(1.1)
    c.drawPath(p, fill=1, stroke=1)
    _fill_text(c, x, y, title, FONT_B, 7.2, NAVY, w * 0.55, 9)


def _doc(c, x, y, w, h, title, sub=""):
    """Document / proof shape (folded corner)."""
    fold = 7
    p = c.beginPath()
    p.moveTo(x - w / 2, y - h / 2)
    p.lineTo(x - w / 2, y + h / 2)
    p.lineTo(x + w / 2 - fold, y + h / 2)
    p.lineTo(x + w / 2, y + h / 2 - fold)
    p.lineTo(x + w / 2, y - h / 2)
    p.close()
    c.setFillColor(PALE_GOLD)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.drawPath(p, fill=1, stroke=1)
    c.setStrokeColor(GOLD)
    c.line(x + w / 2 - fold, y + h / 2, x + w / 2 - fold, y + h / 2 - fold)
    c.line(x + w / 2 - fold, y + h / 2 - fold, x + w / 2, y + h / 2 - fold)
    if sub:
        _fill_text(c, x - 1, y + 3.5, title, FONT_B, 7.4, NAVY, w - 12, 9)
        _fill_text(c, x - 1, y - 6.5, sub, FONT, 6.4, MUTED, w - 12, 8)
    else:
        _fill_text(c, x - 1, y, title, FONT_B, 7.6, NAVY, w - 12, 9.4)


def _arrow(c, x1, y1, x2, y2, color=TEAL, label="", side="right"):
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(1.25)
    c.line(x1, y1, x2, y2)
    ang_dx, ang_dy = x2 - x1, y2 - y1
    length = (ang_dx ** 2 + ang_dy ** 2) ** 0.5 or 1
    ux, uy = ang_dx / length, ang_dy / length
    px, py = -uy, ux
    size = 5.2
    ax, ay = x2, y2
    path = c.beginPath()
    path.moveTo(ax, ay)
    path.lineTo(ax - ux * size + px * 3.2, ay - uy * size + py * 3.2)
    path.lineTo(ax - ux * size - px * 3.2, ay - uy * size - py * 3.2)
    path.close()
    c.drawPath(path, fill=1, stroke=0)
    if label:
        c.setFillColor(color)
        c.setFont(FONT_B, 6.6)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        if side == "right":
            c.drawString(mx + 5, my - 2, label)
        elif side == "left":
            c.drawRightString(mx - 5, my - 2, label)
        else:
            c.drawCentredString(mx, my + 4, label)


def _badge(c, x, y, text, fill, fg=WHITE):
    tw = stringWidth(text, FONT_B, 6) + 10
    h = 10
    c.setFillColor(fill)
    c.roundRect(x - tw / 2, y - h / 2, tw, h, 3, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont(FONT_B, 6)
    c.drawCentredString(x, y - 2.2, text)


def _legend(c, items, x, y):
    """items: list of (fill, stroke, label)."""
    c.setFont(FONT, 6.4)
    xx = x
    for fill, stroke, label in items:
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.8)
        c.roundRect(xx, y, 8, 8, 2, fill=1, stroke=1)
        c.setFillColor(MUTED)
        c.drawString(xx + 11, y + 1.5, label)
        xx += stringWidth(label, FONT, 6.4) + 28


def paint_collection(c, w, h):
    """Figure 1 — learner payment to mentor wallet credit."""
    cx = 68 * mm
    bw, bh = 112 * mm, 14.5 * mm
    gap = 9.2 * mm
    y = h - 8 * mm

    _badge(c, 18 * mm, h - 5 * mm, "KEEP RAZORPAY", TEAL)
    _badge(c, w - 22 * mm, h - 5 * mm, "COLLECTION", NAVY)

    _terminator(c, cx, y, 52 * mm, 10 * mm, "START  ·  Learner books")
    y2 = y - 10 * mm / 2 - gap
    _arrow(c, cx, y - 10 * mm / 2, cx, y2 + bh / 2)
    y = y2
    _round_box(
        c, cx, y, bw, bh, PALE_GOLD, GOLD,
        "Razorpay Checkout",
        "create-razorpay-order  →  pay  →  verify-razorpay-payment",
    )
    y2 = y - bh / 2 - gap
    _arrow(c, cx, y - bh / 2, cx, y2 + bh / 2)
    y = y2
    _round_box(
        c, cx, y, bw, bh, PALE_TEAL, TEAL,
        "Atomic booking  ·  claim_and_book_slots",
        "Slot locked  ·  booking confirmed  ·  earnings row status = pending",
    )
    y2 = y - bh / 2 - gap
    _arrow(c, cx, y - bh / 2, cx, y2 + bh / 2)
    y = y2
    _round_box(
        c, cx, y, bw, bh, PALE, RULE,
        "Session takes place",
        "Mentor and learner join the call. Booking still confirmed.",
    )
    y2 = y - bh / 2 - gap
    _arrow(c, cx, y - bh / 2, cx, y2 + 16)
    y = y2
    _diamond(c, cx, y, 58 * mm, 28 * mm, "Session marked\ncompleted?")
    # No branch to the right
    _arrow(c, cx + 29 * mm, y, cx + 58 * mm, y, AMBER, "No", "top")
    _round_box(
        c, 148 * mm, y, 40 * mm, 16 * mm, PALE_AMBER, AMBER,
        "Wait",
        "Earnings stay pending",
    )
    y2 = y - 16 - gap
    _arrow(c, cx, y - 14, cx, y2 + bh / 2, TEAL, "Yes", "right")
    y = y2
    _round_box(
        c, cx, y, bw, bh, PALE_GREEN, GREEN,
        "Credit mentor ledger  ·  complete_session_payment",
        "earnings → completed    wallet.balance += mentor cut    total_earned += cut",
    )
    y2 = y - bh / 2 - gap
    _arrow(c, cx, y - bh / 2, cx, y2 + 10 * mm / 2)
    y = y2
    _terminator(c, cx, y, 78 * mm, 10 * mm, "Wallet available  ·  ready to withdraw", GREEN)

    _legend(
        c,
        [
            (PALE_GOLD, GOLD, "Razorpay (inbound)"),
            (PALE_TEAL, TEAL, "Backend"),
            (PALE_GREEN, GREEN, "Ledger credit"),
            (PALE_AMBER, AMBER, "Decision / wait"),
        ],
        8 * mm,
        3 * mm,
    )


def paint_payout(c, w, h):
    """Figure 2 — withdrawal request through admin fulfilment."""
    left = w * 0.36
    right = w * 0.78
    bw, bh = 92 * mm, 13.2 * mm
    gap = 7.6 * mm
    y = h - 7 * mm

    _badge(c, 22 * mm, h - 4.5 * mm, "NO RAZORPAYX", RED)
    _badge(c, w - 28 * mm, h - 4.5 * mm, "MANUAL SETTLEMENT", TEAL)

    _terminator(c, left, y, 58 * mm, 9.5 * mm, "START  ·  Mentor wallet")
    y -= 9.5 * mm / 2 + gap + bh / 2
    _arrow(c, left, y + bh / 2 + gap, left, y + bh / 2)
    _round_box(c, left, y, bw, bh, PALE_TEAL, TEAL, "Save UPI (app or web)", "mentor_profiles.upi_id  ·  no Route KYC")
    y -= bh / 2 + gap + 15
    _arrow(c, left, y + 15 + gap - 2, left, y + 14)
    _diamond(c, left, y, 52 * mm, 26 * mm, "Balance ≥ ₹5,000\nand UPI saved?")
    _arrow(c, left + 26 * mm, y, left + 52 * mm, y, AMBER, "No", "top")
    _round_box(c, left + 72 * mm, y, 36 * mm, 16 * mm, PALE_AMBER, AMBER, "Blocked", "Earn more / add UPI")

    y -= 15 + gap + bh / 2
    _arrow(c, left, y + bh / 2 + gap + 1, left, y + bh / 2, TEAL, "Yes", "right")
    _round_box(
        c, left, y, bw, bh, PALE_TEAL, TEAL,
        "Request withdrawal",
        "process-withdrawal  ·  hold balance  ·  status = pending",
    )
    y -= bh / 2 + gap + bh / 2
    _arrow(c, left, y + bh / 2 + gap, left, y + bh / 2)
    _round_box(
        c, left, y, bw, bh, PALE, NAVY,
        "Admin payout queue",
        "Copy UPI  ·  copy amount  ·  optional Mark processing",
    )
    y -= bh / 2 + gap + bh / 2
    _arrow(c, left, y + bh / 2 + gap, left, y + bh / 2)
    _round_box(
        c, left, y, bw, bh, PALE_GOLD, GOLD,
        "Pay outside the product",
        "Company GPay / PhonePe / IMPS / NEFT  →  mentor UPI or bank",
    )
    y -= bh / 2 + gap + 15
    _arrow(c, left, y + 15 + gap - 2, left, y + 14)
    _diamond(c, left, y, 54 * mm, 26 * mm, "Bank / UPI\ntransfer OK?")

    # Yes down
    y_yes = y - 15 - gap - 16
    _arrow(c, left, y - 14, left, y_yes + 16 / 2, GREEN, "Yes", "right")
    _doc(c, left, y_yes, 78 * mm, 16 * mm, "Record proof in admin", "UTR / UPI ref  ·  method  ·  paid_at  ·  operator")
    y_done = y_yes - 16 / 2 - gap - 11 / 2
    _arrow(c, left, y_yes - 8, left, y_done + 11 / 2)
    _round_box(
        c, left, y_done, bw, 13 * mm, PALE_GREEN, GREEN,
        "admin_complete_withdrawal",
        "status = completed  ·  total_withdrawn += amount  ·  FCM sent",
    )
    y_end = y_done - 13 * mm / 2 - gap - 9 / 2
    _arrow(c, left, y_done - 6.5, left, y_end + 4.5)
    _terminator(c, left, y_end, 62 * mm, 9 * mm, "END  ·  Mentor paid", GREEN)

    # No to the right
    _arrow(c, left + 27 * mm, y, right - 36 * mm, y, RED, "No", "top")
    _round_box(
        c, right, y, 56 * mm, 16 * mm, PALE_RED, RED,
        "Reject request",
        "reason required",
    )
    y_rej = y - 16 / 2 - gap - 13 / 2
    _arrow(c, right, y - 8, right, y_rej + 6.5, RED)
    _round_box(
        c, right, y_rej, 56 * mm, 14 * mm, PALE_RED, RED,
        "Restore wallet",
        "balance += amount",
    )
    y_nend = y_rej - 14 / 2 - gap - 9 / 2
    _arrow(c, right, y_rej - 7, right, y_nend + 4.5, RED)
    _terminator(c, right, y_nend, 52 * mm, 9 * mm, "END  ·  Not paid", RED)
    _fill_text(
        c, right, y_nend - 12, "Mentor can fix UPI and request again",
        FONT, 6.2, MUTED, 56 * mm, 8,
    )

    _legend(
        c,
        [
            (PALE_TEAL, TEAL, "App / web / RPC"),
            (PALE, NAVY, "Admin panel"),
            (PALE_GOLD, GOLD, "Human bank transfer"),
            (PALE_GREEN, GREEN, "Paid"),
            (PALE_RED, RED, "Rejected"),
        ],
        6 * mm,
        2.5 * mm,
    )


def paint_status(c, w, h):
    """Figure 3 — withdrawal status state machine."""
    ys = h * 0.58
    boxes = [
        (22 * mm, "pending", PALE_AMBER, AMBER, "Mentor request\nwallet held"),
        (66 * mm, "processing", PALE, NAVY, "Admin lock\noptional"),
        (110 * mm, "completed", PALE_GREEN, GREEN, "UTR stored\ntotal_withdrawn+"),
        (154 * mm, "rejected", PALE_RED, RED, "Wallet restored\nnew request OK"),
    ]
    _fill_text(c, w / 2, h - 6 * mm, "Withdrawal request statuses", FONT_B, 9, NAVY, w, 12)

    for x, title, fill, stroke, sub in boxes:
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(1.2)
        c.roundRect(x - 18 * mm, ys - 14 * mm, 36 * mm, 28 * mm, 6, fill=1, stroke=1)
        _fill_text(c, x, ys + 6, title.upper(), FONT_B, 7.4, stroke, 34 * mm, 9)
        _fill_text(c, x, ys - 6, sub, FONT, 6.2, MUTED, 32 * mm, 8)

    _arrow(c, 22 * mm + 18 * mm, ys, 66 * mm - 18 * mm, ys, TEAL)
    _arrow(c, 66 * mm + 18 * mm, ys + 6, 110 * mm - 18 * mm, ys + 6, GREEN)
    _arrow(c, 66 * mm + 18 * mm, ys - 6, 154 * mm - 18 * mm, ys - 6, RED)

    # pending → completed / rejected (skip processing)
    c.setStrokeColor(GREEN)
    c.setDash(3, 2)
    c.setLineWidth(1)
    c.line(40 * mm, ys + 16 * mm, 110 * mm, ys + 22 * mm)
    c.setDash()
    _arrow(c, 110 * mm, ys + 22 * mm, 110 * mm, ys + 14 * mm, GREEN)

    c.setStrokeColor(RED)
    c.setDash(3, 2)
    c.line(40 * mm, ys - 16 * mm, 154 * mm, ys - 24 * mm)
    c.setDash()
    _arrow(c, 154 * mm, ys - 24 * mm, 154 * mm, ys - 14 * mm, RED)

    # labels
    c.setFillColor(MUTED)
    c.setFont(FONT, 6.4)
    c.drawCentredString(w / 2, h - 18 * mm, "Solid = usual path    Dashed = skip optional processing lock")
    c.setFillColor(TEAL)
    c.setFont(FONT_B, 6.5)
    c.drawCentredString(44 * mm, ys + 10, "Mark processing")
    c.setFillColor(GREEN)
    c.drawString(84 * mm, ys + 9, "Complete + UTR")
    c.setFillColor(RED)
    c.drawString(96 * mm, ys - 12, "Reject + reason")

    # notes
    notes = [
        ("pending", "Created by process-withdrawal. Balance already deducted (hold)."),
        ("processing", "Operator claimed the row. No second wallet change."),
        ("completed", "Terminal. total_withdrawn increases here, not at request time."),
        ("rejected", "Terminal. Balance returned. Mentor may submit a new request."),
    ]
    yy = 28 * mm
    for title, text in reversed(notes):
        c.setFillColor(NAVY)
        c.setFont(FONT_B, 7)
        c.drawString(8 * mm, yy + 8, title)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7)
        c.drawString(32 * mm, yy + 8, text)
        yy += 11 * mm


def paint_swimlane(c, w, h):
    """Figure 4 — who does what, left to right swimlanes."""
    lanes = [
        ("Learner", PALE_GOLD),
        ("Mentor\n(app / web)", PALE_TEAL),
        ("Supabase\nbackend", PALE),
        ("Admin panel", colors.HexColor("#E8EEF5")),
        ("Company bank\n/ UPI app", PALE_GOLD),
    ]
    pad_top = 16 * mm
    pad_bot = 8 * mm
    lane_h = (h - pad_top - pad_bot) / len(lanes)
    labels_w = 28 * mm

    c.setFillColor(NAVY)
    c.setFont(FONT_B, 8)
    c.drawString(0, h - 10 * mm, "Swimlane  ·  one booking through to mentor payout")

    for i, (name, bg) in enumerate(lanes):
        yb = h - pad_top - (i + 1) * lane_h
        c.setFillColor(bg)
        c.rect(0, yb, w, lane_h, fill=1, stroke=0)
        c.setStrokeColor(RULE)
        c.setLineWidth(0.5)
        c.line(0, yb, w, yb)
        c.setFillColor(NAVY)
        lines = name.split("\n")
        c.setFont(FONT_B, 7)
        for li, ln in enumerate(lines):
            c.drawString(3 * mm, yb + lane_h / 2 + (len(lines) - 1) * 4 - li * 9 - 2, ln)

    c.setStrokeColor(TEAL)
    c.setLineWidth(1.2)
    c.line(labels_w, pad_bot, labels_w, h - pad_top)

    def lane_y(idx):
        return h - pad_top - idx * lane_h - lane_h / 2

    def box(lane, x, title, sub, fill, stroke, bw=32 * mm, bh=11.5 * mm):
        _round_box(c, x, lane_y(lane), bw, bh, fill, stroke, title, sub, radius=4)
        return x, lane_y(lane)

    # Flow x positions
    x1, x2, x3, x4, x5, x6, x7 = [labels_w + d * mm for d in (22, 48, 74, 100, 118, 138, 156)]

    p1 = box(0, x1, "Pays session", "Razorpay", PALE_GOLD, GOLD, 30 * mm)
    p2 = box(2, x1, "Verify + book", "pending earning", PALE_TEAL, TEAL, 32 * mm)
    _arrow(c, p1[0], p1[1] - 6, p2[0], p2[1] + 6)

    p3 = box(1, x2, "Runs session", "mark completed", PALE_TEAL, TEAL, 30 * mm)
    _arrow(c, x1 + 16 * mm, lane_y(2), x2, lane_y(1) - 6)

    p4 = box(2, x2, "Credit wallet", "RPC", PALE_GREEN, GREEN, 30 * mm)
    _arrow(c, p3[0], p3[1] - 6, p4[0], p4[1] + 6)

    p5 = box(1, x3, "Save UPI", "payout setup", PALE_TEAL, TEAL, 30 * mm)
    p6 = box(1, x4, "Request payout", "min ₹5,000", PALE_TEAL, TEAL, 30 * mm)
    _arrow(c, p5[0] + 15 * mm, p5[1], p6[0] - 15 * mm, p6[1])

    p7 = box(2, x4, "Hold wallet", "insert pending", PALE, NAVY, 30 * mm)
    _arrow(c, p6[0], p6[1] - 6, p7[0], p7[1] + 6)

    p8 = box(3, x5, "Open queue", "copy UPI ₹", colors.HexColor("#E8EEF5"), NAVY, 28 * mm)
    _arrow(c, p7[0] + 15, p7[1], p8[0] - 12, p8[1])

    p9 = box(4, x6, "Send money", "GPay / NEFT", PALE_GOLD, GOLD, 28 * mm)
    _arrow(c, p8[0], p8[1] - 6, p9[0], p9[1] + 6)

    p10 = box(3, x7, "UTR + complete", "or reject", PALE_GREEN, GREEN, 28 * mm)
    _arrow(c, p9[0] + 10, p9[1] + 6, p10[0], p10[1] - 6)

    p11 = box(1, x7, "FCM + history", "wallet updated", PALE_GREEN, GREEN, 28 * mm)
    _arrow(c, p10[0], p10[1] + 6, p11[0], p11[1] - 6)

    c.setFillColor(MUTED)
    c.setFont(FONT, 6.2)
    c.drawString(labels_w + 4, 3 * mm, "Read top to bottom (who), left to right (when). Razorpay is only in the Learner lane.")


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def bullets(items: list[str], bullet="•"):
    flow = []
    for item in items:
        flow.append(
            ListItem(P(item, "li"), leftIndent=12, bulletColor=TEAL, value=bullet)
        )
    return ListFlowable(
        flow,
        bulletType="bullet",
        start=bullet,
        leftIndent=16,
        bulletFontName=FONT,
        bulletFontSize=9,
        spaceBefore=1,
        spaceAfter=8,
    )


def numbered(items: list[str]):
    flow = []
    for item in items:
        flow.append(ListItem(P(item, "li"), leftIndent=14))
    return ListFlowable(
        flow,
        bulletType="1",
        leftIndent=18,
        bulletFontName=FONT_B,
        bulletFontSize=9,
        spaceBefore=1,
        spaceAfter=8,
    )


def hr():
    t = Table([[""]], colWidths=[170 * mm], rowHeights=[2])
    t.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 1.2, TEAL)]))
    return t


def callout(title: str, body: str, tone: str = "info"):
    bg = {"info": PALE_TEAL, "warn": PALE_AMBER, "danger": PALE_RED, "ok": PALE_GREEN}[tone]
    bar = {"info": TEAL, "warn": AMBER, "danger": RED, "ok": GREEN}[tone]
    inner = Table(
        [[P(title, "callout_title")], [P(body, "callout_body")]],
        colWidths=[158 * mm],
    )
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (0, 0), 8),
                ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    wrap = Table([[inner]], colWidths=[170 * mm])
    wrap.setStyle(
        TableStyle(
            [
                ("LINEBEFORE", (0, 0), (0, 0), 4, bar),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return wrap


def section_banner(number: str, title: str):
    left = Table(
        [[P(f"{number}", "step_no")]],
        colWidths=[12 * mm],
        rowHeights=[12 * mm],
    )
    left.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), TEAL),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    right = P(title, "h1")
    row = Table([[left, right]], colWidths=[14 * mm, 156 * mm])
    row.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (1, 0), (1, 0), 0.6, RULE),
            ]
        )
    )
    return row


def styled_table(headers: list[str], rows: list[list[str]], col_widths):
    head = [P(h, "th") for h in headers]
    body = []
    for r in rows:
        body.append([P(c, "cell") if not isinstance(c, Paragraph) else c for c in r])
    data = [head] + body
    t = Table(data, colWidths=col_widths, repeatRows=1)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_B),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.3, RULE),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            cmds.append(("BACKGROUND", (0, i), (-1, i), PALE))
        else:
            cmds.append(("BACKGROUND", (0, i), (-1, i), WHITE))
    t.setStyle(TableStyle(cmds))
    return t


def kv_table(pairs: list[tuple[str, str]]):
    data = []
    for k, v in pairs:
        data.append([P(k, "cell_b"), P(v, "cell")])
    t = Table(data, colWidths=[42 * mm, 128 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), PALE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("BOX", (0, 0), (-1, -1), 0.4, RULE),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, RULE),
            ]
        )
    )
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, A4[1] - 14 * mm, A4[0], 14 * mm, fill=1, stroke=0)
        canvas.setFillColor(TEAL)
        canvas.rect(0, A4[1] - 14 * mm, 6, 14 * mm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont(FONT, 8)
        canvas.drawString(18 * mm, A4[1] - 9 * mm, "Connectiqo  ·  Manual Mentor Payout Architecture")
        canvas.setFont(FONT, 8)
        canvas.drawRightString(A4[0] - 16 * mm, A4[1] - 9 * mm, "Internal  ·  21 August 2026")
        canvas.setFillColor(PALE)
        canvas.rect(0, 0, A4[0], 12 * mm, fill=1, stroke=0)
        canvas.setFillColor(TEAL)
        canvas.rect(0, 12 * mm, A4[0], 0.6, fill=1, stroke=0)
        canvas.setFillColor(MUTED)
        canvas.setFont(FONT, 8)
        canvas.drawString(18 * mm, 5 * mm, "Confidential — engineering & operations")
        canvas.drawRightString(A4[0] - 16 * mm, 5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def cover_page(story):
    banner = Table([[""]], colWidths=[170 * mm], rowHeights=[8 * mm])
    banner.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), TEAL)]))
    story.append(Spacer(1, 8 * mm))
    story.append(banner)
    story.append(Spacer(1, 14 * mm))
    story.append(P("ARCHITECTURE &amp; OPERATIONS REPORT", "cover_kicker"))
    story.append(P("Manual Mentor Payout<br/>without Razorpay Payout", "cover_title"))
    story.append(hr())
    story.append(Spacer(1, 4 * mm))
    story.append(
        P(
            "A complete design for settling mentor earnings from the admin panel "
            "using company UPI / IMPS / NEFT — covering the mobile app, web portal, "
            "and admin panel. Razorpay remains the learner collection rail only.",
            "cover_sub",
        )
    )
    story.append(Spacer(1, 10 * mm))
    story.append(
        kv_table(
            [
                ("Document type", "Architecture, operations flow, and implementation plan"),
                ("Date", "21 August 2026"),
                ("Audience", "Product, engineering, finance / operations"),
                ("Classification", "Internal"),
                ("Mobile app", "connectfront  —  React Native (Android / iOS)"),
                ("Web portal", "connectiqo_web-portal  —  Next.js"),
                ("Admin panel", "adminsideconnectfornt/admin  —  Vite + React"),
                ("Backend", "Supabase (Postgres, RLS, Edge Functions)"),
                ("Inbound payments", "Razorpay Checkout  —  keep as-is"),
                ("Outbound payouts", "Manual settlement  —  recommended"),
                ("Minimum withdrawal", "₹5,000  (already enforced in app and web)"),
            ]
        )
    )
    story.append(Spacer(1, 14 * mm))
    story.append(
        callout(
            "Decision in one sentence",
            "Do not wire RazorpayX or Razorpay Route for mentor settlement. "
            "Treat the mentor wallet as an internal ledger, let mentors request a "
            "withdrawal against a saved UPI ID, and have an operator pay from the "
            "company account and record the UTR in admin. The request path already "
            "exists in TEST MODE; what is missing is a safe admin fulfilment workflow.",
            "ok",
        )
    )
    story.append(PageBreak())


def toc(story):
    story.append(section_banner("00", "Contents"))
    items = [
        "1.  Executive summary",
        "2.  Objective and non-goals",
        "3.  Systems in scope",
        "4.  How money moves today",
        "5.  Code and data map",
        "6.  Findings and risks",
        "7.  Options considered",
        "8.  Recommended architecture",
        "9.  End-to-end operating flow (flowcharts)",
        "10. Withdrawal status machine",
        "11. Data model and RPCs",
        "12. Admin panel specification",
        "13. Mobile app changes",
        "14. Web portal changes",
        "15. Notifications and mentor experience",
        "16. Security, audit, and India compliance",
        "17. Implementation phases",
        "18. Test plan",
        "19. What not to do",
        "20. Appendix — current schema and file index",
    ]
    for item in items:
        story.append(P(item, "toc"))
    story.append(Spacer(1, 8 * mm))
    story.append(
        callout(
            "How to read this document",
            "Sections 1–6 describe the current product. Sections 7–10 recommend the "
            "operating model. Sections 11–15 are the build spec. Sections 16–18 are "
            "rollout, risk, and QA. Implementers can start at section 11; operators "
            "can start at section 9.",
            "info",
        )
    )
    story.append(PageBreak())


def section_1(story):
    story.append(section_banner("01", "Executive summary"))
    story.append(
        P(
            "Connectiqo already collects learner payments through Razorpay and credits "
            "an internal mentor wallet after a session is marked completed. Mentors can "
            "request a withdrawal from the mobile Wallet screen and the web Earnings page. "
            "That request does <b>not</b> send money through Razorpay today. The edge "
            "function <font face='Courier'>process-withdrawal</font> is explicitly in "
            "<b>TEST MODE</b>: it deducts the wallet and inserts a row into "
            "<font face='Courier'>withdrawal_requests</font> with status "
            "<font face='Courier'>pending</font>, returning an ID of the form "
            "<font face='Courier'>manual_{id}</font>."
        )
    )
    story.append(
        P(
            "The intended live path in comments is RazorpayX (Razorpay Payouts). That is "
            "exactly what this programme should <b>not</b> enable. RazorpayX requires a "
            "funded RazorpayX current account, contact/fund-account KYC, webhook "
            "reconciliation, and extra commercial terms. The product already has the "
            "pieces of a simpler model: UPI on the mentor profile, a request queue, and "
            "an admin Payments screen."
        )
    )
    story.append(
        P(
            "The gap is operational, not conceptual. Admin can open "
            "<font face='Courier'>withdrawal_requests</font> as generic CRUD. There is no "
            "dedicated payout queue, no Copy-UPI / Copy-amount action, no UTR field, no "
            "atomic complete/reject that restores the wallet, and no push to the mentor "
            "when money is sent. Worse, a reject performed by editing the row in CRUD "
            "would leave the deducted balance unrestored."
        )
    )
    story.append(P("The recommended operating model is:", "body_left"))
    story.append(
        numbered(
            [
                "Keep Razorpay Checkout for learners (booking and video unlocks).",
                "Stop treating Razorpay Route linked-account KYC as a prerequisite for withdrawals.",
                "Let mentors save a UPI ID (and optionally a bank account) as payout details.",
                "On withdraw, hold funds on the internal wallet and create a pending request.",
                "An admin operator pays from the company bank / UPI app (GPay, PhonePe, IMPS, NEFT).",
                "Admin records method + UTR / UPI reference and marks the request completed.",
                "On reject, restore the wallet atomically and notify the mentor.",
            ]
        )
    )
    story.append(
        styled_table(
            ["Dimension", "Today", "Target"],
            [
                [
                    "Learner collection",
                    "Razorpay order + verify",
                    "Unchanged",
                ],
                [
                    "Mentor earning credit",
                    "complete_session_payment RPC after session complete",
                    "Unchanged (internal ledger)",
                ],
                [
                    "Instant split to mentor",
                    "Optional Razorpay Route transfer",
                    "Disable / leave unused",
                ],
                [
                    "Payout setup",
                    "Razorpay Route linked account + KYC email",
                    "Save UPI (optional bank) only",
                ],
                [
                    "Withdrawal request",
                    "process-withdrawal TEST MODE",
                    "Keep request; never call RazorpayX",
                ],
                [
                    "Fulfilment",
                    "Generic CRUD on withdrawal_requests",
                    "Dedicated Admin Payout Control Panel",
                ],
                [
                    "Proof of payment",
                    "razorpay_payout_id unused",
                    "UTR / UPI ref + method + paid_at + operator",
                ],
            ],
            [38 * mm, 66 * mm, 66 * mm],
        )
    )
    story.append(P("Table 1 — Current vs target settlement model.", "caption"))


def section_2(story):
    story.append(section_banner("02", "Objective and non-goals"))
    story.append(P("Objective", "h2"))
    story.append(
        P(
            "Enable Connectiqo operations to pay mentors from the admin panel, for both "
            "the mobile app and the web portal, without using Razorpay Payout (RazorpayX) "
            "or Razorpay Route transfers as the settlement rail."
        )
    )
    story.append(P("In scope", "h2"))
    story.append(
        bullets(
            [
                "Mentor payout identity (UPI, optional bank).",
                "Withdrawal request lifecycle (pending → processing → completed | rejected).",
                "Admin fulfilment UI with proof-of-payment fields.",
                "Wallet hold / restore so a reject cannot strand funds.",
                "Parity of status display on mobile Wallet and web Earnings.",
                "Push / in-app notification when a payout is sent or rejected.",
                "Audit trail (who paid, when, UTR, notes).",
            ]
        )
    )
    story.append(P("Out of scope (intentionally unchanged)", "h2"))
    story.append(
        bullets(
            [
                "Learner checkout on Razorpay (create-razorpay-order, verify-razorpay-payment).",
                "Play Billing / Apple IAP for in-app video unlocks.",
                "Platform fee and GST calculation on the booking.",
                "Changing the ₹5,000 minimum unless product later revises it.",
                "Automated bank-file / NACH bulk payout (a later phase if volume grows).",
                "TDS computation engine (record a note/field; do not auto-deduct in v1 unless finance requires it).",
            ]
        )
    )
    story.append(
        callout(
            "Important distinction",
            "Razorpay stays. Only the <b>outbound</b> mentor settlement is taken off Razorpay. "
            "Learners still pay Connectiqo; Connectiqo then settles mentors from its own "
            "bank / UPI, the same way many early marketplaces run until payout volume justifies a PSP.",
            "warn",
        )
    )


def section_3(story):
    story.append(section_banner("03", "Systems in scope"))
    story.append(
        styled_table(
            ["Surface", "Path", "Role in payout"],
            [
                [
                    "Mobile app",
                    "C:\\Flutter\\Freelancing\\Project\\connectfront",
                    "Mentor saves UPI, views wallet, requests withdrawal, sees request status.",
                ],
                [
                    "Web portal",
                    "D:\\connectiqo\\connectiqo web\\connectiqo web\\connectiqo_web-portal",
                    "Same mentor flows as the app, already lists withdrawal history.",
                ],
                [
                    "Admin panel",
                    "C:\\Flutter\\Freelancing\\Project\\admin\\adminsideconnectfornt\\admin",
                    "Operator queue: pay outside the product, then mark paid / reject with UTR.",
                ],
                [
                    "Supabase",
                    "connectfront/supabase (shared backend)",
                    "Tables, RPCs, Edge Functions. App and web already call the same functions.",
                ],
            ],
            [32 * mm, 68 * mm, 70 * mm],
        )
    )
    story.append(P("Table 2 — Surfaces. One backend; three clients.", "caption"))
    story.append(
        P(
            "Because mobile and web already invoke the same Edge Functions "
            "(<font face='Courier'>process-withdrawal</font>, "
            "<font face='Courier'>create-linked-account</font>, "
            "<font face='Courier'>get-account-status</font>), a backend-first change "
            "automatically serves both platforms. Admin is a separate Vite app that "
            "talks to the same Postgres with a service-role key."
        )
    )


def section_4(story):
    story.append(section_banner("04", "How money moves today"))
    story.append(P("4.1 Learner pays (keep)", "h2"))
    story.append(
        numbered(
            [
                "Learner selects slot(s) and pays. App/web call create-razorpay-order.",
                "Razorpay Checkout collects amount_total_paise (mentor cut + platform fee + GST).",
                "verify-razorpay-payment verifies the signature and calls claim_and_book_slots.",
                "That RPC books the slot(s), creates the booking, and inserts earnings with status pending.",
            ]
        )
    )
    story.append(P("4.2 Session completes — wallet credit (keep)", "h2"))
    story.append(
        P(
            "When a booking is marked <font face='Courier'>completed</font>, "
            "<font face='Courier'>bookingApi</font> runs "
            "<font face='Courier'>complete_session_payment</font>. That RPC flips the "
            "earnings row from pending → completed and upserts "
            "<font face='Courier'>mentor_wallets</font>: "
            "<font face='Courier'>balance</font> and <font face='Courier'>total_earned</font> "
            "increase by the mentor cut. This is the internal ledger. It is independent of "
            "whether rupees have left the company bank account."
        )
    )
    story.append(P("4.3 Optional Razorpay Route split (disable for this programme)", "h2"))
    story.append(
        P(
            "Immediately after the RPC, the client fire-and-forgets "
            "<font face='Courier'>transfer-session-payout</font>. If the mentor has an "
            "activated Razorpay Route linked account and the transaction was "
            "<font face='Courier'>route_enabled</font>, Razorpay splits the mentor cut from "
            "the captured payment. If not, the function no-ops with "
            "<font face='Courier'>not_route_enabled</font> or "
            "<font face='Courier'>account_not_active</font>. The code comment already says "
            "earnings then “stay in the internal wallet ledger for manual withdrawal.” "
            "That is the path we should standardise on."
        )
    )
    story.append(P("4.4 Mentor payout setup (too heavy for manual settlement)", "h2"))
    story.append(
        P(
            "PayoutSetupScreen (app) and /settings/payout (web) call "
            "<font face='Courier'>create-linked-account</font>, which creates a Razorpay "
            "Route v2 account, emails the mentor for KYC, and stores "
            "<font face='Courier'>razorpay_account_id</font>. "
            "<font face='Courier'>get-account-status</font> polls Razorpay and maps "
            "activated → <font face='Courier'>active</font>. The Wallet screen treats "
            "<font face='Courier'>payoutReady</font> as KYC <b>active</b>, while the actual "
            "Withdraw button only requires a stored UPI and ₹5,000 balance. Those two "
            "signals disagree."
        )
    )
    story.append(P("4.5 Withdrawal request (already manual)", "h2"))
    story.append(
        P(
            "<font face='Courier'>process-withdrawal</font> verifies the JWT, requires "
            "<font face='Courier'>mentor_profiles.upi_id</font>, calls "
            "<font face='Courier'>deduct_wallet_for_withdrawal</font>, and inserts "
            "<font face='Courier'>withdrawal_requests</font> with status pending. "
            "It returns <font face='Courier'>payoutId: manual_{withdrawal.id}</font>. "
            "The file header says: “TEST MODE: Records withdrawal request in DB only. "
            "When going live, integrate RazorpayX payout block.” Going live should mean "
            "admin fulfilment — not RazorpayX."
        )
    )
    story.append(P("4.6 Admin today (unsafe for money movement)", "h2"))
    story.append(
        P(
            "PaymentsPage tabs: Transactions, Mentor Wallets, Earnings, Withdrawals. "
            "Withdrawals is generic ResourceCrudPage on "
            "<font face='Courier'>withdrawal_requests</font>. Operators can JSON-edit "
            "status and admin_note. The status filter options are "
            "<font face='Courier'>all / pending / approved / rejected</font>, but the "
            "database CHECK is "
            "<font face='Courier'>pending | processing | completed | rejected</font>. "
            "There is no “approved” value. TransactionControlPanel is a better pattern "
            "(dedicated status + note editor) but exists only for learner transactions, "
            "not payouts."
        )
    )


def section_5(story):
    story.append(section_banner("05", "Code and data map"))
    story.append(P("5.1 Primary tables", "h2"))
    story.append(
        styled_table(
            ["Table", "Purpose", "Payout-relevant columns"],
            [
                [
                    "transactions",
                    "Learner payment lifecycle",
                    "amount_total_paise, mentor_earning_paise, platform_fee_paise, status, razorpay_*",
                ],
                [
                    "earnings",
                    "Mentor cut per session / video",
                    "amount, status (pending|completed), source, route_transfer_id",
                ],
                [
                    "mentor_wallets",
                    "Internal available balance",
                    "balance, total_earned, total_withdrawn",
                ],
                [
                    "withdrawal_requests",
                    "Payout queue",
                    "amount, upi_id, status, admin_note, razorpay_payout_id",
                ],
                [
                    "mentor_profiles",
                    "Payout identity + Route leftovers",
                    "upi_id, razorpay_account_id, razorpay_contact_id, razorpay_fund_account_id, kyc_status",
                ],
            ],
            [38 * mm, 48 * mm, 84 * mm],
        )
    )
    story.append(P("Table 3 — Ledger tables. Source: supabase/migrations.", "caption"))
    story.append(P("5.2 Key files", "h2"))
    story.append(
        styled_table(
            ["Layer", "File", "Notes"],
            [
                [
                    "App",
                    "src/scenes/settings/WalletScreen.js",
                    "MIN_WITHDRAWAL = 5000; canWithdraw = balance + UPI; payoutReady = Razorpay KYC active.",
                ],
                [
                    "App",
                    "src/scenes/settings/PayoutSetupScreen.js",
                    "Creates Razorpay Route linked account; copy still says “1–2 business days”.",
                ],
                [
                    "App",
                    "src/api/paymentApi.js",
                    "requestWithdrawal → process-withdrawal. Comment still says RazorpayX.",
                ],
                [
                    "Web",
                    "src/app/(main)/settings/wallet/page.tsx",
                    "Same min and UPI gate; already lists withdrawal_requests.",
                ],
                [
                    "Web",
                    "src/app/(main)/settings/payout/page.tsx",
                    "Same linked-account form as the app.",
                ],
                [
                    "Admin",
                    "src/features/payments/PaymentsPage.jsx",
                    "KPI cards + CRUD tabs. Filter mismatch on withdrawals.",
                ],
                [
                    "Edge",
                    "supabase/functions/process-withdrawal/index.ts",
                    "Manual request writer. TEST MODE. No RazorpayX call.",
                ],
                [
                    "Edge",
                    "supabase/functions/create-linked-account/index.ts",
                    "Razorpay Route account create. Not needed for manual payout.",
                ],
                [
                    "Edge",
                    "supabase/functions/get-account-status/index.ts",
                    "Polls Razorpay KYC. Blocks “payout ready” UX.",
                ],
                [
                    "Edge",
                    "supabase/functions/transfer-session-payout/index.ts",
                    "Route split after session. Should no-op permanently for this programme.",
                ],
            ],
            [22 * mm, 62 * mm, 86 * mm],
        )
    )
    story.append(P("Table 4 — Implementation touchpoints.", "caption"))
    story.append(P("5.3 Missing migration (critical)", "h2"))
    story.append(
        callout(
            "deduct_wallet_for_withdrawal is called but not in the repo migrations",
            "process-withdrawal invokes RPC deduct_wallet_for_withdrawal. No CREATE FUNCTION "
            "for it exists under supabase/migrations (increment_mentor_wallet and "
            "complete_session_payment do). If it was applied only in the SQL editor, it is "
            "undocumented and may not increment total_withdrawn consistently, or may not "
            "exist on a fresh environment. Phase 0 must add this RPC to versioned SQL "
            "before any admin fulfilment is built on top of it.",
            "danger",
        )
    )


def section_6(story):
    story.append(section_banner("06", "Findings and risks"))
    story.append(
        styled_table(
            ["ID", "Severity", "Finding", "Impact if ignored"],
            [
                [
                    "F1",
                    "Critical",
                    "Admin CRUD can set status=rejected without restoring wallet.",
                    "Mentor loses deducted funds with no bank credit.",
                ],
                [
                    "F2",
                    "Critical",
                    "Admin CRUD can set status=completed with no UTR and no operator identity.",
                    "Unauditable “we paid you” claims; disputes unresolvable.",
                ],
                [
                    "F3",
                    "Critical",
                    "deduct_wallet_for_withdrawal not in versioned migrations.",
                    "Staging/prod drift; withdrawals fail or double-count.",
                ],
                [
                    "F4",
                    "High",
                    "Wallet deducted at request time; total_withdrawn timing unspecified.",
                    "If deducted AND counted as withdrawn while still pending, reports lie.",
                ],
                [
                    "F5",
                    "High",
                    "payoutReady requires Razorpay KYC active; withdraw only needs UPI.",
                    "Mentors blocked or confused by “Complete payout setup” while UPI exists.",
                ],
                [
                    "F6",
                    "High",
                    "Admin filter uses status “approved”; DB has no such value.",
                    "Operators cannot filter the real queue.",
                ],
                [
                    "F7",
                    "Medium",
                    "Mobile Wallet does not list withdrawal_requests (web does).",
                    "Mentor cannot see pending/processing/rejected on the app.",
                ],
                [
                    "F8",
                    "Medium",
                    "No FCM / in-app event when payout is sent or rejected.",
                    "Support load: “where is my money?”",
                ],
                [
                    "F9",
                    "Medium",
                    "create-linked-account still required mentally for “setup”.",
                    "Unnecessary Razorpay KYC emails; Route account sprawl.",
                ],
                [
                    "F10",
                    "Medium",
                    "Admin login is localStorage email/password; mutations use service role in the browser.",
                    "Existing risk; payouts raise the cost of a leaked admin session.",
                ],
                [
                    "F11",
                    "Low",
                    "transfer-session-payout still invoked after every completed session.",
                    "Needless Razorpay API calls; confusing route_transfer_id on some mentors.",
                ],
                [
                    "F12",
                    "Low",
                    "paymentApi comments still say “Trigger a RazorpayX UPI payout”.",
                    "Next engineer re-enables RazorpayX thinking it is unfinished work.",
                ],
            ],
            [14 * mm, 20 * mm, 68 * mm, 68 * mm],
        )
    )
    story.append(P("Table 5 — Findings from code review of app, web, admin, and Edge Functions.", "caption"))
    story.append(
        P(
            "F1 is the reason generic CRUD must not remain the fulfilment tool. "
            "A status change is a financial event. It has to run inside a single "
            "Postgres function that either completes (records proof, bumps "
            "<font face='Courier'>total_withdrawn</font> if not already counted) or "
            "rejects (restores <font face='Courier'>balance</font>)."
        )
    )


def section_7(story):
    story.append(section_banner("07", "Options considered"))
    story.append(
        styled_table(
            ["Option", "What it is", "Verdict"],
            [
                [
                    "A. RazorpayX Payouts API",
                    "Automated UPI/IMPS from a RazorpayX account when mentor requests withdraw.",
                    "Rejected — this is the rail we are avoiding (KYC, float, webhooks, extra contract).",
                ],
                [
                    "B. Razorpay Route instant split",
                    "On session complete, transfer mentor cut from the captured payment.",
                    "Rejected as primary — requires linked-account KYC; already optional and flaky for launch.",
                ],
                [
                    "C. Other PSP (Cashfree / Paytm payouts)",
                    "Swap RazorpayX for another payout API.",
                    "Rejected for v1 — still a vendor onboarding; does not match “manual from admin”.",
                ],
                [
                    "D. Manual UPI / IMPS / NEFT from company account",
                    "Operator pays in GPay/PhonePe/net-banking; records UTR in admin.",
                    "Selected — matches current TEST MODE, low vendor lock-in, auditable, works at current volume.",
                ],
                [
                    "E. Bulk NEFT file (later)",
                    "Export pending rows as a bank upload file at end of day.",
                    "Phase 3 if daily payout count becomes painful. Same data model.",
                ],
            ],
            [42 * mm, 72 * mm, 56 * mm],
        )
    )
    story.append(P("Table 6 — Alternatives. Option D is the v1 standard.", "caption"))
    story.append(
        P(
            "Option D is not a workaround. It is a legitimate marketplace settlement "
            "model: the platform is the merchant of record for the learner, holds "
            "the fee, and pays the professional as a payable. The product’s job is "
            "ledger accuracy and operator speed (copy UPI, copy amount, paste UTR), "
            "not becoming a bank."
        )
    )


def section_8(story):
    story.append(section_banner("08", "Recommended architecture"))
    story.append(P("8.1 Principle", "h2"))
    story.append(
        P(
            "Separate <b>collection</b> from <b>settlement</b>. Razorpay is the collection "
            "rail. The mentor wallet is a ledger of what Connectiqo owes. A withdrawal "
            "request is an accounts-payable ticket. Completing that ticket is an operator "
            "action plus a bank proof, not an API call to Razorpay."
        )
    )
    story.append(P("8.2 Ledger rules", "h2"))
    story.append(
        bullets(
            [
                "Available balance increases only when a session/video earning is completed (existing RPC).",
                "A withdrawal request immediately <b>holds</b> (decrements) balance so the mentor cannot spend it twice.",
                "total_withdrawn increases only when admin marks the request <b>completed</b>.",
                "Reject restores balance and never increases total_withdrawn.",
                "Completed and rejected are terminal. No silent re-open from the UI.",
                "Idempotent: completing an already-completed row is a no-op; never deduct twice.",
            ]
        )
    )
    story.append(P("8.3 Payout identity", "h2"))
    story.append(
        P(
            "Replace “Create Razorpay payout account” with “Save payout details”. "
            "Required: UPI ID (validated format: name@handle). Optional: account holder "
            "name, bank account number, IFSC (for NEFT when UPI fails or amount is large). "
            "Do not call Razorpay. Store on <font face='Courier'>mentor_profiles</font>. "
            "Treat presence of a valid UPI as payout-ready."
        )
    )
    story.append(P("8.4 Shared backend, three UIs", "h2"))
    story.append(
        P(
            "App and web remain thin clients of the same Edge Functions. Admin does not "
            "update wallet rows by hand. It only calls two RPCs (or one admin Edge Function "
            "that wraps them): <font face='Courier'>admin_complete_withdrawal</font> and "
            "<font face='Courier'>admin_reject_withdrawal</font>. ResourceCrudPage remains "
            "for read-only inspection if needed, but status must be read-only there."
        )
    )
    story.append(P("8.5 Operator path (human in the loop)", "h2"))
    story.append(
        numbered(
            [
                "Open Admin → Payments → Payout queue (pending first).",
                "Open a request: mentor name, phone, UPI, amount, wallet snapshot.",
                "Click Copy UPI and Copy amount; pay from company UPI / net-banking.",
                "Paste UTR / UPI reference; choose method (UPI, IMPS, NEFT).",
                "Confirm with a typed-amount check; system marks completed and notifies mentor.",
                "If UPI invalid or fraud: Reject with reason; wallet restores; mentor is notified.",
            ]
        )
    )


def section_9(story):
    story.append(section_banner("09", "End-to-end operating flow"))
    story.append(
        P(
            "The four figures below are the operating flowcharts. Figure 1 is collection "
            "(Razorpay stays). Figure 2 is mentor settlement (no RazorpayX — admin pays, "
            "then records the UTR). Figure 3 is the request status machine. Figure 4 is the "
            "same journey as swimlanes so each actor’s job is visible."
        )
    )
    story.append(P("Figure 1 — Collection to wallet credit", "h2"))
    story.append(
        P(
            "Learner payment is unchanged. Earnings stay pending until the session is "
            "completed. Only then does the internal wallet increase. No money has left "
            "the company bank yet.",
            "body_left",
        )
    )
    story.append(Chart(paint_collection, 168 * mm))
    story.append(P("Figure 1 — Razorpay collects; Connectiqo ledger credits the mentor after the session.", "caption"))

    story.append(PageBreak())
    story.append(section_banner("09", "End-to-end operating flow  ·  continued"))
    story.append(P("Figure 2 — Withdrawal and manual admin payout", "h2"))
    story.append(
        P(
            "This is the flow to implement. The mentor requests a payout; the wallet is "
            "held; an operator sends rupees from the company UPI or bank app; success "
            "records UTR and completes the row; failure restores the wallet.",
            "body_left",
        )
    )
    story.append(Chart(paint_payout, 198 * mm))
    story.append(P("Figure 2 — Manual settlement. Right branch is reject; left branch is paid.", "caption"))

    story.append(PageBreak())
    story.append(section_banner("09", "End-to-end operating flow  ·  continued"))
    story.append(P("Figure 3 — Status machine", "h2"))
    story.append(Chart(paint_status, 92 * mm))
    story.append(P("Figure 3 — Allowed status moves. completed and rejected are terminal.", "caption"))

    story.append(P("Figure 4 — Swimlane (who does what)", "h2"))
    story.append(Chart(paint_swimlane, 118 * mm))
    story.append(P("Figure 4 — Columns are time; rows are actors. Razorpay appears only in the Learner lane.", "caption"))

    story.append(P("Happy path — step list (same as Figure 2, left branch)", "h2"))
    steps = [
        ("1", "Learner pays", "Razorpay Checkout. Transaction status paid. Unchanged."),
        ("2", "Session happens", "Booking confirmed → call → marked completed."),
        ("3", "Ledger credit", "complete_session_payment: earnings completed; wallet.balance += mentor cut."),
        ("4", "Mentor saves UPI", "Payout setup writes mentor_profiles.upi_id. No Razorpay account."),
        ("5", "Mentor requests payout", "Wallet ≥ ₹5,000. process-withdrawal holds balance, inserts pending request."),
        ("6", "Admin queue", "Payout Control Panel lists pending. Operator sees name, UPI, amount."),
        ("7", "Admin pays outside app", "GPay / PhonePe / IMPS / NEFT from company account to mentor UPI or bank."),
        ("8", "Admin records proof", "admin_complete_withdrawal: UTR, method, paid_at, processed_by. Status completed."),
        ("9", "Mentor notified", "FCM + in-app: “₹X sent to name@upi (UTR …)”. Wallet shows Withdrawn."),
    ]
    data = [[P("Step", "th"), P("Name", "th"), P("What happens", "th")]]
    for n, name, desc in steps:
        data.append([P(n, "cell_b"), P(name, "cell_b"), P(desc, "cell")])
    t = Table(data, colWidths=[16 * mm, 42 * mm, 112 * mm], repeatRows=1)
    cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.3, RULE),
    ]
    for i in range(1, len(data)):
        bg = PALE_TEAL if i % 2 else WHITE
        cmds.append(("BACKGROUND", (0, i), (-1, i), bg))
        cmds.append(("BACKGROUND", (0, i), (0, i), TEAL))
        cmds.append(("TEXTCOLOR", (0, i), (0, i), WHITE))
        cmds.append(("ALIGN", (0, i), (0, i), "CENTER"))
    t.setStyle(TableStyle(cmds))
    story.append(t)
    story.append(P("Table 7 — Same happy path as Figure 2, written as a checklist for QA.", "caption"))

    story.append(P("Reject path", "h2"))
    story.append(
        bullets(
            [
                "Admin marks processing (optional lock so two operators do not pay the same row).",
                "Payment fails (wrong UPI, beneficiary name mismatch, suspected duplicate).",
                "admin_reject_withdrawal(p_id, p_reason, p_operator): status=rejected, balance restored, mentor notified.",
                "Mentor can fix UPI and request again once balance is available.",
            ]
        )
    )
    story.append(P("Double-pay protection", "h2"))
    story.append(
        bullets(
            [
                "Only pending (or processing) rows can be completed.",
                "UPDATE … WHERE status IN ('pending','processing') RETURNING * — if zero rows, abort.",
                "UI disables Complete after success; refresh from server.",
                "Optional: require Mark processing first, so a second admin sees it is in flight.",
            ]
        )
    )


def section_10(story):
    story.append(section_banner("10", "Withdrawal status machine"))
    story.append(
        styled_table(
            ["From", "To", "Who", "Wallet effect", "Required fields"],
            [
                ["(new)", "pending", "Mentor (process-withdrawal)", "Hold: balance − amount", "upi_id, amount ≥ 5000"],
                ["pending", "processing", "Admin (optional lock)", "None", "processed_by"],
                ["pending / processing", "completed", "Admin complete RPC", "total_withdrawn += amount", "payout_method, payout_reference (UTR)"],
                ["pending / processing", "rejected", "Admin reject RPC", "Restore: balance + amount", "rejected_reason"],
                ["completed", "—", "Terminal", "None", "No UI action"],
                ["rejected", "—", "Terminal", "None", "Mentor may create a new request"],
            ],
            [36 * mm, 32 * mm, 32 * mm, 38 * mm, 32 * mm],
        )
    )
    story.append(P("Table 8 — Allowed transitions. “approved” is not a status.", "caption"))
    story.append(
        callout(
            "Do not introduce “approved”",
            "The current admin filter already invented an approved status that the CHECK constraint "
            "does not allow. Approval is implicit in Complete. If a two-person maker-checker is "
            "needed later, add approved as a distinct state before processing — not as a synonym "
            "for completed.",
            "warn",
        )
    )


def section_11(story):
    story.append(section_banner("11", "Data model and RPCs"))
    story.append(P("11.1 Columns to add on withdrawal_requests", "h2"))
    story.append(
        styled_table(
            ["Column", "Type", "Use"],
            [
                ["payout_method", "TEXT", "upi | imps | neft | other"],
                ["payout_reference", "TEXT", "UTR / UPI transaction ID (required on complete)"],
                ["paid_at", "TIMESTAMPTZ", "When the bank/UPI transfer was made"],
                ["processed_by", "TEXT", "Admin email / operator id"],
                ["rejected_reason", "TEXT", "Shown to mentor on reject"],
            ],
            [42 * mm, 36 * mm, 92 * mm],
        )
    )
    story.append(P("Table 9 — Proof-of-payment fields. razorpay_payout_id can remain unused.", "caption"))
    story.append(P("11.2 Optional columns on mentor_profiles", "h2"))
    story.append(
        bullets(
            [
                "upi_id — already exists; this becomes the source of truth.",
                "payout_account_holder TEXT — display name for the operator.",
                "bank_account TEXT — already conceptually on withdrawal_requests; store on profile too.",
                "ifsc TEXT — for NEFT fallback.",
                "Stop writing razorpay_account_id / kyc_status for new mentors. Leave old values untouched.",
            ]
        )
    )
    story.append(P("11.3 RPC: deduct_wallet_for_withdrawal (version in git)", "h2"))
    story.append(
        P(
            "SECURITY DEFINER. Decrement balance only if balance ≥ amount. "
            "<b>Do not</b> increment total_withdrawn here. Raise on insufficient funds. "
            "Return the new balance. Called only from process-withdrawal."
        )
    )
    story.append(P("11.4 RPC: admin_complete_withdrawal", "h2"))
    story.append(
        P(
            "Arguments: request id, method, reference, operator, optional note. "
            "Lock the row. Require status in (pending, processing). Require non-empty UTR. "
            "Set status=completed, paid_at=now(), store proof fields. "
            "Increment mentor_wallets.total_withdrawn by the request amount "
            "(balance was already held). Return the updated row. Notify via Edge or a trigger."
        )
    )
    story.append(P("11.5 RPC: admin_reject_withdrawal", "h2"))
    story.append(
        P(
            "Arguments: request id, reason, operator. Lock the row. Require status in "
            "(pending, processing). Set status=rejected. Add amount back to "
            "mentor_wallets.balance. Do not touch total_withdrawn. Notify mentor."
        )
    )
    story.append(P("11.6 RPC: admin_mark_processing (optional but recommended)", "h2"))
    story.append(
        P(
            "Sets status=processing and processed_by so a second operator sees the lock. "
            "No wallet change. Completing or rejecting still allowed from processing."
        )
    )
    story.append(P("11.7 Edge Functions", "h2"))
    story.append(
        styled_table(
            ["Function", "Action"],
            [
                [
                    "process-withdrawal",
                    "Keep. Document as manual queue, not RazorpayX. Continue requiring UPI.",
                ],
                [
                    "save-payout-details (new) or slim create-linked-account",
                    "Auth as mentor. Validate UPI. Update mentor_profiles only. No Razorpay HTTP.",
                ],
                [
                    "get-account-status",
                    "Return { status: upi_id ? 'active' : 'not_started', upiId } without calling Razorpay.",
                ],
                [
                    "transfer-session-payout",
                    "Short-circuit to { transferred: false, reason: 'manual_settlement' } or stop invoking it.",
                ],
                [
                    "notify-payout-status (new)",
                    "FCM to mentor: completed or rejected, amount, last-4 of UPI, UTR or reason.",
                ],
            ],
            [58 * mm, 112 * mm],
        )
    )
    story.append(P("Table 10 — Edge Function changes. Shared by app and web.", "caption"))
    story.append(P("11.8 RLS reminder", "h2"))
    story.append(
        P(
            "Mentors can SELECT and INSERT their own withdrawal_requests. They must not UPDATE status. "
            "Completion/reject happens via SECURITY DEFINER RPCs invoked with the admin service role. "
            "Do not add a broad UPDATE policy for authenticated users."
        )
    )


def section_12(story):
    story.append(section_banner("12", "Admin panel specification"))
    story.append(
        P(
            "Add a dedicated <b>Payout Control Panel</b> on the Payments page, modelled on "
            "TransactionControlPanel, shown when the Withdrawals tab is active. Keep the "
            "generic CRUD table in read-only / details mode so operators cannot type "
            "status=completed in JSON."
        )
    )
    story.append(P("12.1 Queue list", "h2"))
    story.append(
        bullets(
            [
                "Default filter: pending, then processing. Tabs: Pending · Processing · Completed · Rejected · All.",
                "Columns: requested at, mentor name, email, UPI, amount (₹), status, age.",
                "Enrich mentor_id → profiles.name / email / phone (same pattern as listBookingRows).",
                "KPI strip: pending count, pending rupees, completed this week, rejected this week.",
                "Copy buttons on UPI and amount (clipboard) — this is the speed feature.",
            ]
        )
    )
    story.append(P("12.2 Detail / fulfil drawer", "h2"))
    story.append(
        bullets(
            [
                "Mentor identity, current wallet snapshot (balance, earned, withdrawn), saved UPI, optional bank/IFSC.",
                "Request amount, created_at, current status.",
                "Actions: Mark processing · Mark paid · Reject.",
                "Mark paid fields: payout_method (select), payout_reference (required), paid_at (default now), admin_note.",
                "Guard: operator must re-type the amount (e.g. 5000) before Confirm paid.",
                "Reject fields: rejected_reason (required, min 8 characters).",
                "On success: toast, audit log entry, refresh queue, fire notify-payout-status.",
            ]
        )
    )
    story.append(P("12.3 Wiring", "h2"))
    story.append(
        P(
            "adminApi.js already has updateTableRow. Do not use it for status. Add "
            "<font face='Courier'>completeWithdrawal(config, payload)</font> and "
            "<font face='Courier'>rejectWithdrawal(config, payload)</font> that call "
            "<font face='Courier'>supabase.rpc('admin_complete_withdrawal', …)</font> "
            "with the service-role client. Use existing AuditProvider.addLog with "
            "entity=withdrawal_requests and the UTR in the payload."
        )
    )
    story.append(P("12.4 Filter bugfix (ship with the panel)", "h2"))
    story.append(
        P(
            "PaymentsPage.jsx withdrawals filterFields currently: "
            "<font face='Courier'>all, pending, approved, rejected</font>. Change to "
            "<font face='Courier'>all, pending, processing, completed, rejected</font> "
            "even before the new panel, so today’s TEST MODE queue is operable."
        )
    )
    story.append(
        callout(
            "Do not let operators edit mentor_wallets.balance in CRUD",
            "Wallets tab should be read-only. A manual balance edit desynchronises "
            "total_earned / total_withdrawn and makes F1-style losses undetectable. "
            "If a correction is ever needed, add a separate admin_adjust_wallet RPC with a reason code.",
            "danger",
        )
    )


def section_13(story):
    story.append(section_banner("13", "Mobile app changes"))
    story.append(P("13.1 Payout setup", "h2"))
    story.append(
        bullets(
            [
                "Replace Razorpay Route form (legal address, KYC email) with: UPI ID, account holder name, optional bank + IFSC.",
                "Validate UPI client-side (simple regex) and server-side.",
                "Success state: “Payouts are ready — withdrawals go to {upi}”.",
                "Remove copy about Razorpay emailing the mentor for KYC.",
            ]
        )
    )
    story.append(P("13.2 Wallet", "h2"))
    story.append(
        bullets(
            [
                "payoutReady = Boolean(storedUpi), not Razorpay kyc_status === 'active'.",
                "Keep MIN_WITHDRAWAL = 5000 and the existing confirm dialog.",
                "Load withdrawal_requests for the mentor (web already does this). Show pending / processing / completed / rejected.",
                "While a request is pending or processing, show it above the withdraw CTA so the mentor does not think the money vanished.",
                "Copy: “We’ll send this to your UPI from Connectiqo within 1–2 business days.” Do not mention Razorpay payout.",
            ]
        )
    )
    story.append(P("13.3 API comments", "h2"))
    story.append(
        P(
            "Update paymentApi.requestWithdrawal JSDoc from “Trigger a RazorpayX UPI payout” "
            "to “Create a manual withdrawal request for admin fulfilment.” Prevents the next "
            "developer from resurrecting RazorpayX from a comment."
        )
    )


def section_14(story):
    story.append(section_banner("14", "Web portal changes"))
    story.append(
        P(
            "The web portal already mirrors the app: same Edge Functions, same ₹5,000 floor, "
            "and it already lists withdrawal history on /settings/wallet. Changes are smaller "
            "than mobile, but must ship in the same release so mentors do not see Razorpay KYC "
            "on web and UPI-only on the app."
        )
    )
    story.append(
        bullets(
            [
                "/settings/payout — same UPI-first form; drop linked-account fields.",
                "payoutApi.createLinkedAccount can be renamed savePayoutDetails and pointed at the new function (or the slimmed one).",
                "getAccountStatus: treat UPI present as ready; do not depend on Razorpay poll.",
                "Wallet copy: “Processed within 1–2 business days” stays; remove Razorpay payout wording from terms if section 7 currently implies a PSP payout method.",
                "Terms page currently: “Mentors receive session earnings … via the payout method configured in Settings.” Keep that; it already fits manual UPI.",
            ]
        )
    )


def section_15(story):
    story.append(section_banner("15", "Notifications and mentor experience"))
    story.append(
        P(
            "Booking status already has notify-booking-status (FCM). Reuse the same "
            "FIREBASE_SERVICE_ACCOUNT pattern for payout events. Suggested payloads:"
        )
    )
    story.append(
        styled_table(
            ["Event", "Title", "Body"],
            [
                [
                    "Request created",
                    "Withdrawal requested",
                    "₹{amount} to {upi}. We’ll send it within 1–2 business days.",
                ],
                [
                    "Processing",
                    "Payout in progress",
                    "We’re sending ₹{amount} to {upi}.",
                ],
                [
                    "Completed",
                    "Payout sent",
                    "₹{amount} sent to {upi}. Ref {utr}.",
                ],
                [
                    "Rejected",
                    "Withdrawal not sent",
                    "₹{amount} was returned to your wallet. Reason: {reason}.",
                ],
            ],
            [36 * mm, 42 * mm, 92 * mm],
        )
    )
    story.append(P("Table 11 — Mentor-facing copy. Amounts formatted en-IN.", "caption"))
    story.append(
        P(
            "In-app NotificationsScreen is booking-centric today. For v1, FCM + the Wallet "
            "status list is enough. A dedicated notification category can follow if support "
            "volume is high."
        )
    )


def section_16(story):
    story.append(section_banner("16", "Security, audit, and India compliance"))
    story.append(P("16.1 Application security", "h2"))
    story.append(
        bullets(
            [
                "Mentors can only insert their own withdrawal_requests (existing RLS).",
                "Wallet mutation only inside SECURITY DEFINER RPCs — never from the client.",
                "Admin complete/reject requires service-role (already how admin mutates).",
                "Do not accept status updates from the mentor JWT.",
                "UTR uniqueness optional: warn if the same payout_reference is reused (catch paste errors / double complete).",
                "Log operator email on every transition (processed_by + AuditProvider).",
            ]
        )
    )
    story.append(P("16.2 Admin session (known limitation)", "h2"))
    story.append(
        P(
            "Admin AuthProvider compares VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD in the "
            "browser and stores a localStorage flag. The service-role key is also in the "
            "admin env and used from the client. That is pre-existing. Payouts make it more "
            "sensitive. Phase 2 should move fulfilment RPCs behind an Edge Function that "
            "checks an admin secret or a real Supabase admin user, and stop shipping the "
            "service-role key to the browser. Do not block v1 on that rewrite if the admin "
            "app is already trusted on an internal machine — but do not expand service-role "
            "usage into new public clients."
        )
    )
    story.append(P("16.3 Operational / finance notes (India)", "h2"))
    story.append(
        bullets(
            [
                "Connectiqo is merchant of record for the learner payment; mentor payout is a payable.",
                "Keep UTR, amount, beneficiary UPI, date — needed for bank reconciliation and disputes.",
                "TDS (e.g. 194J/194H) may apply above thresholds; v1 should let finance record a note. Auto-deduct only if they specify a rate.",
                "GST: platform fee is already split at checkout. Mentor invoices (if GST-registered) are a finance process, not an app feature in v1.",
                "Pay from a company current account / business UPI, not a personal account.",
                "Daily cap: if one operator would send more than the bank’s UPI limit, use IMPS/NEFT and store method=neft.",
            ]
        )
    )


def section_17(story):
    story.append(section_banner("17", "Implementation phases"))
    story.append(
        styled_table(
            ["Phase", "Goal", "Ships"],
            [
                [
                    "0 — Stabilise",
                    "Make the current TEST MODE safe",
                    "Version deduct_wallet_for_withdrawal; fix admin status filter; freeze wallet CRUD; document TEST MODE as intentional.",
                ],
                [
                    "1 — Fulfil",
                    "Operators can pay",
                    "New columns; complete/reject RPCs; Payout Control Panel; Copy UPI/amount; notify-payout-status.",
                ],
                [
                    "2 — Identity",
                    "Drop Razorpay KYC from mentor UX",
                    "UPI-first payout setup on app + web; get-account-status without Razorpay; disable transfer-session-payout.",
                ],
                [
                    "3 — Scale (optional)",
                    "When queue is large",
                    "CSV / NEFT bulk export; maker-checker; admin auth hardening (no service-role in browser).",
                ],
            ],
            [32 * mm, 42 * mm, 96 * mm],
        )
    )
    story.append(P("Table 12 — Phased delivery. Phase 1 unblocks operations even if payout setup is still the old form, because process-withdrawal already only needs upi_id.", "caption"))
    story.append(
        P(
            "Suggested order of work in git: one migration PR (RPCs + columns), one admin PR "
            "(panel), one app+web PR (setup + wallet list). Backend first so admin can fulfil "
            "requests that mentors already create today."
        )
    )


def section_18(story):
    story.append(section_banner("18", "Test plan"))
    story.append(
        styled_table(
            ["ID", "Case", "Expected"],
            [
                ["T1", "Withdraw below ₹5,000", "Client rejects; no row; no wallet change."],
                ["T2", "Withdraw without UPI", "Edge error: Complete payout setup first."],
                ["T3", "Withdraw more than balance", "RPC error; no request row."],
                ["T4", "Happy withdraw", "Balance held; pending row; UPI copied onto the row."],
                ["T5", "Admin complete with UTR", "Status completed; total_withdrawn += amount; FCM sent."],
                ["T6", "Admin complete twice", "Second call no-ops / errors; wallet not double-counted."],
                ["T7", "Admin reject", "Status rejected; balance restored; total_withdrawn unchanged; FCM."],
                ["T8", "CRUD JSON status edit", "Blocked or ignored; only RPCs change status."],
                ["T9", "App and web same mentor", "Both show the same pending request and new balance."],
                ["T10", "Session complete still credits wallet", "Unrelated booking still runs complete_session_payment."],
                ["T11", "Learner Razorpay checkout", "Unchanged; regression on booking payment."],
                ["T12", "Invalid UPI save", "Rejected at Edge; payout not ready."],
            ],
            [14 * mm, 58 * mm, 98 * mm],
        )
    )
    story.append(P("Table 13 — Minimum QA before production fulfilment.", "caption"))


def section_19(story):
    story.append(section_banner("19", "What not to do"))
    story.append(
        bullets(
            [
                "Do not uncomment or re-add a RazorpayX payout block in process-withdrawal.",
                "Do not require Razorpay Route KYC before a mentor can request a withdrawal.",
                "Do not mark requests completed from the generic JSON editor.",
                "Do not decrement the wallet again on complete (it is already held on request).",
                "Do not increment total_withdrawn on request if you also increment on complete.",
                "Do not pay from a personal UPI and skip the UTR field.",
                "Do not change learner Razorpay collection as part of this work.",
                "Do not add an “approved” status unless maker-checker is a real requirement.",
            ]
        )
    )
    story.append(
        callout(
            "Definition of done",
            "A mentor with a saved UPI and ₹5,000+ available can request a withdrawal on app or web. "
            "An admin can pay that UPI from the company account, record the UTR, and the mentor’s "
            "wallet and history match — without any Razorpay payout API call in the logs.",
            "ok",
        )
    )


def section_20(story):
    story.append(section_banner("20", "Appendix — current schema and file index"))
    story.append(P("A. withdrawal_requests (as created)", "h2"))
    story.append(
        Preformatted(
            """id              UUID PK
mentor_id       UUID NOT NULL → profiles
amount          NUMERIC(12,2) NOT NULL
upi_id          TEXT
bank_account    TEXT
status          TEXT DEFAULT 'pending'
                CHECK (pending | processing | completed | rejected)
admin_note      TEXT
razorpay_payout_id TEXT          -- added later; unused in TEST MODE
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ

RLS: mentor SELECT + INSERT own rows. No mentor UPDATE.""",
            S["code"],
        )
    )
    story.append(P("B. mentor_wallets", "h2"))
    story.append(
        Preformatted(
            """id               UUID PK → profiles
balance          NUMERIC(12,2)  -- available after holds
total_earned     NUMERIC(12,2)
total_withdrawn  NUMERIC(12,2)
updated_at       TIMESTAMPTZ""",
            S["code"],
        )
    )
    story.append(P("C. Existing RPCs to keep", "h2"))
    story.append(
        bullets(
            [
                "increment_mentor_wallet — used at credit time in some paths.",
                "complete_session_payment — session complete → earnings completed + wallet credit.",
                "claim_and_book_slots — atomic booking + pending earnings after Razorpay verify.",
            ]
        )
    )
    story.append(P("D. File index (absolute)", "h2"))
    files = [
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\functions\process-withdrawal\index.ts",
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\functions\create-linked-account\index.ts",
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\functions\get-account-status\index.ts",
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\functions\transfer-session-payout\index.ts",
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\migrations\001_payment_tables.sql",
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\migrations\002_earnings_status.sql",
        r"C:\Flutter\Freelancing\Project\connectfront\supabase\migrations\add_payout_fields.sql",
        r"C:\Flutter\Freelancing\Project\connectfront\src\scenes\settings\WalletScreen.js",
        r"C:\Flutter\Freelancing\Project\connectfront\src\scenes\settings\PayoutSetupScreen.js",
        r"C:\Flutter\Freelancing\Project\connectfront\src\api\paymentApi.js",
        r"C:\Flutter\Freelancing\Project\connectfront\src\api\payoutApi.js",
        r"D:\connectiqo\connectiqo web\connectiqo web\connectiqo_web-portal\src\app\(main)\settings\wallet\page.tsx",
        r"D:\connectiqo\connectiqo web\connectiqo web\connectiqo_web-portal\src\app\(main)\settings\payout\page.tsx",
        r"D:\connectiqo\connectiqo web\connectiqo web\connectiqo_web-portal\src\lib\api\paymentApi.ts",
        r"D:\connectiqo\connectiqo web\connectiqo web\connectiqo_web-portal\src\lib\api\payoutApi.ts",
        r"C:\Flutter\Freelancing\Project\admin\adminsideconnectfornt\admin\src\features\payments\PaymentsPage.jsx",
        r"C:\Flutter\Freelancing\Project\admin\adminsideconnectfornt\admin\src\features\payments\TransactionControlPanel.jsx",
        r"C:\Flutter\Freelancing\Project\admin\adminsideconnectfornt\admin\src\services\adminApi.js",
    ]
    for f in files:
        story.append(P(f.replace("&", "&amp;"), "file"))
    story.append(Spacer(1, 6 * mm))
    story.append(hr())
    story.append(Spacer(1, 4 * mm))
    story.append(
        P(
            "End of report. Next concrete build step: Phase 0 migration for "
            "<font face='Courier'>deduct_wallet_for_withdrawal</font> plus the admin "
            "status-filter fix, then Phase 1 Payout Control Panel.",
            "body_left",
        )
    )


def build():
    doc = SimpleDocTemplate(
        str(OUT_PATH),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=22 * mm,
        bottomMargin=18 * mm,
        title="Connectiqo — Manual Mentor Payout Architecture Report",
        author="Connectiqo Engineering",
        subject="Manual mentor payout without RazorpayX / Razorpay Payout",
    )
    story = []
    cover_page(story)
    toc(story)
    section_1(story)
    section_2(story)
    section_3(story)
    section_4(story)
    section_5(story)
    section_6(story)
    section_7(story)
    section_8(story)
    section_9(story)
    section_10(story)
    section_11(story)
    section_12(story)
    section_13(story)
    section_14(story)
    section_15(story)
    section_16(story)
    section_17(story)
    section_18(story)
    section_19(story)
    section_20(story)
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUT_PATH)


if __name__ == "__main__":
    build()
