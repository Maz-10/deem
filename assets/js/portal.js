/* ديم درون — بوابة العميل: بناء اللوحة والرسوم من بيانات العميل */
(function () {
  "use strict";

  var D = window.DEEM_CLIENT;
  if (!D) return;

  var AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                   "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  function arDate(iso) {
    var p = iso.split("-");
    return Number(p[2]) + " " + AR_MONTHS[Number(p[1]) - 1] + " " + p[0];
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }
  /* حالة المؤشر — تأتي دائمًا مع أيقونة ونص، فاللون وحده لا يحمل المعنى */
  function stateOf(v) {
    if (v >= 90) return { key: "good", label: "ممتاز" };
    if (v >= 75) return { key: "good", label: "جيد" };
    if (v >= 60) return { key: "warning", label: "تحذير" };
    return { key: "critical", label: "حرج" };
  }
  var ICONS = {
    good: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.6a8.4 8.4 0 100 16.8A8.4 8.4 0 0010 1.6zm4.1 6.3l-4.7 4.9a1 1 0 01-1.5 0L5.9 10.7a1 1 0 011.4-1.4l1.3 1.3 4-4.2a1 1 0 111.5 1.5z"/></svg>',
    warning: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M9.1 2.6L1.5 15.8A1 1 0 002.4 17.3h15.2a1 1 0 00.9-1.5L10.9 2.6a1 1 0 00-1.8 0zM10 7a.9.9 0 01.9 1v3.3a.9.9 0 11-1.8 0V8A.9.9 0 0110 7zm0 8.1a1.1 1.1 0 110-2.2 1.1 1.1 0 010 2.2z"/></svg>',
    critical: '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 1.6a8.4 8.4 0 100 16.8A8.4 8.4 0 0010 1.6zm0 3.6a.9.9 0 01.9.9v4.4a.9.9 0 11-1.8 0V6.1a.9.9 0 01.9-.9zm0 9.9a1.15 1.15 0 110-2.3 1.15 1.15 0 010 2.3z"/></svg>'
  };
  function set(sel, value) {
    var n = document.querySelector(sel);
    if (n) n.textContent = value;
  }
  function num(n, d) { return window.DeemCharts.format(n, d); }

  function build() {
    var c = D.client, idx = D.index;

    /* ---------- الترويسة ---------- */
    set("[data-building]", c.name);
    set("[data-meta]", c.city + " · " + c.floors + " طابقًا · " + num(c.glassAreaSqm) + " م² زجاج · " + c.contract.plan);
    set("[data-survey]", "آخر مسح: " + arDate(c.lastSurvey));

    /* ---------- الرقم البطولي ---------- */
    var st = stateOf(idx.current);
    var delta = idx.current - idx.previous;
    set("[data-index-value]", num(idx.current, 1));
    var pill = document.querySelector("[data-index-state]");
    if (pill) {
      pill.className = "status-pill status-pill--" + st.key;
      pill.innerHTML = ICONS[st.key] + "<span>" + st.label + "</span>";
    }
    var dEl = document.querySelector("[data-index-delta]");
    if (dEl) {
      /* السهم يحمل الاتجاه، فلا نكرّر الإشارة — الإشارة السالبة داخل نص عربي تنقلب بصريًا */
      dEl.className = "delta " + (delta >= 0 ? "delta--up" : "delta--down");
      dEl.textContent = (delta >= 0 ? "▲ ارتفاع " : "▼ انخفاض ") + num(Math.abs(delta), 1) + " نقطة عن المسح السابق";
    }

    /* ---------- البطاقات الإحصائية ---------- */
    set("[data-last-visit]", arDate(D.stats.lastVisit));
    set("[data-last-visit-sub]", "قبل " + daysBetween(D.stats.lastVisit, c.lastSurvey) + " يومًا من آخر مسح");
    set("[data-next-visit]", arDate(D.stats.nextVisit));
    set("[data-next-visit-sub]", "الجهات الأربع — مؤكدة");
    set("[data-sqm]", num(D.stats.sqmCleaned) + " م²");
    set("[data-sqm-sub]", "منذ بداية التعاقد");
    set("[data-water]", num(D.stats.waterSavedLitres) + " لتر");
    set("[data-water-sub]", "موفَّرة مقابل الغسيل التقليدي");

    /* ---------- 1) المؤشر عبر 12 شهرًا ---------- */
    window.DeemCharts.line(document.getElementById("chart-trend"), {
      title: "مؤشر النظافة عبر 12 شهرًا",
      subtitle: "القياس الفعلي مقابل الحد الأدنى المتعاقد عليه · النقاط على المحور = زيارات تنظيف",
      labels: idx.months,
      unit: "نقطة",
      yMin: 60,
      yMax: 100,
      band: [90, 100],
      markers: idx.visits,
      series: [
        { name: "المؤشر الفعلي", values: idx.actual },
        { name: "الحد المتعاقد عليه", values: idx.contracted, dashed: true }
      ],
      xTitle: "الشهر",
      footnote: "النطاق المظلّل الأعلى = نطاق «ممتاز» (90–100). كل هبوط حاد يعقبه ارتفاع هو أثر زيارة تنظيف."
    });

    /* ---------- 2) النظافة حسب الجهة ---------- */
    window.DeemCharts.bars(document.getElementById("chart-facades"), {
      title: "مؤشر النظافة حسب الجهة",
      subtitle: "قياس " + arDate(c.lastSurvey) + " · المقياس 0–100",
      unit: "نقطة",
      max: 100,
      xTitle: "الجهة",
      valueTitle: "المؤشر",
      items: D.facades.map(function (f) {
        return { label: f.name, value: f.index, note: f.note + " · " + num(f.areaSqm) + " م²" };
      }),
      footnote: "الجهة الغربية دون الحد المتعاقد عليه (80) — مجدولة ضمن زيارة " + arDate(D.stats.nextVisit) + "."
    });

    /* ---------- 3) مصادر الاتساخ ---------- */
    window.DeemCharts.stacked(document.getElementById("chart-soiling"), {
      title: "مصادر الاتساخ حسب الجهة",
      subtitle: "غرامات الترسّبات لكل متر مربع من الزجاج",
      categories: D.soiling.categories,
      series: D.soiling.series,
      unit: "جم/م²",
      xTitle: "الجهة",
      footnote: "الغبار المتراكم هو المصدر الأكبر في الجهة الغربية — وهو ما يفسّر انخفاض مؤشرها."
    });

    /* ---------- 4) مقياس استهلاك العقد ---------- */
    var used = c.contract.visitsUsed, total = c.contract.visitsIncluded;
    var pct = Math.round((used / total) * 100);
    var fill = document.querySelector("[data-meter-fill]");
    if (fill) fill.style.width = pct + "%";
    set("[data-meter-used]", used + " من " + total + " زيارة");
    set("[data-meter-left]", "متبقٍ " + (total - used) + " زيارة");
    set("[data-contract-end]", "ينتهي العقد في " + arDate(c.contract.endsOn));

    /* ---------- 5) التوصيات ---------- */
    var advice = document.querySelector("[data-advice]");
    if (advice) {
      var west = D.facades[D.facades.length - 1];
      var rows = [
        { s: "warning", t: "الجهة " + west.name + " عند " + num(west.index, 1) + " نقطة — دون الحد المتعاقد عليه (" + c.contract.minIndex + "). أُدرجت في زيارة " + arDate(D.stats.nextVisit) + " دون رسوم إضافية." },
        { s: "good", t: "الجهتان الشمالية والشرقية ضمن نطاق «جيد» ولا تحتاجان تدخّلًا قبل الزيارة المجدولة." },
        { s: "good", t: "المؤشر العام " + num(idx.current, 1) + " نقطة، أي أعلى بـ " + num(idx.current - c.contract.minIndex, 1) + " نقطة من التزام العقد." },
        { s: "warning", t: "بيئة المبنى «" + c.environment + "» تُفقد الواجهة 5–7 نقاط شهريًا — نوصي بتقصير الدورة إلى 6 أسابيع خلال موسم العواصف (مارس–مايو)." }
      ];
      advice.innerHTML = rows.map(function (r) {
        return '<div class="advice__item is-' + r.s + '">' + ICONS[r.s] + "<p style=\"margin:0\">" + r.t + "</p></div>";
      }).join("");
    }

    /* ---------- 6) سجل الزيارات ---------- */
    var body = document.querySelector("[data-visits]");
    if (body) {
      body.innerHTML = D.visits.map(function (v) {
        return "<tr><td>" + arDate(v.date) + "</td><td>" + v.scope + "</td><td class=\"num\">" + v.duration +
               "</td><td>" + v.lead + "</td><td class=\"num\">" + num(v.after, 1) + "</td></tr>";
      }).join("");
    }
  }

  /* ---------- شاشة الدخول التجريبية ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    var login = document.getElementById("portal-login");
    var dash = document.getElementById("portal-dashboard");
    var form = document.getElementById("login-form");
    var built = false;

    function enter() {
      login.classList.add("is-hidden");
      dash.classList.remove("is-hidden");
      if (!built) { build(); built = true; }
      dash.focus();
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        enter();
      });
    }
    var demo = document.querySelector("[data-demo-enter]");
    if (demo) demo.addEventListener("click", function (e) { e.preventDefault(); enter(); });

    /* الدخول المباشر عبر #dashboard — يفيد الروابط في العروض التقديمية */
    if (location.hash === "#dashboard") enter();
  });
})();
