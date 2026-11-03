/* ==========================================================================
   ZIQWEAR — shop / collection page
   Filters, sorting, URL state, load-more.
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI, I = UI.icons;
  var qs = UI.qs, qsa = UI.qsa, esc = UI.esc;

  var PER_PAGE = 12;
  var state = {
    category: null,
    sub: null,
    sizes: [],
    colors: [],
    min: null,
    max: null,
    inStock: false,
    sale: false,
    sort: "featured",
    page: 1,
    q: ""
  };

  /* ---------- url <-> state ---------- */
  /* Query-string values are attacker-controlled, so every one is clamped to a
     sane length and numeric filters are validated before they reach the DOM. */
  function str(v, max) { return String(v == null ? "" : v).slice(0, max || 60); }
  function num(v) { var n = parseFloat(v); return isFinite(n) && n >= 0 ? n : null; }

  function readURL() {
    var p = new URLSearchParams(location.search);
    state.category = p.get("c") ? str(p.get("c"), 60) : null;
    state.sub = p.get("sub") ? str(p.get("sub"), 60) : null;
    state.sort = str(p.get("sort") || "featured", 20);
    state.sale = p.get("sale") === "1";
    state.q = str(p.get("q"), 80);
    if (p.get("size")) state.sizes = str(p.get("size"), 200).split(",").slice(0, 12);
    if (p.get("color")) state.colors = str(p.get("color"), 200).split(",").slice(0, 12);
    if (p.get("min")) state.min = num(p.get("min"));
    if (p.get("max")) state.max = num(p.get("max"));
    if (p.get("stock") === "1") state.inStock = true;
  }

  function writeURL() {
    var p = new URLSearchParams();
    if (state.category) p.set("c", state.category);
    if (state.sub) p.set("sub", state.sub);
    if (state.sort !== "featured") p.set("sort", state.sort);
    if (state.sale) p.set("sale", "1");
    if (state.sizes.length) p.set("size", state.sizes.join(","));
    if (state.colors.length) p.set("color", state.colors.join(","));
    if (state.min != null) p.set("min", state.min);
    if (state.max != null) p.set("max", state.max);
    if (state.inStock) p.set("stock", "1");
    var q = p.toString();
    history.replaceState(null, "", location.pathname + (q ? "?" + q : ""));
  }

  /* ---------- filtering ---------- */
  function baseList() {
    var list = S.products({ includeInactive: false });
    if (state.category) {
      list = list.filter(function (p) {
        return p.category === state.category || p.subcategory === state.category;
      });
    }
    if (state.sub) list = list.filter(function (p) { return p.subcategory === state.sub; });
    if (state.sale) list = list.filter(function (p) { return p.discount > 0; });
    if (state.q) {
      var ids = S.search(state.q).map(function (p) { return p.id; });
      list = list.filter(function (p) { return ids.indexOf(p.id) > -1; });
    }
    return list;
  }

  function applyFilters(list) {
    return list.filter(function (p) {
      if (state.sizes.length && !state.sizes.some(function (s) { return (p.sizes || []).indexOf(s) > -1; })) return false;
      if (state.colors.length && !state.colors.some(function (c) { return (p.colors || []).indexOf(c) > -1; })) return false;
      if (state.min != null && p.price < state.min) return false;
      if (state.max != null && p.price > state.max) return false;
      if (state.inStock && !p.stock) return false;
      return true;
    });
  }

  function facetValues(list, key) {
    var counts = {};
    list.forEach(function (p) {
      (p[key] || []).forEach(function (v) { counts[v] = (counts[v] || 0) + 1; });
    });
    return Object.keys(counts).sort(function (a, b) {
      return counts[b] - counts[a];
    }).map(function (v) { return { value: v, count: counts[v] }; });
  }

  /* ---------- header text ---------- */
  function renderHead() {
    var cat = state.category ? S.category(state.category) : null;
    var sub = null;
    if (cat && state.sub) {
      sub = (cat.children || []).filter(function (k) { return k.sub === state.sub || k.slug === state.sub; })[0];
    }
    var title = sub ? sub.name : (cat ? cat.name : (state.sale ? "Sale" : "All Products"));
    qs("#shop-title").textContent = title;
    var total = baseList().length;
    qs("#shop-desc").textContent = state.sale
      ? "Final markdowns on selected pieces — while stock lasts."
      : (cat ? "Shop " + total + " pieces from " + (sub ? sub.name : cat.name) + "." : "Every piece in the ZIQWEAR wardrobe.");

    var crumb = '<a href="index.html">Home</a><span>/</span>';
    crumb += cat ? '<a href="shop.html">Shop</a><span>/</span>' : '<span>Shop</span>';
    if (cat) crumb += sub
      ? '<a href="shop.html?c=' + encodeURIComponent(cat.id) + '">' + esc(cat.name) + '</a><span>/</span><span>' + esc(sub.name) + '</span>'
      : '<span>' + esc(cat.name) + '</span>';
    qs("#crumb").innerHTML = crumb;
    document.title = title + " — " + S.settings.storeName;
  }

  /* ---------- filters UI ---------- */
  function renderFilters() {
    var host = qs("#filters");
    var pool = baseList();
    var cats = S.categories();
    var sizes = facetValues(pool, "sizes");
    var colors = facetValues(pool, "colors");
    var prices = pool.map(function (p) { return p.price; });
    var lo = prices.length ? Math.min.apply(null, prices) : 0;
    var hi = prices.length ? Math.max.apply(null, prices) : 10000;

    function group(title, body, closed) {
      return '<div class="filter-group' + (closed ? " is-closed" : "") + '">' +
        '<button class="filter-group__head" type="button">' + title + I.chevD + '</button>' +
        '<div class="filter-group__body">' + body + '</div></div>';
    }

    var catBody = cats.map(function (c) {
      var n = pool.filter(function (p) { return p.category === c.id; }).length;
      var on = state.category === c.id && !state.sub;
      var html = '<label class="check"><input type="radio" name="cat" value="' + esc(c.id) + '"' + (on ? " checked" : "") + '>' +
        '<span class="check__box">' + I.check + '</span><span>' + esc(c.name) + '</span>' +
        '<span class="check__count">' + n + '</span></label>';
      if (state.category === c.id && (c.children || []).length) {
        html += '<div style="padding-left:16px">' + c.children.map(function (k) {
          var kn = pool.filter(function (p) { return p.subcategory === k.sub; }).length;
          return '<label class="check"><input type="radio" name="sub" value="' + esc(k.sub) + '"' + (state.sub === k.sub ? " checked" : "") + '>' +
            '<span class="check__box">' + I.check + '</span><span style="font-size:12.5px">' + esc(k.name) + '</span>' +
            '<span class="check__count">' + kn + '</span></label>';
        }).join("") + '</div>';
      }
      return html;
    }).join("");
    catBody += '<label class="check"><input type="radio" name="cat" value=""' + (!state.category ? " checked" : "") + '>' +
      '<span class="check__box">' + I.check + '</span><span>All categories</span></label>';

    var sizeBody = sizes.length
      ? '<div class="size-grid">' + sizes.map(function (s) {
        return '<button class="size-chip' + (state.sizes.indexOf(s.value) > -1 ? " is-on" : "") + '" data-size="' + esc(s.value) + '">' + esc(s.value) + '</button>';
      }).join("") + '</div>'
      : '<p style="font-size:12px;color:var(--muted)">No size options here.</p>';

    var colorBody = colors.length
      ? '<div class="color-grid">' + colors.slice(0, 18).map(function (c) {
        return '<button class="color-chip' + (state.colors.indexOf(c.value) > -1 ? " is-on" : "") + '" data-color="' + esc(c.value) + '" title="' + esc(c.value) + '" style="background:' + UI.colorHex(c.value) + '"></button>';
      }).join("") + '</div>'
      : '<p style="font-size:12px;color:var(--muted)">No colour options here.</p>';

    var priceBody = '<div class="price-inputs">' +
      '<input type="number" placeholder="' + lo + '" id="price-min" value="' + (state.min != null ? state.min : "") + '">' +
      '<span>—</span>' +
      '<input type="number" placeholder="' + hi + '" id="price-max" value="' + (state.max != null ? state.max : "") + '">' +
      '</div><button class="btn btn--sm btn--ghost" style="width:100%;margin-top:10px" id="apply-price">Apply</button>';

    var stockBody = '<label class="check"><input type="checkbox" id="stock-only"' + (state.inStock ? " checked" : "") + '>' +
      '<span class="check__box">' + I.check + '</span><span>In stock only</span></label>';

    host.innerHTML = group("Category", catBody) + group("Size", sizeBody, true) +
      group("Colour", colorBody, true) + group("Price", priceBody, true) + group("Availability", stockBody, true) +
      '<button class="btn btn--ghost btn--sm btn--full" style="margin-top:20px" id="clear-filters">Clear all</button>';

    // collapse toggles
    qsa(".filter-group__head", host).forEach(function (b) {
      b.addEventListener("click", function () { b.parentElement.classList.toggle("is-closed"); });
    });

    qsa('input[name="cat"]', host).forEach(function (r) {
      r.addEventListener("change", function () {
        state.category = r.value || null;
        state.sub = null;
        state.page = 1;
        sync();
      });
    });
    qsa('input[name="sub"]', host).forEach(function (r) {
      r.addEventListener("change", function () {
        state.sub = r.value;
        state.page = 1;
        sync();
      });
    });
    qsa("[data-size]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.dataset.size;
        var i = state.sizes.indexOf(v);
        if (i > -1) state.sizes.splice(i, 1); else state.sizes.push(v);
        state.page = 1;
        sync();
      });
    });
    qsa("[data-color]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.dataset.color;
        var i = state.colors.indexOf(v);
        if (i > -1) state.colors.splice(i, 1); else state.colors.push(v);
        state.page = 1;
        sync();
      });
    });
    var applyPrice = qs("#apply-price", host);
    if (applyPrice) applyPrice.addEventListener("click", function () {
      var mn = qs("#price-min", host).value, mx = qs("#price-max", host).value;
      state.min = mn ? +mn : null;
      state.max = mx ? +mx : null;
      state.page = 1;
      sync();
    });
    var stockOnly = qs("#stock-only", host);
    if (stockOnly) stockOnly.addEventListener("change", function () {
      state.inStock = stockOnly.checked;
      state.page = 1;
      sync();
    });
    qs("#clear-filters", host).addEventListener("click", function () {
      state.sizes = []; state.colors = []; state.min = null; state.max = null;
      state.inStock = false; state.sale = false; state.category = null; state.sub = null; state.q = "";
      state.page = 1;
      sync();
    });
  }

  /* ---------- active filter pills ---------- */
  function renderPills() {
    var host = qs("#active-filters");
    var pills = [];
    if (state.category) {
      var c = S.category(state.category);
      pills.push({ label: c ? c.name : state.category, clear: function () { state.category = null; state.sub = null; } });
    }
    if (state.sub) {
      pills.push({ label: state.sub, clear: function () { state.sub = null; } });
    }
    state.sizes.forEach(function (s) {
      pills.push({ label: "Size " + s, clear: function () { state.sizes = state.sizes.filter(function (x) { return x !== s; }); } });
    });
    state.colors.forEach(function (c) {
      pills.push({ label: c, clear: function () { state.colors = state.colors.filter(function (x) { return x !== c; }); } });
    });
    if (state.min != null || state.max != null) {
      pills.push({
        label: (state.min != null ? UI.money(state.min) : "Any") + " – " + (state.max != null ? UI.money(state.max) : "Any"),
        clear: function () { state.min = null; state.max = null; }
      });
    }
    if (state.inStock) pills.push({ label: "In stock", clear: function () { state.inStock = false; } });
    if (state.sale) pills.push({ label: "On sale", clear: function () { state.sale = false; } });
    if (state.q) pills.push({ label: "“" + state.q + "”", clear: function () { state.q = ""; } });

    host.innerHTML = pills.map(function (p, i) {
      return '<span class="pill">' + esc(p.label) + '<button data-pill="' + i + '" aria-label="Remove filter">' + I.close + '</button></span>';
    }).join("");
    qsa("[data-pill]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        pills[+b.dataset.pill].clear();
        state.page = 1;
        sync();
      });
    });
  }

  /* ---------- grid ---------- */
  function renderGrid() {
    var filtered = applyFilters(baseList());
    filtered = S.sortList(filtered, state.sort);
    var shown = filtered.slice(0, state.page * PER_PAGE);
    var host = qs("#grid");

    qs("#shop-count").textContent = filtered.length
      ? "Showing " + shown.length + " of " + filtered.length + " pieces"
      : "";

    if (!filtered.length) {
      host.innerHTML = '<div class="empty-state"><h3>Nothing matches those filters</h3>' +
        '<p>Try widening your search or clearing a filter.</p>' +
        '<button class="btn btn--ghost" id="empty-clear">Clear filters</button></div>';
      qs("#empty-clear").addEventListener("click", function () {
        state.sizes = []; state.colors = []; state.min = null; state.max = null;
        state.inStock = false; state.sale = false; state.q = "";
        state.page = 1; sync();
      });
      qs("#load-more-wrap").innerHTML = "";
      return;
    }

    host.innerHTML = '<div class="pgrid">' + shown.map(function (p) { return UI.productCard(p); }).join("") + '</div>';
    UI.bindCards(host);

    var wrap = qs("#load-more-wrap");
    wrap.innerHTML = shown.length < filtered.length
      ? '<button class="btn btn--ghost" id="load-more">Load more (' + (filtered.length - shown.length) + ')</button>'
      : (filtered.length > PER_PAGE ? '<p style="font-size:12px;color:var(--muted)">You have seen everything.</p>' : "");
    var lm = qs("#load-more");
    if (lm) lm.addEventListener("click", function () {
      state.page++;
      renderGrid();
    });
  }

  /* ---------- sync ---------- */
  function sync() {
    writeURL();
    renderHead();
    renderFilters();
    renderPills();
    renderGrid();
    if (window.innerWidth <= 1024) {
      // keep filter drawer content fresh
      var f = qs("#filters");
      if (f && f.parentElement.id !== "filter-drawer-body") moveFilters(true);
    }
  }

  /* ---------- mobile filter drawer ---------- */
  var filtersHome = null;
  function moveFilters(intoDrawer) {
    var f = qs("#filters");
    var body = qs("#filter-drawer-body");
    if (!f || !body) return;
    if (intoDrawer) {
      if (!filtersHome) filtersHome = { parent: f.parentElement, next: f.nextSibling };
      body.appendChild(f);
    } else if (filtersHome) {
      filtersHome.parent.insertBefore(f, filtersHome.next);
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    UI.mount();
    readURL();
    qs("#sort").value = state.sort;
    qs("#sort").addEventListener("change", function () {
      state.sort = this.value;
      state.page = 1;
      sync();
    });

    var openBtn = qs("#open-filters");
    function checkMobile() {
      var m = window.innerWidth <= 1024;
      openBtn.style.display = m ? "inline-flex" : "none";
      if (!m) moveFilters(false);
    }
    openBtn.addEventListener("click", function () {
      moveFilters(true);
      qs("#filter-drawer").classList.add("is-open");
      document.body.classList.add("is-locked");
    });
    qsa("[data-close-filters]").forEach(function (b) {
      b.addEventListener("click", function () {
        qs("#filter-drawer").classList.remove("is-open");
        document.body.classList.remove("is-locked");
      });
    });
    window.addEventListener("resize", checkMobile);
    checkMobile();

    sync();
    UI.reveal();
  });
})();
