/* ديم درون — سلوكيات الموقع العامة: السمة، التنقل، النماذج، السنة */
(function () {
  "use strict";

  /* ---------- السمة (فاتح/داكن) ---------- */
  var KEY = "deem-theme";
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* وضع التصفح الخاص */ }
  if (saved === "dark" || saved === "light") document.documentElement.setAttribute("data-theme", saved);

  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".theme-toggle");
    if (toggle) {
      var sync = function () {
        var dark = currentTheme() === "dark";
        toggle.textContent = dark ? "☀" : "☾";
        toggle.setAttribute("aria-label", dark ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن");
      };
      sync();
      toggle.addEventListener("click", function () {
        var next = currentTheme() === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem(KEY, next); } catch (e) { /* تجاهل */ }
        sync();
      });
    }

    /* ---------- قائمة الجوال ---------- */
    var navBtn = document.querySelector(".nav__toggle");
    var navLinks = document.querySelector(".nav__links");
    if (navBtn && navLinks) {
      navBtn.addEventListener("click", function () {
        var open = navLinks.classList.toggle("is-open");
        navBtn.setAttribute("aria-expanded", String(open));
      });
      navLinks.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          navLinks.classList.remove("is-open");
          navBtn.setAttribute("aria-expanded", "false");
        }
      });
    }

    /* ---------- سنة التذييل ---------- */
    var y = document.querySelectorAll("[data-year]");
    for (var i = 0; i < y.length; i++) y[i].textContent = new Date().getFullYear();

    /* ---------- تعليم الصفحة الحالية ---------- */
    var here = location.pathname.split("/").pop() || "index.html";
    var links = document.querySelectorAll(".nav__links a");
    for (var j = 0; j < links.length; j++) {
      if (links[j].getAttribute("href") === here) links[j].setAttribute("aria-current", "page");
    }

    /* ---------- التحقق من النماذج ---------- */
    var forms = document.querySelectorAll("form[data-validate]");
    Array.prototype.forEach.call(forms, function (form) {
      form.setAttribute("novalidate", "novalidate");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true;
        Array.prototype.forEach.call(form.querySelectorAll(".field"), function (field) {
          var input = field.querySelector("input, select, textarea");
          if (!input || !input.hasAttribute("required")) return;
          var valid = input.value.trim() !== "" && input.checkValidity();
          field.classList.toggle("is-invalid", !valid);
          if (!valid && ok) { input.focus(); ok = false; }
        });
        if (!ok) return;
        var status = form.parentNode.querySelector(".form-status");
        if (status) {
          status.className = "form-status form-status--ok is-visible";
          status.textContent = "تم استلام طلبك. سيتواصل معك فريق ديم درون خلال يوم عمل واحد لتحديد موعد المسح المجاني.";
          status.setAttribute("role", "status");
        }
        form.reset();
      });
    });

    /* ---------- حاسبة السعر التقديرية ---------- */
    var calc = document.querySelector("[data-calc]");
    if (calc) {
      var out = calc.querySelector("[data-calc-out]");
      var note = calc.querySelector("[data-calc-note]");
      var run = function () {
        var area = parseFloat(calc.querySelector("#c-area").value) || 0;
        var rate = parseFloat(calc.querySelector("#c-type").value) || 0;
        var freq = parseFloat(calc.querySelector("#c-freq").value) || 1;
        var visit = area * rate;
        if (visit > 0 && visit < 4500) visit = 4500;         /* حد أدنى للتعبئة والتصاريح */
        var yearly = visit * freq;
        out.textContent = visit ? Math.round(visit).toLocaleString("en-US") + " ريال / زيارة" : "—";
        note.textContent = visit
          ? "التقدير السنوي: " + Math.round(yearly).toLocaleString("en-US") + " ريال على " + freq + " زيارة سنويًا. الحد الأدنى للزيارة 4,500 ريال."
          : "أدخل المساحة لعرض التقدير.";
      };
      Array.prototype.forEach.call(calc.querySelectorAll("input, select"), function (f) {
        f.addEventListener("input", run);
        f.addEventListener("change", run);
      });
      run();
    }
  });
})();
