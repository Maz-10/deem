#!/usr/bin/env python3
"""مولّد ملفات شعار «ديم» — مصدر الحقيقة لهندسة الشعار.

الكلمة «ديم» مرسومة بخط هندسي أحادي السُّمك على شبكة واحدة، ونقطتا الياء
مستبدلتان بقطرة ماء (يمين) ولمعة نظافة (يسار): يُقرأ الشعار من اليمين
«ماء ثم بريق» — وهو معنى «ديم.. لبريق دائم».

كل الملفات تُشتق من الثوابت أدناه، فأي تعديل هنا يُطبَّق على جميع النسخ:

    python3 tools/build_brand.py          # يكتب SVG إلى assets/brand و assets/img/favicon.svg
    python3 tools/build_brand.py --inline # يطبع نسخة الرأس المضمّنة في index.html و portal.html
    node tools/render_brand_png.js        # (اختياري) يصدّر نسخ PNG عبر Playwright
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"

# ---- الألوان ----------------------------------------------------------------
INK = "#161c26"        # كحلي الهوية — الحروف على الأرضيات الفاتحة
WATER = "#1497c4"      # أزرق الماء — القطرة واللمعة على الفاتح (3.4:1 مع الأبيض)
WATER_LT = "#3fc0e6"   # القطرة على الأرضيات الداكنة (8:1 مع الكحلي)
GLINT = "#c9f1fa"      # اللمعة على الأرضيات الداكنة
WHITE = "#ffffff"

# ---- الهندسة (وحدات SVG؛ خط الأساس y=0 ومحور y نازل) -----------------------
S = 10           # سُمك الخط
RD = 20          # نصف قطر وعاء الدال
RM = 17          # نصف قطر عقدة الميم
T = 26           # ارتفاع سنّ الياء
TAIL = 26        # نهاية ذيل الميم تحت السطر
TAIL_ANG = 160   # موضع خروج الذيل من العقدة (180 = أقصى اليسار)
G1 = 32          # الوصلة بين عقدة الميم والسنّ
GAP = 17         # الفراغ بين السنّ وذيل الدال
LD = 24          # امتداد ذيل الدال يسار مركز وعائه
DAL_TOP = 6      # الذراع العلوية القصيرة للدال
DROP_R = 7.5     # نصف قطر جسم القطرة
DROP_K = 2.2     # بُعد رأس القطرة عن مركزها ÷ نصف القطر
SP_R = 10.5      # نصف قطر اللمعة
SP_PINCH = 0.16  # نحافة أشعة اللمعة (أصغر = أنحف)

XM = 0.0                  # مركز عقدة الميم
XT = XM + RM + G1         # سنّ الياء
XD = XT + GAP + LD        # مركز وعاء الدال
DOT_Y = S / 2 + 1.6 * S   # خط مركز النقطتين تحت السطر
DOT_DX = 1.05 * S         # نصف المسافة بين النقطتين
DOTS_CX = XT - 0.35 * S   # مركز الزوج تحت السنّ

# الصندوق الخارجي للكلمة
WX0 = XM - RM - S / 2
WX1 = XD + RD + S / 2
WY0 = -2 * RD - S / 2
WY1 = max(TAIL + S / 2, DOT_Y + DROP_R * 1.35, DOT_Y + SP_R)


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def drop_d(cx, cy, r, k=DROP_K):
    """قطرة: دائرة ورأس حاد على بُعد k*r فوق مركزها، بمماسّين نظيفين."""
    a = math.pi / 2 - math.asin(1 / k)
    x1, y1 = cx + r * math.cos(-math.pi / 2 + a), cy + r * math.sin(-math.pi / 2 + a)
    x2, y2 = cx + r * math.cos(-math.pi / 2 - a), cy + r * math.sin(-math.pi / 2 - a)
    return f"M{f(cx)} {f(cy - k * r)}L{f(x1)} {f(y1)}A{f(r)} {f(r)} 0 1 1 {f(x2)} {f(y2)}Z"


def sparkle_d(cx, cy, r, pinch=SP_PINCH):
    """لمعة رباعية: أربعة رؤوس تصلها منحنيات مقعّرة."""
    c = pinch * r
    pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
    ctl = [(cx + c, cy - c), (cx + c, cy + c), (cx - c, cy + c), (cx - c, cy - c)]
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    for i in range(4):
        (qx, qy), (nx, ny) = ctl[i], pts[(i + 1) % 4]
        d += f"Q{f(qx)} {f(qy)} {f(nx)} {f(ny)}"
    return d + "Z"


def letters_d():
    a = math.radians(TAIL_ANG)
    tx, ty = XM + RM * math.cos(a), -RM + RM * math.sin(a)
    return "".join([
        # م: عقدة مغلقة على السطر + ذيل نازل
        f"M{f(XM)} 0A{f(RM)} {f(RM)} 0 1 1 {f(XM)} {f(-2 * RM)}A{f(RM)} {f(RM)} 0 1 1 {f(XM)} 0Z",
        f"M{f(tx)} {f(ty)}V{f(TAIL)}",
        # ـيـ: الوصلة ثم السنّ
        f"M{f(XM)} 0H{f(XT)}V{f(-T)}",
        # د: ذراع علوية، وعاء، ذيل على السطر
        f"M{f(XD - DAL_TOP)} {f(-2 * RD)}H{f(XD)}A{f(RD)} {f(RD)} 0 0 1 {f(XD)} 0H{f(XD - LD)}",
    ])


DROP = drop_d(DOTS_CX + DOT_DX, DOT_Y + DROP_R * 0.35, DROP_R)
SPARKLE = sparkle_d(DOTS_CX - DOT_DX, DOT_Y, SP_R)


def wordmark_g(ink, drop, sparkle):
    return (f'<path d="{letters_d()}" fill="none" stroke="{ink}" stroke-width="{f(S)}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path d="{DROP}" fill="{drop}"/><path d="{SPARKLE}" fill="{sparkle}"/>')


# ---- الاسم اللاتيني: حروف كبيرة أحادية السُّمك على المبدأ نفسه ---------------
LAT_W = {"D": 0.80, "E": 0.62, "M": 0.94, "R": 0.70, "O": 1.0, "N": 0.80, " ": 0.55}
LAT_TRACK = 0.38


def latin_d(text, c):
    x, parts = 0.0, []
    for ch in text:
        w = LAT_W[ch] * c
        if ch == "D":
            r = c / 2
            parts.append(f"M{f(x)} 0V{f(-c)}H{f(x + w - r)}A{f(r)} {f(r)} 0 0 1 {f(x + w - r)} 0Z")
        elif ch == "E":
            parts.append(f"M{f(x + w)} {f(-c)}H{f(x)}V0H{f(x + w)}M{f(x)} {f(-c / 2)}H{f(x + w * 0.86)}")
        elif ch == "M":
            parts.append(f"M{f(x)} 0V{f(-c)}L{f(x + w / 2)} {f(-c * 0.3)}L{f(x + w)} {f(-c)}V0")
        elif ch == "R":
            r = c / 4
            parts.append(f"M{f(x)} 0V{f(-c)}H{f(x + w - r)}A{f(r)} {f(r)} 0 0 1 {f(x + w - r)} {f(-c / 2)}H{f(x)}"
                         f"M{f(x + w * 0.5)} {f(-c / 2)}L{f(x + w)} 0")
        elif ch == "O":
            r = c / 2
            parts.append(f"M{f(x + r)} 0A{f(r)} {f(r)} 0 1 1 {f(x + r)} {f(-c)}A{f(r)} {f(r)} 0 1 1 {f(x + r)} 0Z")
        elif ch == "N":
            parts.append(f"M{f(x)} 0V{f(-c)}L{f(x + w)} 0V{f(-c)}")
        x += w + (LAT_TRACK * c if ch != " " else 0)
    return "".join(parts), x - LAT_TRACK * c


LAT_C, LAT_S = 9.0, 1.7          # ارتفاع الحرف اللاتيني وسُمكه في التوقيع الأفقي
LAT_D, LAT_WIDTH = latin_d("DEEM DRONE", LAT_C)


def latin_g(color, x, y, c=LAT_C, s=LAT_S):
    d = LAT_D if c == LAT_C else latin_d("DEEM DRONE", c)[0]
    return (f'<path transform="translate({f(x)} {f(y)})" d="{d}" fill="none" stroke="{color}" '
            f'stroke-width="{f(s)}" stroke-linecap="round" stroke-linejoin="round"/>')


# ---- كتابة الملفات ------------------------------------------------------------
THEMES = {
    "": dict(ink=INK, drop=WATER, sparkle=WATER, latin=INK),
    "-white": dict(ink=WHITE, drop=WATER_LT, sparkle=GLINT, latin=WHITE),
    "-mono": dict(ink=INK, drop=INK, sparkle=INK, latin=INK),
    "-mono-white": dict(ink=WHITE, drop=WHITE, sparkle=WHITE, latin=WHITE),
}


def doc(vb, body, label):
    x, y, w, h = vb
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x)} {f(y)} {f(w)} {f(h)}" '
            f'role="img" aria-label="{label}"><title>{label}</title>{body}</svg>\n')


def box(x0, y0, x1, y1, pad):
    return (x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)


def wordmark_svg(t, pad=4):
    return doc(box(WX0, WY0, WX1, WY1, pad), wordmark_g(t["ink"], t["drop"], t["sparkle"]), "ديم")


RULE_GAP = 16


def lockup_svg(t, pad=4):
    """التوقيع الأفقي: «ديم» يمينًا، ثم فاصل رفيع، ثم DEEM DRONE."""
    rule_x = WX0 - RULE_GAP
    lx = rule_x - RULE_GAP - LAT_WIDTH
    cy = -RD
    body = (wordmark_g(t["ink"], t["drop"], t["sparkle"])
            + f'<path d="M{f(rule_x)} {f(cy - 14)}V{f(cy + 14)}" stroke="{t["latin"]}" stroke-opacity=".35" '
              f'stroke-width="1.2" stroke-linecap="round"/>'
            + latin_g(t["latin"], lx, cy + LAT_C / 2))
    return doc(box(lx - LAT_S / 2, WY0, WX1, WY1, pad), body, "ديم درون — DEEM DRONE")


def stacked_svg(t, pad=4, c=8.0, s=1.6):
    """التوقيع العمودي: «ديم» وتحتها DEEM DRONE في المنتصف."""
    _, lw = latin_d("DEEM DRONE", c)
    cx = (WX0 + WX1) / 2
    ly = WY1 + 12 + c
    body = wordmark_g(t["ink"], t["drop"], t["sparkle"]) + latin_g(t["latin"], cx - lw / 2, ly, c, s)
    x0, x1 = min(WX0, cx - lw / 2 - s / 2), max(WX1, cx + lw / 2 + s / 2)
    return doc(box(x0, WY0, x1, ly + s / 2, pad), body, "ديم درون — DEEM DRONE")


# الأيقونة: نقطتا الياء وحدهما على مربع — القطرة واللمعة
PAIR_X0 = DOTS_CX - DOT_DX - SP_R
PAIR_X1 = DOTS_CX + DOT_DX + DROP_R
PAIR_Y0 = min(DOT_Y - SP_R, DOT_Y + DROP_R * 0.35 - DROP_R * DROP_K)
PAIR_Y1 = max(DOT_Y + SP_R, DOT_Y + DROP_R * 1.35)


def icon_svg(tile=WATER, drop=WHITE, sparkle=WHITE, size=64, fill=0.66, radius=0.24):
    pw, ph = PAIR_X1 - PAIR_X0, PAIR_Y1 - PAIR_Y0
    k = size * fill / pw
    tx = size / 2 - k * (PAIR_X0 + pw / 2)
    ty = size / 2 - k * (PAIR_Y0 + ph / 2)
    rect = (f'<rect width="{size}" height="{size}" rx="{f(size * radius)}" fill="{tile}"/>' if radius
            else f'<rect width="{size}" height="{size}" fill="{tile}"/>')
    body = (rect + f'<g transform="translate({f(tx)} {f(ty)}) scale({f(k)})">'
            f'<path d="{DROP}" fill="{drop}"/><path d="{SPARKLE}" fill="{sparkle}"/></g>')
    return doc((0, 0, size, size), body, "ديم")


def avatar_svg(tile=WHITE, t=THEMES[""], size=200, fill=0.62):
    """صورة الحسابات: الكلمة داخل منطقة آمنة للقص الدائري."""
    ww, hh = WX1 - WX0, WY1 - WY0
    k = size * fill / ww
    tx = size / 2 - k * (WX0 + ww / 2)
    ty = size / 2 - k * (WY0 + hh / 2)
    body = (f'<rect width="{size}" height="{size}" fill="{tile}"/>'
            f'<g transform="translate({f(tx)} {f(ty)}) scale({f(k)})">'
            f'{wordmark_g(t["ink"], t["drop"], t["sparkle"])}</g>')
    return doc((0, 0, size, size), body, "ديم")


def inline_snippet():
    """النسخة المضمّنة في رأس الصفحات: الحروف بلون النص (currentColor)،
    والنقطتان بمتغيرات CSS --logo-water و--logo-glint لتتبدّلا مع الوضع الداكن."""
    vb = box(WX0, WY0, WX1, WY1, 0)
    h = 40
    word = (f'<svg class="logo__word" viewBox="{" ".join(f(v) for v in vb)}" width="{f(h * vb[2] / vb[3])}" '
            f'height="{h}" aria-hidden="true" focusable="false">'
            f'<path d="{letters_d()}" fill="none" stroke="currentColor" stroke-width="{f(S)}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>'
            f'<path class="logo__drop" d="{DROP}" fill="{WATER}"/>'
            f'<path class="logo__glint" d="{SPARKLE}" fill="{WATER}"/></svg>')
    lvb = (-LAT_S / 2, -LAT_C - LAT_S / 2, LAT_WIDTH + LAT_S, LAT_C + LAT_S)
    lh = 9
    latin = (f'<svg class="logo__latin" viewBox="{" ".join(f(v) for v in lvb)}" width="{f(lh * lvb[2] / lvb[3])}" '
             f'height="{lh}" aria-hidden="true" focusable="false">'
             f'<path d="{LAT_D}" fill="none" stroke="currentColor" stroke-width="{f(LAT_S)}" '
             f'stroke-linecap="round" stroke-linejoin="round"/></svg>')
    return word + "\n" + latin


def main():
    BRAND.mkdir(parents=True, exist_ok=True)
    files = {}
    for suffix, t in THEMES.items():
        files[f"deem-logo{suffix}.svg"] = lockup_svg(t)
        files[f"deem-wordmark{suffix}.svg"] = wordmark_svg(t)
        files[f"deem-logo-stacked{suffix}.svg"] = stacked_svg(t)
    files["deem-icon.svg"] = icon_svg()
    files["deem-icon-ink.svg"] = icon_svg(tile=INK, drop=WATER_LT, sparkle=GLINT)
    files["deem-icon-square.svg"] = icon_svg(radius=0)   # مصدر apple-touch-icon: iOS يدوّر الزوايا بنفسه
    files["deem-avatar.svg"] = avatar_svg()
    files["deem-avatar-ink.svg"] = avatar_svg(tile=INK, t=THEMES["-white"])
    for name, text in files.items():
        (BRAND / name).write_text(text, encoding="utf-8")
    (ROOT / "assets" / "img" / "favicon.svg").write_text(icon_svg(size=32, fill=0.72, radius=0.22), encoding="utf-8")
    print(f"wrote {len(files)} files to {BRAND.relative_to(ROOT)} + assets/img/favicon.svg")


if __name__ == "__main__":
    import sys
    if "--inline" in sys.argv:
        print(inline_snippet())
    else:
        main()
