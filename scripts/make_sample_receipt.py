"""Create an attractive Connectiqo sample receipt (A4 PDF)."""
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parents[1] / "play-store-screenshots" / "output" / "sample_receipt.pdf"

pdfmetrics.registerFont(TTFont("Segoe", r"C:\Windows\Fonts\segoeui.ttf"))
pdfmetrics.registerFont(TTFont("SegoeBold", r"C:\Windows\Fonts\segoeuib.ttf"))
pdfmetrics.registerFont(TTFont("SegoeSemi", r"C:\Windows\Fonts\seguisb.ttf"))

W, H = A4
M = 18 * mm
ACCENT = (0.35, 0.18, 0.78)
ACCENT_SOFT = (0.94, 0.91, 0.99)
INK = (0.09, 0.09, 0.13)
MUTED = (0.42, 0.42, 0.50)
WHITE = (1, 1, 1)
TOTAL_BG = (0.12, 0.10, 0.22)
OK = (0.06, 0.55, 0.38)
HEADER_TOP = (0.18, 0.08, 0.42)


def money(n: float) -> str:
    return f"Rs. {n:,.2f}"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=A4)

    c.setFillColorRGB(*HEADER_TOP)
    c.rect(0, H - 42 * mm, W, 42 * mm, fill=1, stroke=0)
    c.setFillColorRGB(*ACCENT)
    c.rect(0, H - 42 * mm, W, 7 * mm, fill=1, stroke=0)

    c.setFillColorRGB(*WHITE)
    c.setFont("SegoeBold", 22)
    c.drawString(M, H - 18 * mm, "Connectiqo")
    c.setFont("Segoe", 9)
    c.setFillColorRGB(0.78, 0.72, 0.96)
    c.drawString(M, H - 24 * mm, "Connect  -  Create  -  Collab")
    c.setFont("Segoe", 8.5)
    c.setFillColorRGB(0.72, 0.66, 0.92)
    c.drawString(M, H - 29 * mm, "app.connectiqo.com")

    c.setFillColorRGB(*WHITE)
    c.setFont("SegoeBold", 18)
    c.drawRightString(W - M, H - 17 * mm, "RECEIPT")
    c.setFont("Segoe", 9.5)
    c.setFillColorRGB(0.86, 0.82, 0.98)
    c.drawRightString(W - M, H - 24 * mm, "No. CIQ-ABC12345")
    c.drawRightString(W - M, H - 29 * mm, "Date  22 Nov 2026")

    panel_top = H - 52 * mm
    panel_h = 32 * mm
    c.setFillColorRGB(*ACCENT_SOFT)
    c.roundRect(M, panel_top - panel_h, W - 2 * M, panel_h, 6, fill=1, stroke=0)

    c.setFillColorRGB(*MUTED)
    c.setFont("SegoeSemi", 8)
    c.drawString(M + 5 * mm, panel_top - 8 * mm, "PAID TO")
    c.setFillColorRGB(*INK)
    c.setFont("SegoeBold", 12)
    c.drawString(M + 5 * mm, panel_top - 14 * mm, "Nishadh Nikam")

    c.setFillColorRGB(*MUTED)
    c.setFont("SegoeSemi", 8)
    c.drawString(M + 5 * mm, panel_top - 22 * mm, "LEARNER")
    c.setFillColorRGB(*INK)
    c.setFont("SegoeBold", 11)
    c.drawString(M + 5 * mm, panel_top - 28 * mm, "Hazel Joshi")

    c.setFillColorRGB(*MUTED)
    c.setFont("SegoeSemi", 8)
    c.drawString(W - M - 40 * mm, panel_top - 8 * mm, "STATUS")
    c.setFillColorRGB(*OK)
    c.setFont("SegoeBold", 12)
    c.drawString(W - M - 40 * mm, panel_top - 14 * mm, "Paid")

    y = panel_top - panel_h - 12 * mm
    row_h = 10 * mm
    table_w = W - 2 * M
    c.setFillColorRGB(*ACCENT)
    c.roundRect(M, y - row_h, table_w, row_h, 3, fill=1, stroke=0)
    c.setFillColorRGB(*WHITE)
    c.setFont("SegoeSemi", 9)
    c.drawString(M + 4 * mm, y - 6.5 * mm, "Description")
    c.drawRightString(W - M - 4 * mm, y - 6.5 * mm, "Amount")
    y -= row_h

    lines = [
        ("1:1 mentoring session", 1500.0),
        ("Platform fee (incl. taxes)", 225.0),
    ]
    for i, (label, amount) in enumerate(lines):
        if i % 2 == 0:
            c.setFillColorRGB(0.97, 0.97, 0.99)
            c.rect(M, y - row_h, table_w, row_h, fill=1, stroke=0)
        c.setFillColorRGB(*INK)
        c.setFont("Segoe", 10)
        c.drawString(M + 4 * mm, y - 6.5 * mm, label)
        c.drawRightString(W - M - 4 * mm, y - 6.5 * mm, money(amount))
        y -= row_h

    y -= 4 * mm
    box_w = 75 * mm
    box_h = 18 * mm
    c.setFillColorRGB(*TOTAL_BG)
    c.roundRect(W - M - box_w, y - box_h, box_w, box_h, 5, fill=1, stroke=0)
    c.setFillColorRGB(0.78, 0.76, 0.88)
    c.setFont("Segoe", 9)
    c.drawString(W - M - box_w + 4 * mm, y - 6 * mm, "Amount received")
    c.setFillColorRGB(*WHITE)
    c.setFont("SegoeBold", 14)
    c.drawRightString(W - M - 4 * mm, y - 13 * mm, money(1275.0))

    y -= box_h + 12 * mm
    c.setFillColorRGB(*MUTED)
    c.setFont("SegoeSemi", 9)
    c.drawString(M, y, "Payment reference")
    y -= 6 * mm
    refs = [("Payment ID", "pay_Abc123XYZ"), ("Order ID", "order_9fK2mL")]
    for label, value in refs:
        c.setFillColorRGB(*MUTED)
        c.setFont("SegoeSemi", 9)
        c.drawString(M, y, f"{label}:")
        c.setFillColorRGB(*INK)
        c.setFont("Segoe", 9)
        c.drawString(M + 28 * mm, y, value)
        y -= 5.5 * mm

    c.setFillColorRGB(0.97, 0.96, 0.99)
    c.rect(0, 0, W, 24 * mm, fill=1, stroke=0)
    c.setStrokeColorRGB(0.86, 0.82, 0.96)
    c.setLineWidth(1.2)
    c.line(0, 24 * mm, W, 24 * mm)
    c.setFillColorRGB(*MUTED)
    c.setFont("Segoe", 8)
    c.drawString(M, 14 * mm, "Payment receipt. Platform fee is inclusive of applicable taxes.")
    c.setFillColorRGB(*ACCENT)
    c.setFont("SegoeSemi", 8.5)
    c.drawString(M, 8 * mm, "Connectiqo  |  app.connectiqo.com")
    c.setFillColorRGB(*MUTED)
    c.setFont("Segoe", 8.5)
    c.drawRightString(W - M, 8 * mm, "Thank you for using Connectiqo")

    c.showPage()
    c.save()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
