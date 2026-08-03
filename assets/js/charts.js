/* ==========================================================================
   ديم درون — مكتبة رسوم SVG خفيفة (بلا اعتماديات خارجية)
   القواعد المطبّقة هنا وليست اختيارية:
   · محور واحد فقط لكل رسم — لا محورين رأسيين.
   · ألوان السلاسل بترتيب ثابت لا يُدوَّر (--series-1..4).
   · الأعمدة ≤ 24px سماكة، طرف البيانات بزاوية 4px والقاعدة مربعة.
   · الخطوط 2px، النقاط r ≥ 4 مع حلقة 2px بلون السطح.
   · فجوة 2px بلون السطح بين الشرائح المتلاصقة.
   · تلميح تفاعلي افتراضي + جدول بديل إلزامي.
   · النص لا يرتدي لون البيانات إطلاقًا — الشكل الملوّن بجانبه هو حامل الهوية.
   ========================================================================== */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];

  /* ---------- أدوات ---------- */
  function el(name, attrs, style) {
    var node = document.createElementNS(NS, name);
    if (attrs) for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
    if (style) node.setAttribute("style", style);
    return node;
  }
  function txt(node, s) { node.textContent = s; return node; }
  function fmt(n, digits) {
    if (n === null || n === undefined || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: digits === undefined ? 0 : digits });
  }
  function niceTicks(min, max, count) {
    var span = (max - min) || 1;
    var raw = span / (count || 4);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var out = [];
    for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  /* مستطيل بطرف بيانات مستدير 4px وقاعدة مربعة */
  function barPath(x, y, w, h, r, side) {
    r = Math.max(0, Math.min(r, side === "right" || side === "left" ? w : h, (side === "right" || side === "left" ? h : w) / 2));
    if (side === "left") {                       // ينمو من اليمين إلى اليسار (قاعدة يمين)
      var tip = x;
      return "M" + (x + w) + " " + y + "H" + (tip + r) + "a" + r + " " + r + " 0 0 0 " + (-r) + " " + r +
             "V" + (y + h - r) + "a" + r + " " + r + " 0 0 0 " + r + " " + r + "H" + (x + w) + "Z";
    }
    if (side === "right") {                      // ينمو من اليسار إلى اليمين
      return "M" + x + " " + y + "H" + (x + w - r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r +
             "V" + (y + h - r) + "a" + r + " " + r + " 0 0 1 " + (-r) + " " + r + "H" + x + "Z";
    }
    /* up: ينمو لأعلى من قاعدة سفلية */
    return "M" + x + " " + (y + h) + "V" + (y + r) + "a" + r + " " + r + " 0 0 1 " + r + " " + (-r) +
           "H" + (x + w - r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r + "V" + (y + h) + "Z";
  }

  /* ---------- الغلاف: عنوان + وسيلة إيضاح + لوحة + جدول ---------- */
  function buildShell(host, cfg) {
    host.classList.add("viz");
    host.innerHTML = "";

    var head = document.createElement("div");
    head.className = "viz__head";
    var titles = document.createElement("div");
    var h = document.createElement("h3");
    h.className = "viz__title";
    h.textContent = cfg.title;
    titles.appendChild(h);
    if (cfg.subtitle) {
      var p = document.createElement("p");
      p.className = "viz__sub";
      p.textContent = cfg.subtitle;
      titles.appendChild(p);
    }
    head.appendChild(titles);

    var actions = document.createElement("div");
    actions.className = "viz__actions";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "viz__btn";
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "عرض كجدول";
    btn.addEventListener("click", function () {
      var on = host.classList.toggle("is-table");
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? "عرض كرسم" : "عرض كجدول";
    });
    actions.appendChild(btn);
    head.appendChild(actions);
    host.appendChild(head);

    /* وسيلة الإيضاح: إلزامية عند سلسلتين فأكثر، ممنوعة لسلسلة واحدة */
    if (cfg.legend && cfg.legend.length > 1) {
      var lg = document.createElement("div");
      lg.className = "viz__legend";
      cfg.legend.forEach(function (item) {
        var s = document.createElement("span");
        var key = document.createElement("i");
        key.className = "viz__key" + (item.shape === "line" ? " viz__key--line" : "");
        key.setAttribute("style", "background:" + item.color);
        s.appendChild(key);
        s.appendChild(document.createTextNode(item.label));
        lg.appendChild(s);
      });
      host.appendChild(lg);
    }

    var plot = document.createElement("div");
    plot.className = "viz__plot";
    var tip = document.createElement("div");
    tip.className = "viz__tip";
    tip.setAttribute("role", "status");
    plot.appendChild(tip);
    host.appendChild(plot);

    var tableBox = document.createElement("div");
    tableBox.className = "viz__table";
    tableBox.innerHTML = '<div class="table-wrap"></div>';
    host.appendChild(tableBox);

    if (cfg.footnote) {
      var f = document.createElement("p");
      f.className = "viz__foot";
      f.textContent = cfg.footnote;
      host.appendChild(f);
    }
    return { plot: plot, tip: tip, table: tableBox.firstChild };
  }

  function renderTable(mount, head, rows) {
    var t = document.createElement("table");
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    head.forEach(function (c, i) {
      var th = document.createElement("th");
      th.textContent = c;
      if (i > 0) th.className = "num";
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tb = document.createElement("tbody");
    rows.forEach(function (r) {
      var row = document.createElement("tr");
      r.forEach(function (c, i) {
        var td = document.createElement("td");
        td.textContent = c;
        if (i > 0) td.className = "num";
        row.appendChild(td);
      });
      tb.appendChild(row);
    });
    t.appendChild(tb);
    mount.innerHTML = "";
    mount.appendChild(t);
  }

  function showTip(tip, plot, x, y, html) {
    tip.innerHTML = html;
    var w = plot.clientWidth;
    var tw = tip.offsetWidth || 140;
    var left = Math.max(tw / 2 + 2, Math.min(w - tw / 2 - 2, x));
    tip.style.left = left + "px";
    tip.style.top = Math.max(tip.offsetHeight + 4, y - 10) + "px";
    tip.classList.add("is-on");
  }
  function hideTip(tip) { tip.classList.remove("is-on"); }
  function tipRow(color, label, value) {
    return '<div class="row"><i style="background:' + color + '"></i><span>' + label + "</span><em>" + value + "</em></div>";
  }

  function autoRender(host, draw) {
    var raf = null;
    function go() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () { draw(); });
    }
    go();
    if (global.ResizeObserver) {
      var last = host.clientWidth;
      new ResizeObserver(function () {
        if (Math.abs(host.clientWidth - last) > 6) { last = host.clientWidth; go(); }
      }).observe(host);
    } else {
      global.addEventListener("resize", go);
    }
  }

  /* ======================================================================
     1) رسم خطي — الزمن يسير يسارًا ← يمينًا (العرف في لوحات BI)
     cfg: { title, subtitle, labels[], series:[{name, values[], dashed?}],
            unit, yMin, yMax, markers?:[{index,label}], footnote }
     ====================================================================== */
  function lineChart(host, cfg) {
    var parts = buildShell(host, {
      title: cfg.title, subtitle: cfg.subtitle, footnote: cfg.footnote,
      legend: cfg.series.map(function (s, i) {
        return { label: s.name, color: SERIES[i % SERIES.length], shape: "line" };
      })
    });

    renderTable(parts.table,
      [cfg.xTitle || "الفترة"].concat(cfg.series.map(function (s) { return s.name + (cfg.unit ? " (" + cfg.unit + ")" : ""); })),
      cfg.labels.map(function (l, i) {
        return [l].concat(cfg.series.map(function (s) { return fmt(s.values[i], 1); }));
      }));

    autoRender(host, function () {
      var W = Math.max(280, parts.plot.clientWidth);
      var H = cfg.height || 300;
      var pad = { t: 14, r: 16, b: 34, l: 42 };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;

      var all = cfg.series.reduce(function (a, s) { return a.concat(s.values); }, []).filter(function (v) { return v !== null; });
      var lo = cfg.yMin !== undefined ? cfg.yMin : Math.min.apply(null, all);
      var hi = cfg.yMax !== undefined ? cfg.yMax : Math.max.apply(null, all);
      var ticks = niceTicks(lo, hi, 4);
      var y0 = Math.min(ticks[0], lo), y1 = Math.max(ticks[ticks.length - 1], hi);
      var X = function (i) { return pad.l + (cfg.labels.length === 1 ? iw / 2 : (iw * i) / (cfg.labels.length - 1)); };
      var Y = function (v) { return pad.t + ih - ((v - y0) / (y1 - y0)) * ih; };

      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img" });
      svg.appendChild(txt(el("title"), cfg.title));

      /* نطاق مُظلَّل اختياري (مثال: نطاق "ممتاز") */
      if (cfg.band) {
        svg.appendChild(el("rect", {
          x: pad.l, y: Y(Math.min(cfg.band[1], y1)), width: iw,
          height: Math.max(0, Y(Math.max(cfg.band[0], y0)) - Y(Math.min(cfg.band[1], y1))), class: "g-band"
        }));
      }

      ticks.forEach(function (t) {
        var y = Y(t);
        if (y < pad.t - 1 || y > pad.t + ih + 1) return;
        svg.appendChild(el("line", { x1: pad.l, x2: pad.l + iw, y1: y, y2: y, class: "g-grid" }));
        var lab = el("text", { x: pad.l - 8, y: y + 4, "text-anchor": "end", class: "g-tick" });
        svg.appendChild(txt(lab, fmt(t)));
      });
      svg.appendChild(el("line", { x1: pad.l, x2: pad.l + iw, y1: pad.t + ih, y2: pad.t + ih, class: "g-axis" }));

      /* تسميات المحور الأفقي — تُخفَّف تلقائيًا لمنع التصادم */
      var every = Math.max(1, Math.ceil((cfg.labels.length * 46) / iw));
      cfg.labels.forEach(function (l, i) {
        if (i % every !== 0 && i !== cfg.labels.length - 1) return;
        var t = el("text", { x: X(i), y: pad.t + ih + 20, "text-anchor": "middle", class: "g-tick" });
        svg.appendChild(txt(t, l));
      });

      /* السلاسل */
      cfg.series.forEach(function (s, si) {
        var color = SERIES[si % SERIES.length];
        var d = "";
        s.values.forEach(function (v, i) {
          if (v === null || v === undefined) return;
          d += (d ? "L" : "M") + X(i) + " " + Y(v);
        });
        if (si === 0 && cfg.area !== false) {
          var af = d + "L" + X(s.values.length - 1) + " " + (pad.t + ih) + "L" + X(0) + " " + (pad.t + ih) + "Z";
          svg.appendChild(el("path", { d: af }, "fill:" + color + ";opacity:.10"));
        }
        svg.appendChild(el("path", {
          d: d, fill: "none", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round",
          "stroke-dasharray": s.dashed ? "6 5" : null
        }, "stroke:" + color));

        /* نقطة النهاية + قيمة مباشرة (تسمية انتقائية لا على كل نقطة) */
        var lastI = s.values.length - 1;
        if (s.values[lastI] !== null && s.values[lastI] !== undefined) {
          svg.appendChild(el("circle", {
            cx: X(lastI), cy: Y(s.values[lastI]), r: 5, "stroke-width": 2
          }, "fill:" + color + ";stroke:var(--surface-1)"));
          if (si === 0) {
            var vl = el("text", { x: X(lastI) - 9, y: Y(s.values[lastI]) - 11, "text-anchor": "end", class: "g-value" });
            svg.appendChild(txt(vl, fmt(s.values[lastI], 1)));
          }
        }
      });

      /* علامات الزيارات على المحور */
      (cfg.markers || []).forEach(function (m) {
        svg.appendChild(el("line", {
          x1: X(m.index), x2: X(m.index), y1: pad.t + ih, y2: pad.t + ih + 6, class: "g-axis"
        }));
        svg.appendChild(el("circle", { cx: X(m.index), cy: pad.t + ih, r: 3.5, "stroke-width": 2 },
          "fill:var(--ink-muted);stroke:var(--surface-1)"));
      });

      /* طبقة التفاعل: خط تتبّع + تلميح */
      var cross = el("line", { y1: pad.t, y2: pad.t + ih, class: "g-crosshair", opacity: 0 });
      svg.appendChild(cross);
      var dots = el("g", { opacity: 0 });
      cfg.series.forEach(function (s, si) {
        dots.appendChild(el("circle", { r: 5, "stroke-width": 2 },
          "fill:" + SERIES[si % SERIES.length] + ";stroke:var(--surface-1)"));
      });
      svg.appendChild(dots);

      var hit = el("rect", { x: pad.l, y: pad.t, width: iw, height: ih, class: "g-hit" });
      svg.appendChild(hit);

      function move(ev) {
        var r = svg.getBoundingClientRect();
        var px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
        var idx = Math.round(((px - pad.l) / iw) * (cfg.labels.length - 1));
        idx = Math.max(0, Math.min(cfg.labels.length - 1, idx));
        var x = X(idx);
        cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("opacity", 1);
        dots.setAttribute("opacity", 1);
        var html = "<b>" + cfg.labels[idx] + "</b>";
        cfg.series.forEach(function (s, si) {
          var c = dots.childNodes[si], v = s.values[idx];
          if (v === null || v === undefined) { c.setAttribute("opacity", 0); return; }
          c.setAttribute("opacity", 1);
          c.setAttribute("cx", x); c.setAttribute("cy", Y(v));
          html += tipRow(SERIES[si % SERIES.length], s.name, fmt(v, 1) + (cfg.unit ? " " + cfg.unit : ""));
        });
        var mk = (cfg.markers || []).filter(function (m) { return m.index === idx; })[0];
        if (mk) html += '<div class="row"><span>' + mk.label + "</span></div>";
        showTip(parts.tip, parts.plot, x, Y(cfg.series[0].values[idx] || y0), html);
      }
      hit.addEventListener("mousemove", move);
      hit.addEventListener("touchstart", move, { passive: true });
      hit.addEventListener("touchmove", move, { passive: true });
      ["mouseleave", "touchend"].forEach(function (e) {
        hit.addEventListener(e, function () {
          cross.setAttribute("opacity", 0); dots.setAttribute("opacity", 0); hideTip(parts.tip);
        });
      });

      var old = parts.plot.querySelector("svg");
      if (old) old.remove();
      parts.plot.appendChild(svg);
    });
  }

  /* ======================================================================
     2) أعمدة أفقية — سلسلة واحدة، تنمو من اليمين (اتجاه القراءة العربي)
     cfg: { title, subtitle, items:[{label, value, color?}], unit, max, footnote }
     ====================================================================== */
  function barChart(host, cfg) {
    var parts = buildShell(host, {
      title: cfg.title, subtitle: cfg.subtitle, footnote: cfg.footnote,
      legend: cfg.legend || null
    });
    renderTable(parts.table, [cfg.xTitle || "البند", (cfg.valueTitle || "القيمة") + (cfg.unit ? " (" + cfg.unit + ")" : "")],
      cfg.items.map(function (it) { return [it.label, fmt(it.value, 1)]; }));

    autoRender(host, function () {
      var W = Math.max(280, parts.plot.clientWidth);
      var rowH = 44, barH = Math.min(24, rowH - 20);
      var H = cfg.items.length * rowH + 12;
      /* تسمية الفئة على اليمين (بداية السطر عربيًا)، والقيمة عند طرف العمود يسارًا */
      var labelW = cfg.labelWidth || 92, valueW = 54;
      var trackX = valueW, trackW = Math.max(60, W - labelW - valueW);
      var baseX = trackX + trackW;   /* قاعدة الأعمدة: الحافة اليمنى للمسار */
      var max = cfg.max !== undefined ? cfg.max : Math.max.apply(null, cfg.items.map(function (i) { return i.value; }));

      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img" });
      svg.appendChild(txt(el("title"), cfg.title));

      cfg.items.forEach(function (it, i) {
        var y = i * rowH + 6;
        var cy = y + rowH / 2 - 6;
        var color = it.color || SERIES[0];
        var w = Math.max(2, (Math.max(0, it.value) / max) * trackW);

        /* التسمية خارج المسار على اليمين */
        var lab = el("text", { x: baseX + 10, y: cy + 4, "text-anchor": "start", class: "g-label" });
        svg.appendChild(txt(lab, it.label));

        /* مسار فارغ خفيف ثم العمود ينمو من اليمين لليسار */
        svg.appendChild(el("rect", {
          x: trackX, y: cy - barH / 2, width: trackW, height: barH, rx: 4
        }, "fill:var(--ink-1);opacity:.04"));

        var bar = el("path", {
          d: barPath(baseX - w, cy - barH / 2, w, barH, 4, "left")
        }, "fill:" + color);
        bar.style.cursor = "pointer";
        svg.appendChild(bar);

        /* القيمة خارج الطرف — لا نضع رقمًا داخل عمود ملوّن */
        var v = el("text", { x: baseX - w - 8, y: cy + 4, "text-anchor": "end", class: "g-value" });
        svg.appendChild(txt(v, fmt(it.value, 1) + (cfg.unitInline ? " " + cfg.unit : "")));

        var hit = el("rect", { x: 0, y: y, width: W, height: rowH - 4, class: "g-hit" });
        hit.addEventListener("mousemove", function (ev) {
          var r = svg.getBoundingClientRect();
          showTip(parts.tip, parts.plot, (ev.clientX - r.left), cy,
            "<b>" + it.label + "</b>" + tipRow(color, cfg.valueTitle || "القيمة", fmt(it.value, 1) + (cfg.unit ? " " + cfg.unit : "")) +
            (it.note ? '<div class="row"><span>' + it.note + "</span></div>" : ""));
        });
        hit.addEventListener("mouseleave", function () { hideTip(parts.tip); });
        svg.appendChild(hit);
      });

      var old = parts.plot.querySelector("svg");
      if (old) old.remove();
      parts.plot.appendChild(svg);
    });
  }

  /* ======================================================================
     3) أعمدة أفقية مكدّسة — فجوة 2px بلون السطح بين الشرائح
     cfg: { title, subtitle, categories[], series:[{name, values[]}], unit }
     ====================================================================== */
  function stackedChart(host, cfg) {
    var parts = buildShell(host, {
      title: cfg.title, subtitle: cfg.subtitle, footnote: cfg.footnote,
      legend: cfg.series.map(function (s, i) { return { label: s.name, color: SERIES[i % SERIES.length] }; })
    });
    renderTable(parts.table,
      [cfg.xTitle || "الجهة"].concat(cfg.series.map(function (s) { return s.name; })).concat(["الإجمالي"]),
      cfg.categories.map(function (c, i) {
        var vals = cfg.series.map(function (s) { return s.values[i]; });
        return [c].concat(vals.map(function (v) { return fmt(v, 1); }))
                  .concat([fmt(vals.reduce(function (a, b) { return a + b; }, 0), 1)]);
      }));

    autoRender(host, function () {
      var W = Math.max(280, parts.plot.clientWidth);
      var rowH = 46, barH = Math.min(24, rowH - 20), GAP = 2;
      var H = cfg.categories.length * rowH + 12;
      var labelW = cfg.labelWidth || 92, valueW = 54;
      var trackX = valueW, trackW = Math.max(60, W - labelW - valueW);
      var baseX = trackX + trackW;
      var totals = cfg.categories.map(function (_, i) {
        return cfg.series.reduce(function (a, s) { return a + s.values[i]; }, 0);
      });
      var max = cfg.max !== undefined ? cfg.max : Math.max.apply(null, totals);

      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img" });
      svg.appendChild(txt(el("title"), cfg.title));

      cfg.categories.forEach(function (cat, i) {
        var y = i * rowH + 6, cy = y + rowH / 2 - 6;
        var lab = el("text", { x: baseX + 10, y: cy + 4, "text-anchor": "start", class: "g-label" });
        svg.appendChild(txt(lab, cat));

        var cursor = baseX;   /* يبدأ من اليمين */
        cfg.series.forEach(function (s, si) {
          var raw = (s.values[i] / max) * trackW;
          if (raw <= 0) { cursor -= raw; return; }
          /* آخر شريحة فقط تحمل الطرف المستدير؛ القاعدة (يمين) تبقى مربعة.
             الفجوة 2px بلون السطح هي الفاصل بين الشرائح — لا حدود مرسومة. */
          var isLast = si === cfg.series.length - 1;
          var w = Math.max(1, raw - (isLast ? 0 : GAP));
          var x = cursor - w;
          var d = isLast
            ? barPath(x, cy - barH / 2, w, barH, 4, "left")
            : "M" + x + " " + (cy - barH / 2) + "h" + w + "v" + barH + "h" + (-w) + "Z";
          var seg = el("path", { d: d }, "fill:" + SERIES[si % SERIES.length]);
          svg.appendChild(seg);

          var hit = el("rect", { x: x, y: cy - barH / 2 - 6, width: w, height: barH + 12, class: "g-hit" });
          hit.addEventListener("mousemove", function (ev) {
            var r = svg.getBoundingClientRect();
            showTip(parts.tip, parts.plot, ev.clientX - r.left, cy,
              "<b>" + cat + "</b>" +
              tipRow(SERIES[si % SERIES.length], s.name, fmt(s.values[i], 1) + (cfg.unit ? " " + cfg.unit : "")) +
              '<div class="row"><span>الإجمالي</span><em>' + fmt(totals[i], 1) + "</em></div>");
          });
          hit.addEventListener("mouseleave", function () { hideTip(parts.tip); });
          svg.appendChild(hit);

          cursor -= raw;
        });

        /* الإجمالي عند الطرف — لا نضع رقمًا داخل شريحة داخلية، فوسيلة الإيضاح والتلميح يحملانها */
        var tv = el("text", { x: baseX - (totals[i] / max) * trackW - 8, y: cy + 4, "text-anchor": "end", class: "g-value" });
        svg.appendChild(txt(tv, fmt(totals[i], 1)));
      });

      var old = parts.plot.querySelector("svg");
      if (old) old.remove();
      parts.plot.appendChild(svg);
    });
  }

  /* ======================================================================
     4) خط مصغّر (sparkline) — للمعاينة في الصفحة الرئيسية، بلا محاور
     ====================================================================== */
  function sparkline(host, values, opts) {
    opts = opts || {};
    function draw() {
      var W = Math.max(120, host.clientWidth), H = opts.height || 60;
      var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
      var pad = 6;
      var X = function (i) { return pad + ((W - pad * 2) * i) / (values.length - 1); };
      var Y = function (v) { return pad + (H - pad * 2) * (1 - (v - lo) / ((hi - lo) || 1)); };
      var d = values.map(function (v, i) { return (i ? "L" : "M") + X(i) + " " + Y(v); }).join("");
      var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, "aria-hidden": "true" });
      svg.appendChild(el("path", { d: d + "L" + X(values.length - 1) + " " + H + "L" + X(0) + " " + H + "Z" },
        "fill:" + (opts.color || SERIES[0]) + ";opacity:.12"));
      svg.appendChild(el("path", { d: d, fill: "none", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" },
        "stroke:" + (opts.color || SERIES[0])));
      svg.appendChild(el("circle", { cx: X(values.length - 1), cy: Y(values[values.length - 1]), r: 4, "stroke-width": 2 },
        "fill:" + (opts.color || SERIES[0]) + ";stroke:var(--surface-1)"));
      host.innerHTML = "";
      host.appendChild(svg);
    }
    autoRender(host, draw);
  }

  global.DeemCharts = {
    line: lineChart,
    bars: barChart,
    stacked: stackedChart,
    spark: sparkline,
    palette: SERIES,
    format: fmt
  };
})(window);
