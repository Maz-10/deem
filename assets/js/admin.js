/* ==========================================================================
   ديم درون — وضع الآدمن: تحرير أي نص في الموقع وحذف أي عنصر.

   كيف يعمل: كل عنصر يحمل نصًا مباشرًا يحصل على مفتاح ثابت مشتقّ من موقعه في
   الشجرة (tag + ترتيبه بين إخوته من نفس النوع). التعديلات تُحفظ تحت هذا
   المفتاح وتُطبَّق عند كل فتح للصفحة.

   حدود هذه النسخة — مذكورة صراحةً في الواجهة:
   · التخزين محلي في المتصفح (localStorage)، فالتعديلات لا تظهر لزوّار آخرين
     حتى تُصدَّر وتُسلَّم للمطوّر أو تُرفع إلى خادم.
   · بوابة الدخول تحقّق من كلمة في الواجهة فقط — ليست حماية أمنية.
     في الإنتاج: مصادقة على الخادم و PUT /api/content بنفس شكل ملف التصدير.
   ========================================================================== */
(function () {
  "use strict";

  var FLAG = "deem-admin";
  var PASS = "deem2026";                       /* عرض تجريبي فقط — لا يحمي شيئًا */
  var KEY = "deem-cms:" + location.pathname.split("/").pop();

  /* عناصر لا تُحرَّر: بنية الصفحة، الرسوم المولَّدة، وواجهة الآدمن نفسها */
  var SKIP = /^(SCRIPT|STYLE|SVG|PATH|CIRCLE|RECT|LINE|TEXT|TITLE|HEAD|HTML|BODY|OPTION|CODE)$/;
  var SKIP_IN = ".viz__plot, .viz__table, .viz__legend, .viz__tip, #deem-admin, .skip-link, [data-advice], [data-visits], .hero__stats strong";

  function store() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch (e) { return {}; }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  /* مفتاح ثابت: سلسلة من الجذر، كل خطوة "tag:الترتيب بين إخوته من نفس النوع" */
  function keyOf(node) {
    var parts = [];
    while (node && node.nodeType === 1 && node !== document.body) {
      var tag = node.tagName.toLowerCase();
      var i = 1, sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) i++;
      parts.unshift(tag + i);
      node = node.parentElement;
    }
    return parts.join("/");
  }

  /* العنصر قابل للتحرير إذا كان يحمل نصًا مباشرًا غير فارغ */
  function hasOwnText(node) {
    for (var i = 0; i < node.childNodes.length; i++) {
      var c = node.childNodes[i];
      if (c.nodeType === 3 && c.nodeValue.trim() !== "") return true;
    }
    return false;
  }

  function editables() {
    var out = [];
    var all = document.body.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (SKIP.test(n.tagName)) continue;
      if (n.closest(SKIP_IN)) continue;
      if (!hasOwnText(n)) continue;
      out.push(n);
    }
    return out;
  }

  /* ---------- تطبيق التعديلات المحفوظة (يعمل دائمًا، لا في وضع التحرير فقط) ---------- */
  function apply() {
    var data = store();
    if (!Object.keys(data).length) return 0;
    var count = 0;
    editables().forEach(function (n) {
      var rec = data[keyOf(n)];
      if (!rec) return;
      if (rec.deleted) { n.setAttribute("hidden", "hidden"); n.dataset.deemDeleted = "1"; count++; return; }
      if (typeof rec.text === "string") {
        /* يُستبدل النص المباشر فقط، فتبقى العناصر الداخلية (روابط، <strong>) سليمة */
        var replaced = false;
        for (var i = 0; i < n.childNodes.length; i++) {
          var c = n.childNodes[i];
          if (c.nodeType === 3 && c.nodeValue.trim() !== "") {
            c.nodeValue = replaced ? "" : rec.text;
            replaced = true;
          }
        }
        count++;
      }
    });
    return count;
  }

  /* ---------- شريط الأدوات ---------- */
  function toolbar(state) {
    var bar = document.createElement("div");
    bar.id = "deem-admin";
    bar.innerHTML =
      '<div class="adm__row">' +
        '<strong class="adm__brand">وضع التحرير</strong>' +
        '<span class="adm__count" data-adm-count></span>' +
        '<span class="adm__grow"></span>' +
        '<button type="button" class="adm__btn" data-adm="export">تصدير JSON</button>' +
        '<button type="button" class="adm__btn" data-adm="import">استيراد</button>' +
        '<button type="button" class="adm__btn adm__btn--warn" data-adm="reset">تراجع عن الكل</button>' +
        '<button type="button" class="adm__btn adm__btn--solid" data-adm="exit">إنهاء التحرير</button>' +
      '</div>' +
      '<p class="adm__hint">انقر أي نص لتعديله · <kbd>Esc</kbd> للإلغاء · زر ✕ فوق العنصر يحذفه · ' +
      'التعديلات محفوظة في هذا المتصفح فقط حتى تُصدَّر.</p>';
    document.body.appendChild(bar);
    document.body.classList.add("has-admin");

    function refresh() {
      var d = store(), edits = 0, dels = 0;
      Object.keys(d).forEach(function (k) { d[k].deleted ? dels++ : edits++; });
      bar.querySelector("[data-adm-count]").textContent =
        edits + " تعديلًا، " + dels + " محذوفًا";
    }
    refresh();
    state.refresh = refresh;

    bar.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-adm");
      if (!act) return;
      if (act === "exit") {
        try { localStorage.removeItem(FLAG); } catch (err) {}
        location.href = location.pathname;
      }
      if (act === "reset") {
        if (!confirm("سيُلغى كل تعديل وحذف في هذه الصفحة. متأكد؟")) return;
        try { localStorage.removeItem(KEY); } catch (err) {}
        location.reload();
      }
      if (act === "export") {
        var blob = new Blob([JSON.stringify({ page: KEY, edits: store() }, null, 2)],
          { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = KEY.replace(/[^\w.-]/g, "_") + ".json";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      }
      if (act === "import") {
        var inp = document.createElement("input");
        inp.type = "file"; inp.accept = "application/json";
        inp.addEventListener("change", function () {
          var file = inp.files[0];
          if (!file) return;
          var fr = new FileReader();
          fr.onload = function () {
            try {
              var parsed = JSON.parse(fr.result);
              save(parsed.edits || parsed);
              location.reload();
            } catch (err) { alert("الملف غير صالح."); }
          };
          fr.readAsText(file);
        });
        inp.click();
      }
    });
  }

  /* ---------- تفعيل التحرير ---------- */
  function enableEditing(state) {
    editables().forEach(function (n) {
      if (n.dataset.deemDeleted) return;
      n.classList.add("adm-editable");
      n.setAttribute("tabindex", "0");

      var original = null;

      n.addEventListener("click", function (e) {
        if (n.isContentEditable) return;
        e.preventDefault();          /* منع تنقّل الروابط أثناء التحرير */
        e.stopPropagation();
        original = n.textContent;
        n.contentEditable = "true";
        n.classList.add("is-editing");
        n.focus();
      });

      n.addEventListener("keydown", function (e) {
        if (!n.isContentEditable) return;
        if (e.key === "Escape") { n.textContent = original; n.blur(); }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); n.blur(); }
      });

      n.addEventListener("blur", function () {
        if (!n.isContentEditable) return;
        n.contentEditable = "false";
        n.classList.remove("is-editing");
        var text = n.textContent.trim();
        if (text === (original || "").trim()) return;
        var data = store();
        data[keyOf(n)] = { text: text };
        if (!save(data)) alert("تعذّر الحفظ — مساحة التخزين ممتلئة.");
        state.refresh();
      });
    });

    /* زر الحذف يتبع العنصر تحت المؤشر بدل رشّ أزرار على كل عنصر */
    var del = document.createElement("button");
    del.type = "button";
    del.id = "adm-del";
    del.textContent = "✕";
    del.title = "حذف هذا العنصر";
    del.setAttribute("aria-label", "حذف هذا العنصر");
    document.body.appendChild(del);
    var current = null;

    document.addEventListener("mouseover", function (e) {
      if (!e.target.closest) return;
      /* المرور فوق زر الحذف نفسه لا يُلغي العنصر المستهدف — وإلا استحال الوصول إليه */
      if (e.target.closest("#adm-del")) return;
      var t = e.target.closest(".adm-editable");
      if (!t || t.isContentEditable) { del.classList.remove("is-on"); current = null; return; }
      current = t;
      var r = t.getBoundingClientRect();
      /* الزاوية العليا من جهة بداية السطر (اليمين في RTL) */
      del.style.top = (r.top + window.pageYOffset - 10) + "px";
      del.style.left = (r.right + window.pageXOffset - 12) + "px";
      del.classList.add("is-on");
    });

    del.addEventListener("click", function () {
      if (!current) return;
      var data = store();
      data[keyOf(current)] = { deleted: true };
      save(data);
      current.setAttribute("hidden", "hidden");
      del.classList.remove("is-on");
      state.refresh();
    });
  }

  /* ---------- الإقلاع ---------- */
  var params = new URLSearchParams(location.search);
  var wantsAdmin = params.has("admin");
  var isAdmin = false;
  try { isAdmin = localStorage.getItem(FLAG) === "1"; } catch (e) {}

  if (wantsAdmin && !isAdmin) {
    var entered = prompt("كلمة مرور التحرير:");
    if (entered === PASS) {
      try { localStorage.setItem(FLAG, "1"); } catch (e) {}
      isAdmin = true;
    } else if (entered !== null) {
      alert("كلمة المرور غير صحيحة.");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    apply();                       /* التعديلات المحفوظة تُطبَّق للجميع في هذا المتصفح */
    if (!isAdmin) return;
    var state = {};
    toolbar(state);
    enableEditing(state);
  });
})();
