#!/usr/bin/env python3
"""
يبني نسخة معاينة من صفحة واحدة مكتفية بذاتها من موقع ديم درون.

لماذا: رابط المعاينة (Artifact) يعرض ملفًا واحدًا بلا طلبات خارجية، بينما
الموقع سبع صفحات بملفات CSS و JS وخطوط منفصلة. هذا السكربت يجمعها:

  · محتوى <main> من كل صفحة يصبح قسمًا، ومُوجِّه بالـ hash ينقل بينها.
  · الخطوط تُقلَّص إلى النطاقات المستخدمة ثم تُضمَّن كـ data URI.
  · CSS و JS والبيانات تُضمَّن داخل الملف.

الاستعمال:  python3 tools/build-artifact.py
الناتج:     build/deem-drone.html
"""
import base64
import glob
import os
import re
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")

PAGES = [
    ("index", "الرئيسية"),
    ("services", "الخدمات"),
    ("technology", "التقنية والسلامة"),
    ("pricing", "الأسعار"),
    ("about", "من نحن"),
    ("contact", "تواصل"),
    ("portal", "بوابة العميل"),
]

# نطاقات عربية كاملة + لاتيني + علامات، حتى يظهر أي نص يكتبه الآدمن لاحقًا
UNICODES = ("U+0020-007E,U+00A0-00FF,U+0600-06FF,U+0750-077F,U+08A0-08FF,"
            "U+FB50-FDFF,U+FE70-FEFF,U+200B-206F,U+2212,U+25B2-25BC,U+2190-21FF")


def read(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        return fh.read()


def subset_fonts():
    """يقلّص الخطوط ويعيدها كقاموس {اسم الملف: data URI}."""
    from fontTools import subset
    out_dir = os.path.join(BUILD, "fonts")
    os.makedirs(out_dir, exist_ok=True)
    data = {}
    for src in sorted(glob.glob(os.path.join(ROOT, "assets/fonts/*.woff2"))):
        name = os.path.basename(src)
        dst = os.path.join(out_dir, name)
        subset.main([src, "--unicodes=" + UNICODES, "--layout-features=*",
                     "--flavor=woff2", "--no-hinting", "--desubroutinize",
                     "--output-file=" + dst])
        with open(dst, "rb") as fh:
            data[name] = "data:font/woff2;base64," + base64.b64encode(fh.read()).decode()
    return data


def inline_css(fonts):
    css = read("assets/css/style.css")
    for name, uri in fonts.items():
        css = css.replace('url("../fonts/%s")' % name, 'url("%s")' % uri)
    left = re.findall(r'url\("\.\./fonts/[^"]+"\)', css)
    if left:
        raise SystemExit("خط لم يُضمَّن: " + ", ".join(left))
    return css


def page_parts(slug):
    """يعيد (محتوى main، النصوص البرمجية الداخلية) لصفحة."""
    html = read(slug + ".html")
    main = re.search(r"<main id=\"main\">(.*?)</main>", html, re.S)
    if not main:
        raise SystemExit("لا يوجد <main> في " + slug)
    body = main.group(1)
    # نصوص برمجية داخلية فقط (لا src) — الرئيسية تشغّل رسومها منها
    inline = re.findall(r"<script>(.*?)</script>", html, re.S)
    return body, "\n".join(inline)


def rewrite_links(html):
    """روابط الصفحات تصبح مسارات hash يتولّاها المُوجِّه."""
    for slug, _ in PAGES:
        html = html.replace('href="%s.html#' % slug, 'href="#/%s@' % slug)
        html = html.replace('href="%s.html"' % slug, 'href="#/%s"' % slug)
    # مراسٍ داخلية بقيت بصيغة الوسم @ تُعاد إلى #
    html = re.sub(r'href="#/(\w+)@([\w-]+)"', r'href="#/\1"', html)
    return html


def build():
    os.makedirs(BUILD, exist_ok=True)
    fonts = subset_fonts()
    css = inline_css(fonts)

    header = re.search(r"<header class=\"site-header\">(.*?)</header>",
                       read("index.html"), re.S).group(0)
    footer = re.search(r"<footer class=\"site-footer\">(.*?)</footer>",
                       read("index.html"), re.S).group(0)

    sections, boot = [], []
    for slug, label in PAGES:
        body, inline = page_parts(slug)
        sections.append(
            '<section class="rt-page" id="rt-%s" hidden aria-label="%s">%s</section>'
            % (slug, label, body))
        if inline.strip():
            boot.append("/* %s */\n(function(){\n%s\n})();" % (slug, inline))

    js = "\n".join(read(p) for p in [
        "assets/js/charts.js",
        "assets/data/client-alnakheel.js",
        "assets/js/site.js",
        "assets/js/portal.js",
        "assets/js/admin.js",
    ])

    router = """
/* مُوجِّه بالـ hash: نسخة الصفحة الواحدة تعرض قسمًا واحدًا في كل مرة.
   المسار #/slug، والافتراضي الرئيسية. */
(function () {
  var PAGES = %s;
  function show(slug) {
    if (PAGES.indexOf(slug) < 0) slug = "index";
    PAGES.forEach(function (s) {
      var el = document.getElementById("rt-" + s);
      if (el) el.hidden = (s !== slug);
    });
    document.querySelectorAll(".nav__links a").forEach(function (a) {
      var t = (a.getAttribute("href") || "").replace("#/", "");
      a.toggleAttribute("aria-current", t === slug);
      if (t === slug) a.setAttribute("aria-current", "page");
    });
    window.scrollTo(0, 0);
    /* الأقسام المخفية لا تتقاطع، فتُكشف عناصر الظهور التدريجي عند العرض */
    var page = document.getElementById("rt-" + slug);
    if (page) page.querySelectorAll(".reveal").forEach(function (n) { n.classList.add("is-in"); });
    if (slug === "portal") {
      var demo = document.querySelector("[data-demo-enter]");
      if (demo) demo.click();
    }
  }
  function route() { show((location.hash || "#/index").replace("#/", "").split("@")[0]); }
  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", route);
})();
""" % str([s for s, _ in PAGES]).replace("'", '"')

    html = """<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ديم درون | معاينة الموقع</title>
<meta name="description" content="نسخة معاينة من صفحة واحدة لموقع ديم درون — تنظيف واجهات المباني بالطائرات المسيّرة، مع بوابة العميل ولوحة مؤشر النظافة.">
<style>
%s

/* ---- إضافات نسخة المعاينة فقط ---- */
.rt-page[hidden] { display: none; }
.rt-note {
  background: var(--brand-wash); border-bottom: 1px solid var(--hairline);
  font-size: .85rem; color: var(--ink-2); text-align: center; padding: .55rem 1rem;
}
.rt-note strong { color: var(--brand-strong); }
</style>
</head>
<body>
<a class="skip-link" href="#main">تخطَّ إلى المحتوى</a>
<p class="rt-note"><strong>نسخة معاينة</strong> — الموقع كاملًا في صفحة واحدة. أضف <code>?admin=1</code> إلى الرابط لتجربة وضع تحرير النصوص (كلمة المرور: deem2026).</p>
%s
<main id="main">
%s
</main>
%s
<div class="cta-dock">
  <a class="btn btn--primary" href="#/contact">احجز مسحًا مجانيًا</a>
  <a class="btn btn--ghost" href="tel:+966500000000">اتصل</a>
</div>
<script>
%s
%s
%s
</script>
</body>
</html>
""" % (css, rewrite_links(header), rewrite_links("\n".join(sections)),
       rewrite_links(footer), js, router, "\n".join(boot))

    out = os.path.join(BUILD, "deem-drone.html")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(html)
    shutil.rmtree(os.path.join(BUILD, "fonts"), ignore_errors=True)
    print("تم: %s  (%d KB)" % (out, os.path.getsize(out) // 1024))


if __name__ == "__main__":
    build()
