#!/usr/bin/env python3
"""مولّد ملفات شعار «ديم» — مصدر الحقيقة للشعار.

الشعار كلمة «ديـم» بخط ثمانية (Thmanyah Sans) بكشيدة واحدة، وفراغ الميم
الداخلي — وهو بطبيعته على هيئة قطرة — مملوء بقطرة ماء تفصلها عن الحرف شعرة
بيضاء. كل العناصر من عائلة خط واحدة: الحروف العربية، والاسم اللاتيني، وخط
الموقع نفسه. ترخيص خطوط ثمانية يجيز استخدامها في الشعارات صراحةً، والملفات
الناتجة رسوم (مسارات) لا ملفات خط.

    pip install fonttools brotli uharfbuzz shapely numpy
    python3 tools/build_brand.py            # يكتب SVG إلى assets/brand و assets/img/favicon.svg
    python3 tools/build_brand.py --inline   # يطبع نسخة الرأس المضمّنة في index.html و portal.html
    node tools/render_brand_png.js          # (اختياري) يصدّر نسخ PNG عبر Playwright
"""
import io
import re
import sys
from pathlib import Path

import numpy as np
import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "assets" / "brand"
FONTS = ROOT / "assets" / "fonts"

# ---- الألوان ----------------------------------------------------------------
INK = "#161c26"        # كحلي الهوية: الحروف والأرضية الداكنة
WATER = "#1593d6"      # ماء ديم: القطرة على الأرضيات الفاتحة
WATER_LT = "#4cc0ee"   # القطرة على الأرضيات الداكنة
WHITE = "#ffffff"

# ---- الثوابت -----------------------------------------------------------------
WORD = "ديـم"          # بكشيدة واحدة بين الياء والميم
WORD_FONT = "thmanyah-sans-regular.woff2"
ICON_FONT = "thmanyah-sans-medium.woff2"   # وزن أمتن للأحجام الصغيرة
LATIN = "DEEM DRONE"
LATIN_FONT = "thmanyah-sans-regular.woff2"
LATIN_TRACK = 0.36     # تباعد الحروف اللاتينية (نسبة من وحدة الخط)
DROP_GAP = 16          # الشعرة بين القطرة والحرف (بوحدات الخط، 1000 للـ em)


def f(v):
    s = f"{v:.1f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


# ---- استخراج الحروف من الخط ----------------------------------------------------
_fonts = {}


def _font(name):
    if name not in _fonts:
        tt = TTFont(FONTS / name)
        tt.flavor = None
        buf = io.BytesIO()
        tt.save(buf)
        data = buf.getvalue()
        _fonts[name] = (TTFont(io.BytesIO(data)), hb.Font(hb.Face(data)))
    return _fonts[name]


def _contours(text, font):
    """يشكّل النص بـ HarfBuzz ويعيد كل محيط مغلق مع اسم حرفه وترتيبه وحدوده (y نازل)."""
    tt, hbfont = _font(font)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {})
    glyphs, order = tt.getGlyphSet(), tt.getGlyphOrder()
    out, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        m = (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)
        rec = RecordingPen()
        glyphs[name].draw(rec)
        contour, index = [], 0
        for op, args in rec.value:
            contour.append((op, args))
            if op in ("closePath", "endPath"):
                pen, bounds = SVGPathPen(None), BoundsPen(None)
                for o, a in contour:
                    getattr(TransformPen(pen, m), o)(*a)
                    getattr(TransformPen(bounds, m), o)(*a)
                out.append(dict(glyph=name, index=index, d=pen.getCommands(), bounds=bounds.bounds))
                contour, index = [], index + 1
        x += pos.x_advance
    return out, x


def _flatten(d, steps=32):
    """مسار SVG مطلق (M/L/Q/C/Z) إلى نقاط — يكفي لما يكتبه SVGPathPen."""
    toks = re.findall(r"[MLQCZ]|-?\d*\.?\d+", d)
    pts, cur, cmd, i = [], np.zeros(2), None, 0
    while i < len(toks):
        if toks[i] in "MLQCZ":
            cmd = toks[i]
            i += 1
            if cmd == "Z":
                continue
        n = {"M": 2, "L": 2, "Q": 4, "C": 6}[cmd]
        v = np.array(toks[i:i + n], float).reshape(-1, 2)
        i += n
        t = np.linspace(0, 1, steps)[1:, None]
        if cmd in "ML":
            pts.append(v[0])
        elif cmd == "Q":
            pts.extend((1 - t) ** 2 * cur + 2 * (1 - t) * t * v[0] + t ** 2 * v[1])
        else:
            pts.extend((1 - t) ** 3 * cur + 3 * (1 - t) ** 2 * t * v[0] + 3 * (1 - t) * t ** 2 * v[1] + t ** 3 * v[2])
        cur = v[-1]
        if cmd == "M":
            cmd = "L"
    return pts


def _poly_d(geom):
    ring = np.asarray(geom.exterior.coords)[:-1]
    return "M" + "L".join(f"{f(x)} {f(y)}" for x, y in ring) + "Z"


def wordmark(font=WORD_FONT, text=WORD):
    """طبقات الكلمة: ink (الحروف، وفراغ الميم ثقب فيها)، water (القطرة)، dots (نقطتا الياء)."""
    layers = {"ink": [], "water": [], "dots": []}
    cs, _ = _contours(text, font)
    for c in cs:
        meem = c["glyph"].startswith(("uniFEE2", "meemAr"))
        yeh = c["glyph"].startswith(("uniFEF3", "yehAr"))
        if meem and c["index"] == 1:
            layers["ink"].append(c["d"])
            drop = Polygon(_flatten(c["d"])).buffer(-DROP_GAP, quad_segs=32).simplify(0.4)
            layers["water"].append(_poly_d(drop))
        elif yeh and c["bounds"][1] > 20:
            layers["dots"].append(c["d"])
        else:
            layers["ink"].append(c["d"])
    xs = [v for c in cs for v in (c["bounds"][0], c["bounds"][2])]
    ys = [v for c in cs for v in (c["bounds"][1], c["bounds"][3])]
    return {k: "".join(v) for k, v in layers.items()}, (min(xs), min(ys), max(xs), max(ys))


def latin(text=LATIN, font=LATIN_FONT, track=LATIN_TRACK):
    tt, _ = _font(font)
    upm = tt["head"].unitsPerEm
    parts, x, box = [], 0.0, [1e9, 1e9, -1e9, -1e9]
    for ch in text:
        cs, adv = _contours(ch, font)
        if cs:
            parts.append(f'<path transform="translate({f(x)} 0)" d="{"".join(c["d"] for c in cs)}"/>')
            for c in cs:
                b = c["bounds"]
                box = [min(box[0], b[0] + x), min(box[1], b[1]), max(box[2], b[2] + x), max(box[3], b[3])]
        x += adv + (track * upm if ch != " " else 0)
    return "".join(parts), tuple(box)


# ---- التراكيب ------------------------------------------------------------------
THEMES = {
    "": dict(ink=INK, water=WATER, latin=INK),
    "-white": dict(ink=WHITE, water=WATER_LT, latin=WHITE),
    "-mono": dict(ink=INK, water=INK, latin=INK),
    "-mono-white": dict(ink=WHITE, water=WHITE, latin=WHITE),
}


def word_g(L, t):
    return (f'<path d="{L["ink"]}" fill="{t["ink"]}"/>'
            f'<path d="{L["water"]}" fill="{t["water"]}"/>'
            f'<path d="{L["dots"]}" fill="{t["ink"]}"/>')


def doc(vb, body, label="ديم درون — DEEM DRONE"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{" ".join(f(v) for v in vb)}" '
            f'role="img" aria-label="{label}"><title>{label}</title>{body}</svg>\n')


def pad_box(x0, y0, x1, y1, p):
    return (x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p)


L_WORD, (WX0, WY0, WX1, WY1) = wordmark()
LAT_G, (LX0, LY0, LX1, LY1) = latin()
BAND_MID = -230        # منتصف نطاق الحروف (بين خط السطر وأعلى الميم والسنّ)
PAD = 60


def wordmark_svg(t):
    return doc(pad_box(WX0, WY0, WX1, WY1, PAD), word_g(L_WORD, t), "ديم")


def lockup_svg(t, cap=118, gap=105):
    """التوقيع الأفقي: «ديـم» يمينًا، ثم فاصل رفيع، ثم DEEM DRONE بمحاذاة نطاق الحروف."""
    s = cap / (LY1 - LY0)
    lw = (LX1 - LX0) * s
    rule_x = WX0 - gap
    lx = rule_x - gap - lw
    body = (word_g(L_WORD, t)
            + f'<path d="M{f(rule_x)} {f(BAND_MID - 175)}V{f(BAND_MID + 175)}" stroke="{t["latin"]}" '
              f'stroke-opacity=".3" stroke-width="7"/>'
            + f'<g transform="translate({f(lx - LX0 * s)} {f(BAND_MID + cap / 2 - LY1 * s)}) scale({s:.4f})" '
              f'fill="{t["latin"]}">{LAT_G}</g>')
    return doc(pad_box(lx, WY0, WX1, WY1, PAD), body)


def stacked_svg(t, cap=150, gap=170):
    """التوقيع العمودي: «ديـم» وتحتها DEEM DRONE في المنتصف."""
    s = cap / (LY1 - LY0)
    lw = (LX1 - LX0) * s
    cx = (WX0 + WX1) / 2
    top = WY1 + gap
    body = word_g(L_WORD, t) + (f'<g transform="translate({f(cx - lw / 2 - LX0 * s)} {f(top - LY0 * s)}) '
                                f'scale({s:.4f})" fill="{t["latin"]}">{LAT_G}</g>')
    return doc(pad_box(min(WX0, cx - lw / 2), WY0, max(WX1, cx + lw / 2), top + cap, PAD), body)


L_ICON, ICON_BOX = wordmark(ICON_FONT)


def tile_svg(tile=INK, t=THEMES["-white"], size=1000, fill=0.7, radius=0.22):
    """الأيقونة: الكلمة نفسها على مربع، بوزن أمتن قليلًا للأحجام الصغيرة."""
    x0, y0, x1, y1 = ICON_BOX
    k = size * fill / (x1 - x0)
    tx, ty = size / 2 - k * (x0 + x1) / 2, size / 2 - k * (y0 + y1) / 2
    rect = (f'<rect width="{size}" height="{size}" rx="{f(size * radius)}" fill="{tile}"/>' if radius
            else f'<rect width="{size}" height="{size}" fill="{tile}"/>')
    return doc((0, 0, size, size), rect + f'<g transform="translate({f(tx)} {f(ty)}) scale({k:.4f})">'
                                          f'{word_g(L_ICON, t)}</g>', "ديم")


def inline_snippet():
    """نسخة الرأس: الحروف بلون النص (currentColor) والقطرة من متغير --logo-water."""
    vb = pad_box(WX0, WY0, WX1, WY1, 0)
    h = 40
    word = (f'<svg class="logo__word" viewBox="{" ".join(f(v) for v in vb)}" width="{f(h * vb[2] / vb[3])}" '
            f'height="{h}" aria-hidden="true" focusable="false"><path d="{L_WORD["ink"]}{L_WORD["dots"]}" '
            f'fill="currentColor"/><path class="logo__drop" d="{L_WORD["water"]}" fill="{WATER}"/></svg>')
    lvb = pad_box(LX0, LY0, LX1, LY1, 0)
    lh = 9
    latin_ = (f'<svg class="logo__latin" viewBox="{" ".join(f(v) for v in lvb)}" width="{f(lh * lvb[2] / lvb[3])}" '
              f'height="{lh}" aria-hidden="true" focusable="false"><g fill="currentColor">{LAT_G}</g></svg>')
    return word + "\n" + latin_


def main():
    BRAND.mkdir(parents=True, exist_ok=True)
    for old in BRAND.glob("*.svg"):
        old.unlink()
    files = {}
    for suffix, t in THEMES.items():
        files[f"deem-logo{suffix}.svg"] = lockup_svg(t)
        files[f"deem-logo-stacked{suffix}.svg"] = stacked_svg(t)
        files[f"deem-wordmark{suffix}.svg"] = wordmark_svg(t)
    files["deem-icon.svg"] = tile_svg()
    files["deem-icon-square.svg"] = tile_svg(radius=0)                       # مصدر apple-touch-icon
    files["deem-avatar.svg"] = tile_svg(radius=0, fill=0.6)                   # صورة الحسابات (قص دائري)
    files["deem-avatar-light.svg"] = tile_svg(tile=WHITE, t=THEMES[""], radius=0, fill=0.6)
    for name, text in files.items():
        (BRAND / name).write_text(text, encoding="utf-8")
    (ROOT / "assets" / "img" / "favicon.svg").write_text(tile_svg(fill=0.8), encoding="utf-8")
    print(f"wrote {len(files)} files to {BRAND.relative_to(ROOT)} + assets/img/favicon.svg")


if __name__ == "__main__":
    if "--inline" in sys.argv:
        print(inline_snippet())
    else:
        main()
