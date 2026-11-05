/* ==========================================================================
   ZIQWEAR — product detail page
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI, I = UI.icons;
  var qs = UI.qs, qsa = UI.qsa, esc = UI.esc;

  var product = null;
  var sel = { color: "", size: "", qty: 1, image: 0 };

  /* ---------- render ---------- */
  function render() {
    var p = product;
    var imgs = (p.images && p.images.length) ? p.images : ["assets/img/placeholder.jpg"];
    var cat = S.category(p.category);
    var catName = cat ? cat.name : p.category;
    var href = "shop.html?c=" + encodeURIComponent(p.category);

    qs("#crumb").innerHTML =
      '<a href="index.html">Home</a><span>/</span>' +
      '<a href="' + href + '">' + esc(catName) + '</a><span>/</span>' +
      '<span>' + esc(p.title) + '</span>';

    var stars = "";
    var rating = Number(p.rating) > 0 ? Math.min(5, Number(p.rating)) : 5;
    var full = Math.round(rating);
    for (var i = 0; i < 5; i++) {
      stars += '<span style="opacity:' + (i < full ? 1 : 0.25) + '">' + I.star + '</span>';
    }

    qs("#pdp").innerHTML =
      '<div class="gallery">' +
        '<div class="gallery__thumbs">' + imgs.map(function (src, i) {
          return '<img class="gallery__thumb' + (i === 0 ? " is-on" : "") + '" src="' + esc(src) + '" data-thumb="' + i + '" alt="">';
        }).join("") + '</div>' +
        '<div class="gallery__main" data-zoom>' +
          '<img id="main-img" src="' + esc(imgs[0]) + '" alt="' + esc(p.title) + '">' +
          '<span class="gallery__zoom-hint">' + I.zoom + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="pdp__info">' +
        '<p class="pdp__cat">' + esc(catName) + (p.subcategory ? " · " + esc(p.subcategory) : "") + '</p>' +
        '<h1 class="pdp__title">' + esc(p.title) + '</h1>' +
        '<div class="pdp__rating"><span class="stars">' + stars + '</span>' +
          '<span>' + rating.toFixed(1) + ' · ' + (Number(p.reviews) || 0) + ' reviews</span>' +
          (p.sold ? '<span>· ' + p.sold + ' sold</span>' : '') + '</div>' +
        '<div class="pdp__price"><span>' + UI.money(p.price) + '</span>' +
          (p.compareAt && p.compareAt > p.price ? '<s>' + UI.money(p.compareAt) + '</s><span class="off">Save ' + p.discount + '%</span>' : '') +
        '</div>' +
        '<p class="pdp__tax">Tax included. Shipping calculated at checkout.</p>' +
        '<p class="pdp__desc">' + esc(p.description) + '</p>' +

        (p.colors && p.colors.length ? '<div class="opt"><div class="opt__head">' +
          '<span class="opt__label">Colour: <b data-color-name>' + esc(p.colors[0]) + '</b></span></div>' +
          '<div class="color-list">' + p.colors.map(function (c, i) {
            return '<button class="color-opt' + (i === 0 ? " is-on" : "") + '" data-color="' + esc(c) + '" title="' + esc(c) + '" style="background:' + UI.colorHex(c) + '"></button>';
          }).join("") + '</div></div>' : '') +

        (p.sizes && p.sizes.length ? '<div class="opt"><div class="opt__head">' +
          '<span class="opt__label">Size: <b data-size-name>' + esc(p.sizes[0]) + '</b></span>' +
          '<button class="opt__guide" id="open-size">Size guide</button></div>' +
          '<div class="size-list">' + p.sizes.map(function (s, i) {
            return '<button class="size-opt' + (i === 0 ? " is-on" : "") + '" data-size="' + esc(s) + '">' + esc(s) + '</button>';
          }).join("") + '</div></div>' : '') +

        '<div class="pdp__actions">' +
          '<div class="pdp__qty"><div class="qty">' +
            '<button data-qty="-1" aria-label="Decrease">' + I.minus + '</button>' +
            '<input type="number" id="qty" value="1" min="1" max="' + (p.stock || 1) + '">' +
            '<button data-qty="1" aria-label="Increase">' + I.plus + '</button>' +
          '</div></div>' +
          '<button class="btn" id="add">' + (p.stock ? "Add to bag" : "Sold out") + '</button>' +
        '</div>' +
        '<button class="btn btn--ghost btn--full" id="buy" style="margin-top:10px"' + (p.stock ? "" : " disabled") + '>Buy it now</button>' +
        '<a class="btn btn--ghost btn--full wa-btn" id="wa-order" style="margin-top:10px" target="_blank" rel="noopener" href="#">' +
          I.whatsapp + ' Order on WhatsApp</a>' +

        '<div class="pdp__meta">' +
          '<div class="meta-row">' + I.truck + '<span><b>Free delivery</b> on orders above ' + UI.money(S.settings.freeShipping) + '</span></div>' +
          '<div class="meta-row">' + I.cash + '<span><b>Cash on delivery</b> available nationwide</span></div>' +
          '<div class="meta-row">' + I.ret + '<span><b>7-day exchange</b> if the size is wrong</span></div>' +
        '</div>' +

        '<div class="accordion">' +
          acc("Description", "<p>" + esc(p.description) + "</p>" +
            (p.details && p.details.length ? '<ul>' + p.details.map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul>" : ""), true) +
          acc("Fabric &amp; Care", "<ul><li>Premium milled fabric, pre-shrunk</li><li>Cold machine wash, inside out</li><li>Do not tumble dry — line dry in shade</li><li>Warm iron on reverse if needed</li></ul>") +
          acc("Shipping &amp; Returns", "<p>Orders are dispatched within 24 hours on working days. Delivery takes 2–4 working days nationwide. Cash on delivery is available on every order.</p><p>Exchanges accepted within 7 days of delivery, unworn and with tags attached.</p>") +
        '</div>' +
      '</div>';

    bind();
    renderSticky();
    renderSections();
    renderRelated();
  }

  function acc(title, inner, open) {
    return '<div class="acc' + (open ? " is-open" : "") + '">' +
      '<button class="acc__head">' + title + I.plus + '</button>' +
      '<div class="acc__body"><div><div class="acc__inner">' + inner + '</div></div></div></div>';
  }

  /* ---------- interactions ---------- */
  function bind() {
    var imgs = product.images;
    qsa("[data-thumb]").forEach(function (t) {
      t.addEventListener("click", function () {
        var i = +t.dataset.thumb;
        sel.image = i;
        qsa("[data-thumb]").forEach(function (x) { x.classList.remove("is-on"); });
        t.classList.add("is-on");
        var main = qs("#main-img");
        main.style.opacity = 0;
        setTimeout(function () {
          main.src = imgs[i];
          main.style.opacity = 1;
        }, 150);
      });
    });

    qsa("[data-color]").forEach(function (b) {
      b.addEventListener("click", function () {
        qsa("[data-color]").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        sel.color = b.dataset.color;
        var nm = qs("[data-color-name]");
        if (nm) nm.textContent = sel.color;
        updateWA();
      });
    });
    qsa("[data-size]").forEach(function (b) {
      b.addEventListener("click", function () {
        qsa("[data-size]").forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        sel.size = b.dataset.size;
        var nm = qs("[data-size-name]");
        if (nm) nm.textContent = sel.size;
        updateWA();
      });
    });

    qsa("[data-qty]").forEach(function (b) {
      b.addEventListener("click", function () {
        var input = qs("#qty");
        var v = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.dataset.qty, 10));
        v = Math.min(v, product.stock || 99);
        input.value = v;
        sel.qty = v;
        updateWA();
      });
    });

    qsa(".acc__head").forEach(function (b) {
      b.addEventListener("click", function () { b.parentElement.classList.toggle("is-open"); });
    });

    qs("#add").addEventListener("click", function () { add(false); });
    qs("#buy").addEventListener("click", function () { add(true); });
    var qtyInput = qs("#qty");
    if (qtyInput) qtyInput.addEventListener("change", function () {
      sel.qty = Math.max(1, Math.min(parseInt(qtyInput.value, 10) || 1, product.stock || 99));
      qtyInput.value = sel.qty;
      updateWA();
    });
    updateWA();

    var zoom = qs("[data-zoom]");
    if (zoom) zoom.addEventListener("click", function () {
      var lb = qs("#lightbox");
      qs("#lb-img").src = product.images[sel.image] || product.images[0];
      lb.style.display = "grid";
      document.body.classList.add("is-locked");
    });
    qs("#lb-close").addEventListener("click", closeLightbox);
    qs("#lightbox").addEventListener("click", function (e) {
      if (e.target.id === "lightbox") closeLightbox();
    });

    var openSize = qs("#open-size");
    if (openSize) openSize.addEventListener("click", openSizeModal);
    qs("#size-close").addEventListener("click", closeSizeModal);
    qs("#size-modal").addEventListener("click", function (e) {
      if (e.target.id === "size-modal") closeSizeModal();
    });
  }

  /* WhatsApp order message built from the current selection. */
  function updateWA() {
    var a = qs("#wa-order");
    if (!a) return;
    var p = product;
    var opt = [sel.color, sel.size].filter(Boolean).join(" / ");
    var msg = "Hi " + S.settings.storeName + "! I want to order:\n\n" +
      p.title + (opt ? " (" + opt + ")" : "") + "\n" +
      "Qty: " + sel.qty + "\n" +
      "Price: " + UI.money(p.price * sel.qty) + "\n" +
      "Link: " + location.origin + location.pathname.replace(/[^/]*$/, "") +
        "product.html?p=" + encodeURIComponent(p.handle) + "\n\n" +
      "Name: \nAddress: \nCity: ";
    a.href = UI.waLink(msg);
    a.style.display = p.stock ? "" : "none";
  }

  function closeLightbox() {
    qs("#lightbox").style.display = "none";
    document.body.classList.remove("is-locked");
  }

  function openSizeModal() {
    var rows = [
      ["S", "38–40", "27", "24"],
      ["M", "40–42", "28", "24.5"],
      ["L", "42–44", "29", "25"],
      ["XL", "44–46", "30", "25.5"],
      ["2XL", "46–48", "31", "26"]
    ];
    qs("#size-table").innerHTML = rows.map(function (r) {
      return '<tr style="border-bottom:1px solid var(--line-soft)">' +
        r.map(function (c) { return '<td style="padding:9px 0">' + c + '</td>'; }).join("") + '</tr>';
    }).join("");
    qs("#size-modal").style.display = "grid";
    document.body.classList.add("is-locked");
  }

  function closeSizeModal() {
    qs("#size-modal").style.display = "none";
    document.body.classList.remove("is-locked");
  }

  function add(buyNow) {
    if (!product.stock) { UI.toast("This piece is sold out"); return; }
    var qty = parseInt(qs("#qty").value, 10) || 1;
    S.addToCart(product, {
      color: sel.color || (product.colors || [])[0] || "",
      size: sel.size || (product.sizes || [])[0] || "",
      qty: qty
    });
    if (buyNow) { location.href = "checkout.html"; return; }
    UI.toast("Added to bag");
    UI.openCart();
  }

  /* ---------- sticky mobile bar ---------- */
  function renderSticky() {
    var host = qs("#sticky-buy");
    var p = product;
    host.innerHTML =
      '<img src="' + esc(p.images[0]) + '" alt="">' +
      '<div class="sticky-buy__t"><p>' + esc(p.title) + '</p><span>' + UI.money(p.price) + '</span></div>' +
      '<button class="btn btn--sm" id="sticky-add"' + (p.stock ? "" : " disabled") + '>' + (p.stock ? "Add to bag" : "Sold out") + '</button>';
    var b = qs("#sticky-add");
    if (b) b.addEventListener("click", function () { add(false); });

    var info = qs(".pdp__info");
    var actions = qs(".pdp__actions");
    if (!info || !actions) return;
    window.addEventListener("scroll", function () {
      var r = actions.getBoundingClientRect();
      host.classList.toggle("is-visible", r.bottom < 0);
    }, { passive: true });
  }

  /* ---------- related ---------- */
  function renderRelated() {
    var host = qs("#related");
    var list = S.related(product, 4);
    if (!list.length) { host.innerHTML = ""; return; }
    host.innerHTML = '<div class="wrap">' +
      '<div class="section-head"><div><p class="eyebrow">Goes with it</p><h2>You may also <em>like</em></h2></div></div>' +
      '<div class="pgrid">' + list.map(function (p) { return UI.productCard(p); }).join("") + '</div></div>';
    UI.bindCards(host);
  }

  /* ---------- owner-built page sections ----------
     Key features, material, performance and style are filled in per product
     under /admin.html → Products → Edit. A block that was left empty renders
     nothing, so products that have not been written up yet keep the page
     exactly as it was. */

  function txt(v) { return String(v == null ? "" : v).trim(); }

  function headHTML(eyebrow, heading) {
    return '<div class="section-head"><div><p class="eyebrow">' + esc(eyebrow) + '</p>' +
      '<h2>' + heading + '</h2></div></div>';
  }

  function clearHost(id) {
    var host = qs("#" + id);
    if (host) host.innerHTML = "";
    return host;
  }

  function openShot(src) {
    if (!src) return;
    var lb = qs("#lightbox");
    if (!lb) return;
    qs("#lb-img").src = src;
    lb.style.display = "grid";
    document.body.classList.add("is-locked");
  }

  /* ---------- key features ---------- */
  function renderFeatures() {
    var host = clearHost("pdp-features");
    var list = (product.features || []).filter(function (f) {
      return f && (txt(f.title) || txt(f.text) || (f.images || []).filter(Boolean).length);
    });
    if (!host || !list.length) return;

    host.innerHTML = '<section class="section pdp-sec"><div class="wrap">' +
      headHTML("Key features", "What makes it <em>worth the hanger</em>") +
      '<div class="feat">' + list.map(function (f, i) {
        var pics = (f.images || []).filter(Boolean);
        var num = (i + 1 < 10 ? "0" : "") + (i + 1);
        return '<article class="feat__row' + (pics.length ? "" : " feat__row--text") + '">' +
          (pics.length
            ? '<div class="feat__pics' + (pics.length === 1 ? " feat__pics--one" : "") +
              (f.fit === "cover" ? " is-cover" : "") + '">' +
              pics.map(function (src, j) {
                return '<button type="button" class="feat__pic" data-feat-shot="' + i + "|" + j + '" aria-label="Enlarge picture ' + (j + 1) + '">' +
                  '<img src="' + esc(src) + '" alt="' + esc(txt(f.title) || product.title) + '" loading="lazy">' +
                '</button>';
              }).join("") +
            '</div>'
            : "") +
          '<div class="feat__body">' +
            '<span class="feat__num">' + num + '</span>' +
            (txt(f.title) ? '<h3 class="feat__t">' + esc(f.title) + '</h3>' : "") +
            (txt(f.text) ? '<p class="feat__x">' + esc(f.text) + '</p>' : "") +
          '</div>' +
        '</article>';
      }).join("") + '</div></div></section>';

    qsa("[data-feat-shot]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var at = b.dataset.featShot.split("|");
        var pics = ((list[+at[0]] || {}).images || []).filter(Boolean);
        openShot(pics[+at[1]]);
      });
    });
  }

  /* ---------- material specifications ----------
     The numbered dots sit on the picture at the spot the owner clicked; the
     list beside it carries the same numbers, so either one can be the way in. */
  function renderMaterial() {
    var host = clearHost("pdp-material");
    var m = product.material;
    var notes = ((m && m.notes) || []).filter(function (n) { return n && txt(n.text); });
    var specs = ((m && m.specs) || []).filter(function (s) { return s && (txt(s.label) || txt(s.value)); });
    var shot = m ? txt(m.image) : "";
    if (!host || !m || !(shot || txt(m.title) || txt(m.intro) || notes.length || specs.length)) return;

    host.innerHTML = '<section class="section section--cream pdp-sec"><div class="wrap">' +
      headHTML("Material specifications", "What it is <em>made of</em>") +
      '<div class="mat">' +
        (shot
          ? '<figure class="mat__shot">' +
              '<img src="' + esc(shot) + '" alt="' + esc(txt(m.title) || product.title) + '" loading="lazy">' +
              notes.map(function (n, i) {
                var x = Math.min(100, Math.max(0, parseFloat(n.x)));
                var y = Math.min(100, Math.max(0, parseFloat(n.y)));
                if (isNaN(x)) x = 50;
                if (isNaN(y)) y = 50;
                return '<button type="button" class="mat__pin" data-pin="' + i + '" style="left:' + x + '%;top:' + y + '%">' +
                  '<span>' + (i + 1) + '</span><em>' + esc(n.text) + '</em></button>';
              }).join("") +
            '</figure>'
          : "") +
        '<div class="mat__side">' +
          (txt(m.title) ? '<h3 class="mat__t">' + esc(m.title) + '</h3>' : "") +
          (txt(m.intro) ? '<p class="mat__x">' + esc(m.intro) + '</p>' : "") +
          (notes.length
            ? '<ol class="mat__notes">' + notes.map(function (n, i) {
                return '<li data-note="' + i + '"><span>' + (i + 1) + '</span><p>' + esc(n.text) + '</p></li>';
              }).join("") + '</ol>'
            : "") +
          (specs.length
            ? '<dl class="mat__specs">' + specs.map(function (s) {
                return '<div class="mat__spec"><dt>' + esc(txt(s.label)) + '</dt><dd>' + esc(txt(s.value)) + '</dd></div>';
              }).join("") + '</dl>'
            : "") +
        '</div>' +
      '</div></div></section>';

    var pins = qsa("[data-pin]", host);
    var lines = qsa("[data-note]", host);
    function light(i) {
      pins.forEach(function (b) { b.classList.toggle("is-on", +b.dataset.pin === i); });
      lines.forEach(function (li) { li.classList.toggle("is-on", +li.dataset.note === i); });
    }
    pins.forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.dataset.pin;
        if (b.classList.contains("is-on")) { light(-1); return; }
        light(i);
        if (lines[i]) lines[i].scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    });
    lines.forEach(function (li) {
      li.addEventListener("click", function () {
        var i = +li.dataset.note;
        light(pins[i] && pins[i].classList.contains("is-on") ? -1 : i);
      });
    });
  }

  /* ---------- performance ---------- */
  function renderPerformance() {
    var host = clearHost("pdp-performance");
    var rows = (product.performance || []).filter(function (r) {
      return r && (txt(r.label) || txt(r.value) || txt(r.note));
    });
    if (!host || !rows.length) return;

    host.innerHTML = '<section class="section pdp-sec pdp-sec--dark"><div class="wrap">' +
      headHTML("Performance", "How it <em>holds up</em>") +
      '<div class="perf">' + rows.map(function (r) {
        return '<div class="perf__cell">' +
          (txt(r.value) ? '<p class="perf__v">' + esc(r.value) + '</p>' : "") +
          (txt(r.label) ? '<p class="perf__l">' + esc(r.label) + '</p>' : "") +
          (txt(r.note) ? '<p class="perf__n">' + esc(r.note) + '</p>' : "") +
        '</div>';
      }).join("") + '</div></div></section>';
  }

  /* ---------- style ----------
     A vertical clip on the left, and on the right the pieces worn in it. Only
     the handle is stored, so the picture and the price always come from the
     live product rather than a copy made when someone last edited the page. */
  function renderStyle() {
    var host = clearHost("pdp-style");
    var st = product.style;
    var clip = st ? txt(st.video) : "";
    var items = ((st && st.products) || [])
      .map(function (id) { return S.productById(id) || S.product(id); })
      .filter(function (p) { return p && p.active !== false && p.id !== product.id; });
    if (!host || !st || !(clip || items.length || txt(st.intro))) return;

    host.innerHTML = '<section class="section pdp-sec"><div class="wrap">' +
      headHTML("Styled with", "The <em>full look</em>") +
      '<div class="sty' + (clip ? "" : " sty--no-clip") + '">' +
        (clip
          ? '<div class="sty__clip"><video controls loop playsinline muted preload="metadata"' +
            ' poster="' + esc((product.images || [])[0] || "") + '"></video></div>'
          : "") +
        '<div class="sty__shop">' +
          (txt(st.title) ? '<h3 class="sty__t">' + esc(st.title) + '</h3>' : "") +
          (txt(st.intro) ? '<p class="sty__x">' + esc(st.intro) + '</p>' : "") +
          (items.length
            ? '<p class="sty__lead">In this look</p><ul class="sty__list">' + items.map(function (p) {
                return '<li><a class="sty__item" href="product.html?p=' + encodeURIComponent(p.handle || p.id) + '">' +
                  '<img src="' + esc((p.images || [])[0] || "") + '" alt="' + esc(p.title) + '" loading="lazy">' +
                  '<span class="sty__meta"><b>' + esc(p.title) + '</b>' +
                    '<em>' + esc((p.colors || [])[0] || p.category || "") + '</em>' +
                    '<span>' + UI.money(p.price) + '</span></span>' +
                  '<span class="sty__go">' + I.arrow + '</span>' +
                '</a></li>';
              }).join("") + '</ul>'
            : "") +
        '</div>' +
      '</div></div></section>';

    if (!clip) return;
    var video = qs(".sty__clip video", host);
    if (!video) return;
    /* A clip uploaded in the admin lives in that browser's IndexedDB and is
       stored as a "ziqmedia:<id>" reference; everything else is a plain path. */
    if (!window.ZiqMedia || !ZiqMedia.isRef(clip)) { video.src = clip; return; }
    ZiqMedia.url(clip, function (src) {
      var stillThere = qs(".sty__clip video", host);
      if (stillThere && src) stillThere.src = src;
    });
  }

  function renderSections() {
    renderFeatures();
    renderMaterial();
    renderPerformance();
    renderStyle();
  }

  /* ---------- SEO: self-identify this product page ----------
     The <head> ships generic static tags, so once a specific product is
     rendered we rewrite the canonical / og / twitter tags to point at it.
     Everything is written through DOM attributes (setAttribute / createElement),
     never innerHTML, so a title or handle containing & < > " is escaped by the
     browser instead of breaking out of the tag.

     The absolute URL is derived from the live request (location.origin + the
     page's own directory), so it stays correct on localhost:8777 and behind
     nginx, and under the /legacy/ mount — exactly the format the site serves
     today (product.html?p=<handle>), matching updateWA(). */
  function headMeta(attr, key) {
    var sel = 'meta[' + attr + '="' + key + '"]';   // attr/key are fixed constants
    var el = document.head.querySelector(sel);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    return el;
  }

  function setCanonical(url) {
    var el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", "canonical");
      document.head.appendChild(el);
    }
    el.setAttribute("href", url);
  }

  function clampDesc(s) {
    var t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    if (t.length > 155) t = t.slice(0, 152).replace(/\s+\S*$/, "") + "…";
    return t;
  }

  function updateSeo(p) {
    var dir = location.pathname.replace(/[^/]*$/, "");
    var pageUrl = location.origin + dir + "product.html?p=" + encodeURIComponent(p.handle || "");
    var title = String(p.seoTitle || (p.title + " — " + S.settings.storeName));
    var desc = clampDesc(p.seoDescription || p.description);
    var imgs = p.images || [];
    var imgAbs = imgs.length ? new URL(String(imgs[0]), location.href).href : "";

    document.title = title;
    setCanonical(pageUrl);
    headMeta("property", "og:url").setAttribute("content", pageUrl);
    headMeta("property", "og:title").setAttribute("content", title);
    if (desc) headMeta("property", "og:description").setAttribute("content", desc);
    headMeta("name", "twitter:url").setAttribute("content", pageUrl);
    headMeta("name", "twitter:title").setAttribute("content", title);
    if (desc) {
      headMeta("name", "twitter:description").setAttribute("content", desc);
      var dm = document.head.querySelector('meta[name="description"]');
      if (dm) dm.setAttribute("content", desc);
    }
    if (imgAbs) {
      headMeta("property", "og:image").setAttribute("content", imgAbs);
      headMeta("name", "twitter:image").setAttribute("content", imgAbs);
      headMeta("property", "og:image:alt").setAttribute("content", String(p.title || ""));
    }
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    UI.mount();
    var handle = String(new URLSearchParams(location.search).get("p") || "").slice(0, 120);
    product = S.product(handle);
    if (!product) {
      var fallback = S.products({ limit: 1 })[0];
      if (!fallback) {
        qs("#pdp").innerHTML = '<div class="empty-state"><h3>Product not found</h3><p>It may have been removed.</p><a class="btn btn--ghost" href="shop.html">Back to shop</a></div>';
        return;
      }
      product = fallback;
    }
    sel.color = (product.colors || [])[0] || "";
    sel.size = (product.sizes || [])[0] || "";
    updateSeo(product);
    render();
    UI.reveal();
  });
})();
