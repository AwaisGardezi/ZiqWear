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
