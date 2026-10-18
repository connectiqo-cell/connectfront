"""Builds Play Store / App Store marketing screenshots from raw app captures.

Usage:  python play-store-screenshots/generate.py
Drop higher-resolution captures into ./source with the same file names for sharper output.
"""
import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "output")

FONT_BLACK = r"C:\Windows\Fonts\seguibl.ttf"
FONT_BOLD = r"C:\Windows\Fonts\segoeuib.ttf"
FONT_SEMI = r"C:\Windows\Fonts\seguisb.ttf"

WHITE = (255, 255, 255)
YELLOW = (250, 204, 21)
VIOLET = (167, 139, 250)
TEAL = (94, 234, 212)
SUB = (196, 181, 253)

# (file, status_bar_px_to_crop, [(x0,y0,x1,y1) regions to paint over], headline lines, subtitle)
# Headline lines are lists of (text, colour) segments.
SCREENS = [
    ("01_home.jpg", 48, [],
     [[("Connect", WHITE), (" with", WHITE)], [("creators", YELLOW), (" you love", WHITE)]],
     "Discover, book & join live sessions"),
    ("02_discover.jpg", 48, [],
     [[("Find ", WHITE), ("experts", YELLOW)], [("in every category", WHITE)]],
     "Coaching, fitness, wellness & more"),
    ("03_video_call.jpg", 0, [],
     [[("Face-to-face", YELLOW)], [("1:1 video sessions", WHITE)]],
     "HD calls with built-in chat"),
    ("04_sessions.jpg", 48, [],
     [[("Track every", WHITE)], [("session", YELLOW), (" in one place", WHITE)]],
     "Upcoming, completed & full history"),
    ("05_settings.jpg", 48, [(200, 16, 266, 82)],
     [[("Earn", YELLOW), (" from your", WHITE)], [("time & content", WHITE)]],
     "Wallet, subscriptions & payouts"),
]

TARGETS = {
    "android_phone_1080x1920": (1080, 1920),
    "ios_iphone_6.9in_1320x2868": (1320, 2868),
    "ios_iphone_6.5in_1242x2688": (1242, 2688),
    "ios_iphone_6.3in_1206x2622": (1206, 2622),
    "ios_iphone_6.1in_1179x2556": (1179, 2556),
    "ios_ipad_13in_2064x2752": (2064, 2752),
}


def font(path, size):
    return ImageFont.truetype(path, size)


def gradient_bg(w, h):
    top, bottom = (10, 7, 30), (36, 14, 84)
    bg = Image.new("RGB", (w, h))
    px = ImageDraw.Draw(bg)
    for y in range(h):
        t = y / (h - 1)
        px.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    r = int(w * 0.55)
    g.ellipse([-r // 2, int(h * 0.30) - r // 2, r // 2 + r // 2, int(h * 0.30) + r], fill=(90, 40, 200))
    g.ellipse([w - r, int(h * 0.62), w + r // 2, int(h * 0.62) + int(r * 1.3)], fill=(20, 110, 130))
    glow = glow.filter(ImageFilter.GaussianBlur(w // 5))
    return ImageChops.add(bg, glow.point(lambda v: int(v * 0.55)))


def prepare_screen(fname, crop_top, patches):
    img = Image.open(os.path.join(SRC, fname)).convert("RGB")
    d = ImageDraw.Draw(img)
    for box in patches:
        d.rectangle(box, fill=img.getpixel((box[0] - 20, box[1] + 30)))
    return img.crop((0, crop_top, img.width, img.height))


def draw_status_bar(screen_w, bar_h, colour):
    bar = Image.new("RGB", (screen_w, bar_h), colour)
    lum = sum(colour) / 3
    fg = (20, 20, 30) if lum > 140 else WHITE
    d = ImageDraw.Draw(bar)
    f = font(FONT_SEMI, int(bar_h * 0.42))
    d.text((int(screen_w * 0.08), bar_h // 2), "9:41", font=f, fill=fg, anchor="lm")
    # signal bars, wifi-ish dot, battery
    x = int(screen_w * 0.70)
    unit = max(2, bar_h // 14)
    for i in range(4):
        hh = int(bar_h * (0.14 + 0.07 * i))
        d.rectangle([x + i * unit * 2, bar_h // 2 + int(bar_h * 0.18) - hh, x + i * unit * 2 + unit, bar_h // 2 + int(bar_h * 0.18)], fill=fg)
    bx = int(screen_w * 0.82)
    bw, bh = int(bar_h * 0.62), int(bar_h * 0.30)
    by = bar_h // 2 - bh // 2
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh // 4, outline=fg, width=max(1, unit // 2 + 1))
    d.rectangle([bx + unit, by + unit, bx + int(bw * 0.8), by + bh - unit], fill=fg)
    d.rectangle([bx + bw + 1, by + bh // 3, bx + bw + unit, by + 2 * bh // 3], fill=fg)
    return bar


def phone_mockup(screen, phone_w):
    bezel = int(phone_w * 0.035)
    screen_w = phone_w - 2 * bezel
    bar_h = int(screen_w * 0.085)
    scale = screen_w / screen.width
    content = screen.resize((screen_w, int(screen.height * scale)), Image.LANCZOS)
    content = content.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    screen_h = bar_h + content.height
    phone_h = screen_h + 2 * bezel

    inner = Image.new("RGB", (screen_w, screen_h))
    inner.paste(draw_status_bar(screen_w, bar_h, screen.getpixel((screen.width // 2, 2))), (0, 0))
    inner.paste(content, (0, bar_h))
    # punch-hole camera
    di = ImageDraw.Draw(inner)
    cr = int(bar_h * 0.20)
    di.ellipse([screen_w // 2 - cr, bar_h // 2 - cr, screen_w // 2 + cr, bar_h // 2 + cr], fill=(5, 5, 8))

    phone = Image.new("RGBA", (phone_w, phone_h), (0, 0, 0, 0))
    outer_r = int(phone_w * 0.12)
    pd = ImageDraw.Draw(phone)
    pd.rounded_rectangle([0, 0, phone_w - 1, phone_h - 1], radius=outer_r, fill=(18, 16, 28, 255), outline=(90, 80, 130, 255), width=max(2, phone_w // 220))
    mask = Image.new("L", (screen_w, screen_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, screen_w - 1, screen_h - 1], radius=outer_r - bezel, fill=255)
    phone.paste(inner, (bezel, bezel), mask)
    return phone


def draw_rich_line(d, segments, f, cx, y):
    widths = [d.textlength(t, font=f) for t, _ in segments]
    x = cx - sum(widths) / 2
    for (t, c), w in zip(segments, widths):
        d.text((x, y), t, font=f, fill=c, anchor="ls")
        x += w


def render(screen, lines, subtitle, w, h):
    canvas = gradient_bg(w, h).convert("RGBA")
    d = ImageDraw.Draw(canvas)
    unit = min(w, h * 0.5625)

    brand_f = font(FONT_BOLD, int(unit * 0.034))
    head_f = font(FONT_BLACK, int(unit * 0.088))
    sub_f = font(FONT_SEMI, int(unit * 0.040))

    y = int(h * 0.055)
    d.text((w / 2, y), "CONNECTIQO", font=brand_f, fill=VIOLET, anchor="mt")
    y += int(unit * 0.12)
    line_gap = int(unit * 0.105)
    for segs in lines:
        draw_rich_line(d, segs, head_f, w / 2, y)
        y += line_gap
    y += int(unit * 0.005)
    d.text((w / 2, y - int(unit * 0.03)), subtitle, font=sub_f, fill=SUB, anchor="mt")
    text_bottom = y + int(unit * 0.06)

    avail_h = h - text_bottom - int(h * 0.035)
    aspect = (screen.width + 0) / (screen.height + screen.width * 0.085)
    phone_w = int(min(w * 0.80, avail_h * aspect * 0.98))
    phone = phone_mockup(screen, phone_w)
    if phone.height > avail_h:
        phone = phone.resize((int(phone.width * avail_h / phone.height), avail_h), Image.LANCZOS)

    px = (w - phone.width) // 2
    py = text_bottom + (avail_h - phone.height) // 2
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([px + 10, py + 30, px + phone.width + 10, py + phone.height + 30], radius=int(phone.width * 0.12), fill=(0, 0, 0, 170))
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(int(unit * 0.03))))
    canvas.alpha_composite(phone, (px, py))
    return canvas.convert("RGB")


def feature_graphic(screens):
    w, h = 1024, 500
    canvas = gradient_bg(w, h).convert("RGBA")
    d = ImageDraw.Draw(canvas)
    d.text((60, 150), "Connectiqo", font=font(FONT_BLACK, 78), fill=WHITE, anchor="ls")
    d.text((62, 200), "Connect · Create · Collab", font=font(FONT_SEMI, 30), fill=YELLOW, anchor="ls")
    for i, line in enumerate(["Book 1:1 video sessions with", "creators, coaches & experts"]):
        d.text((62, 290 + i * 44), line, font=font(FONT_SEMI, 30), fill=SUB, anchor="ls")
    for i, (scr, x, y) in enumerate([(screens[1], 560, 70), (screens[0], 770, 40)]):
        ph = phone_mockup(scr, 200)
        canvas.alpha_composite(ph, (x, y))
    return canvas.convert("RGB")


def main():
    prepared = [prepare_screen(f, crop, patches) for f, crop, patches, _, _ in SCREENS]
    for folder, (w, h) in TARGETS.items():
        out_dir = os.path.join(OUT, folder)
        os.makedirs(out_dir, exist_ok=True)
        for (fname, _, _, lines, sub), scr in zip(SCREENS, prepared):
            img = render(scr, lines, sub, w, h)
            path = os.path.join(out_dir, fname.replace(".jpg", ".png"))
            img.save(path, "PNG", optimize=True)
            print(path, img.size)
    fg_dir = os.path.join(OUT, "android_feature_graphic_1024x500")
    os.makedirs(fg_dir, exist_ok=True)
    feature_graphic(prepared).save(os.path.join(fg_dir, "feature_graphic.png"), "PNG", optimize=True)
    print("feature graphic done")


if __name__ == "__main__":
    main()
