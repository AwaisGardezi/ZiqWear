/* ==========================================================================
   ZIQWEAR — shared UI
   Header, footer, cart drawer, search, product cards, toasts.
   ========================================================================== */
(function (global) {
  "use strict";

  var S = global.Store;

  /* ---------- icons ---------- */
  var I = {
    search: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" stroke-linecap="round"/></svg>',
    user: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" stroke-linecap="round"/></svg>',
    bag: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2" stroke-linecap="round"/></svg>',
    heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.8C19 15.6 12 20 12 20z"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>',
    plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
    minus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14" stroke-linecap="round"/></svg>',
    arrow: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevL: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevD: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    truck: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M2 7h11v9H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
    cash: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v6M18 9v6"/></svg>',
    ret: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 9h11a4 4 0 010 8H8" stroke-linecap="round"/><path d="M7.5 5.5L4 9l3.5 3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shield: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M12 3l7 3v5.5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.6 7 .9-5.2 4.9 1.4 7L12 18l-6.2 3.4 1.4-7L2 9.5l7-.9z"/></svg>',
    zoom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8.5v5M8.5 11h5" stroke-linecap="round"/></svg>',
    insta: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none"/></svg>',
    tiktok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3h-2.8v11.6a2.4 2.4 0 11-2.4-2.4c.2 0 .4 0 .6.1V9.4a5.3 5.3 0 102.9 4.7V8.6a5.5 5.5 0 003.2 1V6.8a2.9 2.9 0 01-2.5-2.9V3z"/></svg>',
    fb: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.4h2.6l.4-3h-3V8.7c0-.9.3-1.5 1.5-1.5h1.6V4.5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.1H7.5v3h2.6V21h3.4z"/></svg>',
    menu: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h18M3 12h18M3 17h12" stroke-linecap="round"/></svg>',
    whatsapp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1112 20zm4.5-5.9c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.7-.7.9-.3.2-.5.1a6.5 6.5 0 01-1.9-1.2 7 7 0 01-1.3-1.6c-.1-.3 0-.4.1-.5l.4-.5.2-.4v-.4l-.8-1.9c-.2-.4-.4-.4-.5-.4h-.5a1 1 0 00-.7.3 2.9 2.9 0 00-.9 2.1 5 5 0 001.1 2.7 11.4 11.4 0 004.4 3.9c1.6.6 1.6.4 1.9.4a2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.1-1.2z"/></svg>',
    mail: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- colour resolver ---------- */
  var NAMED = {
    black: "#111111", "midnight black": "#141414", "all black": "#111111", "plain black": "#111111",
    white: "#f7f7f5", "arctic white": "#f8f8f6", "opal white": "#f6f5f1", "supreme white": "#f8f8f6",
    "silver white": "#e6e7e6", "white-black": "#eeeeec",
    grey: "#8d8d8d", gray: "#8d8d8d", "charcoal": "#3a3a3a", "charcoal grey": "#3c3c3c",
    "silver grey": "#b9bcbb", "ash grey": "#a8a5a0", "silver mist": "#d6d8d5",
    beige: "#d8c6ac", "classic beige": "#d5c2a6", "sand beige": "#dcc9ad", "stone beige": "#cbb8a1",
    "sand biege": "#dcc9ad", "camel brown": "#b5875a", "caremal tan": "#b9834f",
    brown: "#6b4a33", "chocolate brown": "#4a3226", "all brown": "#5b3f2d", "copper": "#b06f45",
    tan: "#c09a6b",
    navy: "#1f2b45", "navy blue": "#1f2b45", "navy stripes": "#28344d",
    blue: "#3b5a86", "silver blue": "#9fb2c4", "tiffany blue": "#6ec3c0", "tiffany": "#6ec3c0",
    "royal blue": "#2d4c86", "denim blue": "#55708f",
    green: "#39503c", "forest green": "#2e4230", "olive green": "#5f6448", "pine green": "#2c4438",
    "royal green": "#1f5238", "dark green": "#22412f",
    red: "#8f2f2a", "cherry red": "#8f2f2a", "royal burgundy": "#5a2230", "wine": "#5c2331",
    orange: "#c86a2e", mustard: "#c39a3c", yellow: "#d8b74a", "yellow stripes": "#d8b74a",
    pink: "#d8a7a7", "dusty peach": "#d9a992", purple: "#5f4a7a", voilet: "#6a5a86", violet: "#6a5a86",
    gold: "#c3a15c", silver: "#b9bcbb", "two-tone": "#a98a68", magenta: "#8e2f6a"
  };

  function colorHex(name) {
    if (!name) return "#d9d4cc";
    var k = String(name).toLowerCase().trim();
    if (NAMED[k]) return NAMED[k];
    var keys = Object.keys(NAMED).sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < keys.length; i++) {
      if (k.indexOf(keys[i]) > -1) return NAMED[keys[i]];
    }
    return "#cfc8bd";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Only relative links and the schemes a shop legitimately needs are allowed
     through to href/src. This blocks `javascript:`, `data:` and `vbscript:`
     payloads that would otherwise run when a customer clicks a link typed into
     the admin panel. Control characters are stripped first because browsers
     ignore them while parsing a scheme — that is how `java\nscript:` sneaks past
     naive filters. */
  function safeUrl(u, fallback) {
    var fb = fallback || "#";
    var s = String(u == null ? "" : u).replace(/[\u0000-\u001F\u007F]/g, "").trim();
    if (!s) return fb;
    var m = /^([a-z][a-z0-9+.\-]*):/i.exec(s);
    if (!m) return s;                       // relative path, hash or query
    var scheme = m[1].toLowerCase();
    if (scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel") return s;
    return fb;
  }

  /* Colours land inside `style="..."` and CSS custom properties, so only
     well-formed hex / rgb() values are allowed through. */
  function safeColor(c, fallback) {
    var s = String(c == null ? "" : c).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return s;
    if (/^rgba?\(\s*[\d.%\s,/]+\)$/i.test(s)) return s;
    return fallback || "#111111";
  }

  /* Digits only — used for phone / WhatsApp values that get spliced into URLs. */
  function digits(v) {
    return String(v == null ? "" : v).replace(/\D/g, "");
  }

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---------- UI ---------- */
  var UI = {
    icons: I,
    esc: esc,
    safeUrl: safeUrl,
    safeColor: safeColor,
    digits: digits,
    qs: qs,
    qsa: qsa,
    colorHex: colorHex,

    money: function (n) { return S.money(n); },

    /* ----- WhatsApp ----- */
    waNumber: function () {
      return String((S.settings && S.settings.whatsapp) || "").replace(/\D/g, "");
    },
    waLink: function (text) {
      return "https://wa.me/" + this.waNumber() + (text ? "?text=" + encodeURIComponent(text) : "");
    },
    /* Full basket as a ready-to-send order message. */
    cartMessage: function (extra) {
      var items = S.cart();
      if (!items.length) return "Hi " + S.settings.storeName + "! I would like to place an order.";
      var lines = items.map(function (i, n) {
        var opt = [i.color, i.size].filter(Boolean).join(" / ");
        return (n + 1) + ". " + i.title + (opt ? " (" + opt + ")" : "") +
          " x" + i.qty + " \u2014 " + S.money(i.price * i.qty);
      });
      var sub = S.cartSubtotal();
      var freeAt = S.settings.freeShipping || 0;
      var ship = sub >= freeAt ? 0 : (S.settings.shippingFee || 0);
      var msg = "Hi " + S.settings.storeName + "! I would like to order:\n\n" +
        lines.join("\n") + "\n\n" +
        "Subtotal: " + S.money(sub) + "\n" +
        "Shipping: " + (ship ? S.money(ship) : "Free") + "\n" +
        "Total: " + S.money(sub + ship) + "\n";
      if (extra) return msg + "\n" + extra;
      return msg + "\nName: \nAddress: \nCity: ";
    },

    /* ----- logo ----- */
    logo: function (h) {
      h = h || 34;
      return '<span class="logo-lockup" style="--logo-h:' + h + 'px">' +
        '<img class="logo-mark" src="assets/img/logo-z.png" alt="" width="150" height="150">' +
        '<span class="logo-type">' + esc(S.settings.storeName || "ZIQWEAR") + '</span>' +
        '</span>';
    },

    /* ----- mark only (footer / admin) ----- */
    mark: function (h) {
      h = h || 34;
      return '<img class="logo-mark" src="assets/img/logo-z.png" alt="' + esc(S.settings.storeName) + '" width="150" height="150" style="height:' + h + 'px;width:auto">';
    },

    /* ----- announcement ----- */
    renderAnnouncement: function () {
      var host = qs("#announcement");
      if (!host) return;
      var msgs = S.settings.announcements || [];
      if (!msgs.length) { host.innerHTML = ""; return; }
      host.className = "announcement";
      host.innerHTML =
        '<button class="announcement__nav announcement__nav--prev" aria-label="Previous">' + I.chevL + '</button>' +
        '<div class="announcement__inner"><p class="announcement__text">' + esc(msgs[0]) + '</p></div>' +
        '<button class="announcement__nav announcement__nav--next" aria-label="Next">' + I.chevR + '</button>';
      var idx = 0;
      var el = qs(".announcement__text", host);
      function go(dir) {
        idx = (idx + dir + msgs.length) % msgs.length;
        el.classList.add("is-out");
        setTimeout(function () {
          el.textContent = msgs[idx];
          el.classList.remove("is-out");
        }, 220);
      }
      qs(".announcement__nav--prev", host).addEventListener("click", function () { go(-1); });
      qs(".announcement__nav--next", host).addEventListener("click", function () { go(1); });
      if (msgs.length > 1) {
        setInterval(function () { go(1); }, 5200);
      } else {
        qsa(".announcement__nav", host).forEach(function (b) { b.style.display = "none"; });
      }
    },

    /* ----- header ----- */
    renderHeader: function () {
      var host = qs("#site-header");
      if (!host) return;
      host.className = "header";
      host.innerHTML = '<div class="header__bar wrap">' +
        '<div class="header__nav">' + this.navHTML() + '</div>' +
        '<button class="icon-btn header__burger" aria-label="Menu">' + I.menu + '</button>' +
        '<a class="header__logo" href="index.html" aria-label="Home">' + this.logo(34) + '</a>' +
        '<div class="header__actions">' +
          '<button class="icon-btn" data-open-search aria-label="Search">' + I.search + '</button>' +
          '<a class="icon-btn" href="orders.html" aria-label="Orders">' + I.user + '</a>' +
          '<button class="icon-btn" data-open-wish aria-label="Wishlist">' + I.heart + '<span class="icon-btn__count" data-wish-count hidden>0</span></button>' +
          '<button class="icon-btn" data-open-cart aria-label="Bag">' + I.bag + '<span class="icon-btn__count" data-cart-count hidden>0</span></button>' +
        '</div>' +
        '</div>' +
        '<div class="mega" data-mega><div class="mega__inner" data-mega-inner></div></div>';
      this.bindHeader();
      this.syncCounts();
    },

    navHTML: function () {
      var page = document.body.dataset.page || "home";
      var cats = S.categories();
      var html = '<a class="header__link' + (page === "home" ? " is-active" : "") + '" href="index.html">Home</a>' +
        '<a class="header__link" href="shop.html">View All</a>' +
        '<a class="header__link' + (page === "wardrobe" ? " is-active" : "") + '" href="wardrobe.html">The Rail</a>';
      cats.forEach(function (c) {
        if (c.group === "nav" && c.id !== "accessories") return;
        var href = "shop.html?c=" + encodeURIComponent(c.id);
        var hasKids = c.children && c.children.length;
        html += '<a class="header__link" href="' + href + '"' + (hasKids ? ' data-mega-trigger="' + esc(c.id) + '"' : '') + '>' + esc(c.navLabel || c.name) + '</a>';
      });
      html += '<a class="header__link" href="contact.html">Contact Us</a>';
      return html;
    },

    bindHeader: function () {
      var header = qs("#site-header");
      var mega = qs("[data-mega]", header);
      var megaInner = qs("[data-mega-inner]", header);
      var hideTimer;

      // mega menu
      function fillMega(cat) {
        var kids = cat.children || [];
        var prod = S.products({ category: cat.id, limit: 1, inStock: true })[0] ||
          S.products({ category: cat.id, limit: 1 })[0];
        var promoImg = cat.image || (prod && prod.images[0]) || "";
        var cols = "";
        var half = Math.ceil(kids.length / 2) || 1;
        for (var i = 0; i < 2; i++) {
          var group = kids.slice(i * half, (i + 1) * half);
          if (!group.length) continue;
          cols += '<div class="mega__col"><h4>' + (i === 0 ? "Shop by type" : "More") + '</h4>' +
            group.map(function (k) {
              return '<a href="shop.html?c=' + encodeURIComponent(cat.id) + '&sub=' + encodeURIComponent(k.sub || k.slug) + '">' + esc(k.name) + '</a>';
            }).join("") + '</div>';
        }
        cols += '<div class="mega__col"><h4>Collections</h4>' +
          '<a href="shop.html?c=' + encodeURIComponent(cat.id) + '">All ' + esc(cat.name) + '</a>' +
          '<a href="shop.html?sort=newest">New Arrivals</a>' +
          '<a href="shop.html?sort=best">Best Sellers</a>' +
          '<a href="shop.html?sale=1">Sale</a>' +
          '</div>';
        cols += '<a class="mega__promo" href="shop.html?c=' + encodeURIComponent(cat.id) + '">' +
          '<img src="' + esc(promoImg) + '" alt="' + esc(cat.name) + '" loading="lazy">' +
          '<span>' + esc(cat.name) + ' — Shop Now</span></a>';
        megaInner.innerHTML = cols;
      }

      qsa("[data-mega-trigger]", header).forEach(function (link) {
        link.addEventListener("mouseenter", function () {
          clearTimeout(hideTimer);
          var cat = S.category(link.dataset.megaTrigger);
          if (!cat) return;
          fillMega(cat);
          mega.classList.add("is-open");
          header.classList.add("is-mega-open");
        });
      });
      header.addEventListener("mouseleave", function () {
        hideTimer = setTimeout(function () {
          mega.classList.remove("is-open");
          header.classList.remove("is-mega-open");
        }, 140);
      });
      header.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });

      // burger
      var burger = qs(".header__burger", header);
      if (burger) burger.addEventListener("click", function () { UI.openMobileNav(); });

      // global openers
      qsa("[data-open-search]").forEach(function (b) { b.addEventListener("click", function () { UI.openSearch(); }); });
      qsa("[data-open-cart]").forEach(function (b) { b.addEventListener("click", function () { UI.openCart(); }); });
      qsa("[data-open-wish]").forEach(function (b) { b.addEventListener("click", function () { UI.openWishlist(); }); });
    },

    syncCounts: function () {
      var c = S.cartCount();
      qsa("[data-cart-count]").forEach(function (el) {
        el.textContent = c;
        el.hidden = c === 0;
      });
      var w = S.wishlist().length;
      qsa("[data-wish-count]").forEach(function (el) {
        el.textContent = w;
        el.hidden = w === 0;
      });
    },

    /* ----- footer ----- */
    renderFooter: function () {
      var host = qs("#site-footer");
      if (!host) return;
      var s = S.settings;
      var soc = s.socials || {};
      var cats = S.categories();
      host.className = "footer";
      host.innerHTML =
        '<div class="wrap"><div class="footer__grid">' +
          '<div class="footer__brand">' + this.logo(38) +
            '<p class="footer__tag">' + esc(s.tagline) +
              (s.brandMeaning ? ' <i>&middot;</i> ' + esc(s.brandMeaning) : '') + '</p>' +
            '<p>' + esc(s.footerNote) + '</p>' +
            '<div class="footer__socials">' +
              (soc.instagram ? '<a href="' + esc(safeUrl(soc.instagram)) + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram">' + I.insta + '</a>' : '') +
              (soc.tiktok ? '<a href="' + esc(safeUrl(soc.tiktok)) + '" target="_blank" rel="noopener noreferrer" aria-label="TikTok">' + I.tiktok + '</a>' : '') +
              (soc.facebook ? '<a href="' + esc(safeUrl(soc.facebook)) + '" target="_blank" rel="noopener noreferrer" aria-label="Facebook">' + I.fb + '</a>' : '') +
              '<a href="https://wa.me/' + esc(digits(s.whatsapp)) + '" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">' + I.whatsapp + '</a>' +
            '</div>' +
          '</div>' +
          '<div class="footer__col"><h5>Shop</h5>' +
            cats.slice(0, 6).map(function (c) {
              return '<a href="shop.html?c=' + encodeURIComponent(c.id) + '">' + esc(c.name) + '</a>';
            }).join("") +
            '<a href="shop.html">View All</a>' +
          '</div>' +
          '<div class="footer__col"><h5>Help</h5>' +
            '<a href="contact.html">Contact Us</a>' +
            '<a href="orders.html">Track My Order</a>' +
            '<a href="contact.html#shipping">Shipping &amp; Delivery</a>' +
            '<a href="contact.html#returns">Exchanges &amp; Returns</a>' +
            '<a href="contact.html#size">Size Guide</a>' +
            '<a href="admin.html">Store Admin</a>' +
          '</div>' +
          '<div class="footer__col"><h5>Reach Us</h5>' +
            '<a href="tel:' + esc(s.phone.replace(/\s/g, "")) + '">' + esc(s.phone) + '</a>' +
            '<a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>' +
            '<li>' + esc(s.address) + '</li>' +
            '<li>' + esc(s.hours) + '</li>' +
          '</div>' +
        '</div></div>' +
        '<div class="wrap"><div class="footer__bottom">' +
          '<span>© ' + new Date().getFullYear() + ' ' + esc(s.storeName) + '. All rights reserved.</span>' +
          '<div class="footer__pay"><span>CASH ON DELIVERY</span><span>BANK TRANSFER</span><span>EASYPAISA</span><span>JAZZCASH</span><span>VISA</span></div>' +
        '</div></div>';
    },

    /* ----- product card ----- */
    productCard: function (p) {
      var img = (p.images && p.images[0]) || "";
      var alt = (p.images && p.images[1]) || "";
      var badges = "";
      if (!p.stock) badges += '<span class="badge badge--out">Sold out</span>';
      else {
        if (p.discount) badges += '<span class="badge badge--sale">-' + p.discount + '%</span>';
        if (p.isNew) badges += '<span class="badge badge--new">New</span>';
      }
      var wishOn = S.inWish(p.id);
      var swatches = (p.colors || []).slice(0, 4).map(function (c) {
        return '<span class="swatch-dot" style="background:' + colorHex(c) + '" title="' + esc(c) + '"></span>';
      }).join("");
      var href = "product.html?p=" + encodeURIComponent(p.handle);
      var quickLabel = (p.sizes && p.sizes.length > 1) ? "Select options" : (p.stock ? "Add to bag" : "Sold out");
      var quick = (p.sizes && p.sizes.length > 1)
        ? '<a class="pcard__quick" href="' + href + '">' + quickLabel + '</a>'
        : '<button class="pcard__quick" data-quick="' + esc(p.id) + '"' + (p.stock ? "" : " disabled") + '>' + quickLabel + '</button>';

      return '<article class="pcard" data-pid="' + esc(p.id) + '">' +
        '<a class="pcard__media" href="' + href + '" aria-label="' + esc(p.title) + '">' +
          '<img class="pcard__img" src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy">' +
          (alt ? '<img class="pcard__img pcard__img--alt" src="' + esc(alt) + '" alt="" loading="lazy">' : '') +
          '<div class="pcard__badge">' + badges + '</div>' +
        '</a>' +
        '<button class="pcard__wish' + (wishOn ? " is-on" : "") + '" data-wish="' + esc(p.id) + '" aria-label="Save">' + I.heart + '</button>' +
        quick +
        '<div class="pcard__body">' +
          '<span class="pcard__cat">' + esc(this.catLabel(p)) + '</span>' +
          '<a class="pcard__title" href="' + href + '">' + esc(p.title) + '</a>' +
          '<div class="pcard__price"><span>' + this.money(p.price) + '</span>' +
            (p.compareAt && p.compareAt > p.price ? '<s>' + this.money(p.compareAt) + '</s>' : '') +
          '</div>' +
          (swatches ? '<div class="pcard__swatches">' + swatches + '</div>' : '') +
        '</div>' +
      '</article>';
    },

    catLabel: function (p) {
      var c = S.category(p.category);
      if (p.subcategory) {
        var child = c && (c.children || []).filter(function (k) { return k.sub === p.subcategory; })[0];
        if (child) return child.name;
        return p.subcategory;
      }
      var nm = c ? c.name : p.category;
      return String(nm).split("/")[0].trim();
    },

    /* ----- cart drawer ----- */
    renderCartDrawer: function () {
      var host = qs("#cart-drawer");
      if (!host) return;
      host.className = "drawer";
      host.innerHTML =
        '<div class="drawer__scrim" data-close-cart></div>' +
        '<aside class="drawer__panel" role="dialog" aria-label="Shopping bag">' +
          '<div class="drawer__head"><h3 data-cart-title>Bag (0)</h3>' +
            '<button class="icon-btn" data-close-cart aria-label="Close">' + I.close + '</button></div>' +
          '<div data-shipbar></div>' +
          '<div class="drawer__body" data-cart-body></div>' +
          '<div class="drawer__foot" data-cart-foot></div>' +
        '</aside>';
      qsa("[data-close-cart]", host).forEach(function (b) {
        b.addEventListener("click", function () { UI.closeCart(); });
      });
      this.paintCart();
    },

    paintCart: function () {
      var body = qs("[data-cart-body]");
      var foot = qs("[data-cart-foot]");
      var ship = qs("[data-shipbar]");
      if (!body) return;
      var items = S.cart();
      var subtotal = S.cartSubtotal();
      var count = S.cartCount();
      var title = qs("[data-cart-title]");
      if (title) title.textContent = "Bag (" + count + ")";

      if (!items.length) {
        body.innerHTML = '<div class="cart-empty">' + I.bag +
          '<p>Your bag is empty.</p><a class="btn btn--ghost" href="shop.html" data-close-cart>Start shopping</a></div>';
        foot.innerHTML = "";
        if (ship) ship.innerHTML = "";
        qsa("[data-close-cart]", body).forEach(function (b) {
          b.addEventListener("click", function () { UI.closeCart(); });
        });
        return;
      }

      body.innerHTML = items.map(function (i) {
        return '<div class="citem" data-key="' + esc(i.key) + '">' +
          '<img class="citem__img" src="' + esc(i.image) + '" alt="' + esc(i.title) + '">' +
          '<div><div class="citem__top"><div>' +
            '<a class="citem__title" href="product.html?p=' + encodeURIComponent(i.handle) + '">' + esc(i.title) + '</a>' +
            '<div class="citem__meta">' + [i.color, i.size].filter(Boolean).map(esc).join(" · ") + '</div>' +
          '</div><span class="citem__price">' + UI.money(i.price * i.qty) + '</span></div>' +
          '<div class="citem__bottom">' +
            '<div class="qty"><button data-qty="-1" aria-label="Decrease">' + I.minus + '</button>' +
            '<input type="number" value="' + i.qty + '" min="1" data-qty-input aria-label="Quantity">' +
            '<button data-qty="1" aria-label="Increase">' + I.plus + '</button></div>' +
            '<button class="citem__remove" data-remove>Remove</button>' +
          '</div></div></div>';
      }).join("");

      var freeAt = S.settings.freeShipping;
      var remaining = Math.max(0, freeAt - subtotal);
      var pct = Math.min(100, (subtotal / freeAt) * 100);
      if (ship) {
        ship.innerHTML = '<div class="ship-bar">' +
          '<p class="ship-bar__text">' + (remaining > 0
            ? 'You are <b>' + UI.money(remaining) + '</b> away from free shipping'
            : '<b>Free shipping unlocked</b> — nice one.') + '</p>' +
          '<div class="ship-bar__track"><div class="ship-bar__fill" style="width:' + pct + '%"></div></div>' +
          '</div>';
      }
      foot.innerHTML =
        '<div class="cart-line"><span>Subtotal</span><span>' + UI.money(subtotal) + '</span></div>' +
        '<div class="cart-line"><span>Shipping</span><span>' + (remaining > 0 ? UI.money(S.settings.shippingFee) : "Free") + '</span></div>' +
        '<div class="cart-line cart-line--total"><span>Total</span><span>' + UI.money(subtotal + (remaining > 0 ? S.settings.shippingFee : 0)) + '</span></div>' +
        '<a class="btn btn--full" style="margin-top:16px" href="checkout.html">Checkout</a>' +
        '<a class="btn btn--ghost btn--full wa-btn" style="margin-top:10px" target="_blank" rel="noopener" href="' +
          esc(UI.waLink(UI.cartMessage())) + '">' + I.whatsapp + ' Order on WhatsApp</a>' +
        '<p class="cart-note">Cash on delivery available across Pakistan</p>';

      // qty + remove
      qsa(".citem", body).forEach(function (row) {
        var key = row.dataset.key;
        qsa("[data-qty]", row).forEach(function (btn) {
          btn.addEventListener("click", function () {
            var line = S.cart().filter(function (i) { return i.key === key; })[0];
            if (!line) return;
            S.updateCartQty(key, line.qty + parseInt(btn.dataset.qty, 10));
            UI.paintCart();
          });
        });
        var input = qs("[data-qty-input]", row);
        if (input) input.addEventListener("change", function () {
          S.updateCartQty(key, input.value);
          UI.paintCart();
        });
        var rm = qs("[data-remove]", row);
        if (rm) rm.addEventListener("click", function () {
          S.removeFromCart(key);
          UI.paintCart();
          UI.toast("Removed from bag");
        });
      });
    },

    openCart: function () {
      qs("#cart-drawer").classList.add("is-open");
      document.body.classList.add("is-locked");
      this.paintCart();
    },
    closeCart: function () {
      qs("#cart-drawer").classList.remove("is-open");
      document.body.classList.remove("is-locked");
    },

    /* ----- wishlist drawer (reuses cart drawer markup) ----- */
    openWishlist: function () {
      var items = S.wishProducts();
      var host = qs("#cart-drawer");
      qs("[data-cart-title]", host).textContent = "Saved (" + items.length + ")";
      var body = qs("[data-cart-body]", host);
      var foot = qs("[data-cart-foot]", host);
      var ship = qs("[data-shipbar]", host);
      ship.innerHTML = "";
      if (!items.length) {
        body.innerHTML = '<div class="cart-empty">' + I.heart + '<p>Nothing saved yet.</p>' +
          '<a class="btn btn--ghost" href="shop.html" data-close-cart>Browse the store</a></div>';
      } else {
        body.innerHTML = items.map(function (p) {
          return '<div class="citem" data-key="' + esc(p.id) + '">' +
            '<a href="product.html?p=' + encodeURIComponent(p.handle) + '"><img class="citem__img" src="' + esc(p.images[0]) + '" alt=""></a>' +
            '<div><div class="citem__top"><div>' +
              '<a class="citem__title" href="product.html?p=' + encodeURIComponent(p.handle) + '">' + esc(p.title) + '</a>' +
              '<div class="citem__meta">' + UI.money(p.price) + '</div>' +
            '</div></div>' +
            '<div class="citem__bottom"><button class="btn btn--sm btn--ghost" data-move="' + esc(p.id) + '">Add to bag</button>' +
            '<button class="citem__remove" data-unwish="' + esc(p.id) + '">Remove</button></div></div></div>';
        }).join("");
      }
      foot.innerHTML = items.length ? '<a class="btn btn--full" href="shop.html" data-close-cart>Continue shopping</a>' : "";
      qsa("[data-close-cart]", host).forEach(function (b) {
        if (!b._bound) { b._bound = true; b.addEventListener("click", function () { UI.closeCart(); }); }
      });
      qsa("[data-move]", body).forEach(function (b) {
        b.addEventListener("click", function () {
          var p = S.productById(b.dataset.move);
          if (p) {
            S.addToCart(p, { color: (p.colors || [])[0], size: (p.sizes || [])[0], qty: 1 });
            UI.toast("Added to bag");
            UI.openCart();
          }
        });
      });
      qsa("[data-unwish]", body).forEach(function (b) {
        b.addEventListener("click", function () {
          S.toggleWish(b.dataset.unwish);
          UI.openWishlist();
          UI.syncCounts();
        });
      });
      host.classList.add("is-open");
      document.body.classList.add("is-locked");
    },

    /* ----- search ----- */
    renderSearch: function () {
      var host = qs("#search-modal");
      if (!host) return;
      host.className = "search";
      host.innerHTML =
        '<div class="search__scrim" data-close-search></div>' +
        '<div class="search__panel">' +
          '<div class="search__bar">' + I.search +
            '<input type="search" placeholder="What are you looking for?" data-search-input aria-label="Search products">' +
            '<button class="icon-btn" data-close-search aria-label="Close">' + I.close + '</button>' +
          '</div>' +
          '<div class="search__body" data-search-body></div>' +
        '</div>';
      var input = qs("[data-search-input]", host);
      var body = qs("[data-search-body]", host);
      // Suggestions come from the live catalogue, so they never go stale.
      var terms = S.products({ limit: 5 }).map(function (p) { return p.title; });
      if (!terms.length) terms = ["Oversized tee", "Graphic print", "Compression set", "Gym set"];

      function idle() {
        body.innerHTML = '<p class="search__hint">Popular right now</p><div class="chips">' +
          terms.map(function (t) { return '<button class="chip" data-term="' + esc(t) + '">' + esc(t) + '</button>'; }).join("") +
          '</div>';
        qsa("[data-term]", body).forEach(function (b) {
          b.addEventListener("click", function () {
            input.value = b.dataset.term;
            run();
          });
        });
      }

      function run() {
        var q = input.value.trim();
        if (!q) { idle(); return; }
        var res = S.search(q, 8);
        if (!res.length) {
          body.innerHTML = '<p class="search__count">No results for “' + esc(q) + '”. Try a different word.</p>';
          return;
        }
        body.innerHTML = '<p class="search__count">' + res.length + ' result' + (res.length > 1 ? "s" : "") + '</p>' +
          '<div class="search__results">' + res.map(function (p) { return UI.productCard(p); }).join("") + '</div>';
        UI.bindCards(body);
      }

      input.addEventListener("input", run);
      qsa("[data-close-search]", host).forEach(function (b) {
        b.addEventListener("click", function () { UI.closeSearch(); });
      });
      idle();
    },

    openSearch: function () {
      var host = qs("#search-modal");
      if (!host) return;
      host.classList.add("is-open");
      document.body.classList.add("is-locked");
      setTimeout(function () { qs("[data-search-input]", host).focus(); }, 260);
    },
    closeSearch: function () {
      qs("#search-modal").classList.remove("is-open");
      document.body.classList.remove("is-locked");
    },

    /* ----- mobile nav ----- */
    renderMobileNav: function () {
      var host = qs("#mobile-nav");
      if (!host) return;
      var cats = S.categories();
      var html = '<a class="mnav__link" href="index.html">Home</a>';
      cats.forEach(function (c) {
        var kids = c.children || [];
        html += '<div class="mnav__item">' +
          '<div class="mnav__link">' +
            '<a href="shop.html?c=' + encodeURIComponent(c.id) + '" style="flex:1">' + esc(c.name) + '</a>' +
            (kids.length ? '<button data-mtoggle aria-label="Expand">' + I.chevD + '</button>' : '') +
          '</div>' +
          (kids.length ? '<div class="mnav__sub"><div>' + kids.map(function (k) {
            return '<a href="shop.html?c=' + encodeURIComponent(c.id) + '&sub=' + encodeURIComponent(k.sub || k.slug) + '">' + esc(k.name) + '</a>';
          }).join("") + '</div></div>' : '') +
        '</div>';
      });
      html += '<a class="mnav__link" href="shop.html">View All</a>' +
        '<a class="mnav__link" href="orders.html">My Orders</a>' +
        '<a class="mnav__link" href="contact.html">Contact Us</a>';

      host.className = "mdrawer";
      host.innerHTML = '<div class="mdrawer__scrim" data-close-nav></div>' +
        '<div class="mdrawer__panel">' +
          '<div class="mdrawer__head">' + this.logo(28) +
            '<button class="icon-btn" data-close-nav aria-label="Close">' + I.close + '</button></div>' +
          '<div class="mdrawer__body">' + html + '</div>' +
          '<div class="mdrawer__foot">' +
            '<a class="btn btn--full" href="shop.html" data-close-nav>Shop All</a>' +
            '<a class="btn btn--ghost btn--full" href="https://wa.me/' + esc(digits(S.settings.whatsapp)) + '" target="_blank" rel="noopener noreferrer">WhatsApp Us</a>' +
          '</div>' +
        '</div>';
      qsa("[data-close-nav]", host).forEach(function (b) {
        b.addEventListener("click", function () { UI.closeMobileNav(); });
      });
      qsa("[data-mtoggle]", host).forEach(function (b) {
        b.addEventListener("click", function () {
          b.closest(".mnav__item").classList.toggle("is-open");
        });
      });
    },

    openMobileNav: function () {
      qs("#mobile-nav").classList.add("is-open");
      document.body.classList.add("is-locked");
    },
    closeMobileNav: function () {
      qs("#mobile-nav").classList.remove("is-open");
      document.body.classList.remove("is-locked");
    },

    /* ----- toast ----- */
    toast: function (msg) {
      var root = qs("#toast-root");
      if (!root) return;
      var t = document.createElement("div");
      t.className = "toast";
      t.innerHTML = I.check + "<span>" + esc(msg) + "</span>";
      root.appendChild(t);
      setTimeout(function () {
        t.classList.add("is-out");
        setTimeout(function () { t.remove(); }, 320);
      }, 2600);
    },

    /* ----- cards binding ----- */
    bindCards: function (ctx) {
      qsa("[data-wish]", ctx).forEach(function (b) {
        if (b._bound) return;
        b._bound = true;
        b.addEventListener("click", function (e) {
          e.preventDefault();
          var on = S.toggleWish(b.dataset.wish);
          b.classList.toggle("is-on", on);
          UI.syncCounts();
          UI.toast(on ? "Saved to wishlist" : "Removed from wishlist");
        });
      });
      qsa("[data-quick]", ctx).forEach(function (b) {
        if (b._bound) return;
        b._bound = true;
        b.addEventListener("click", function (e) {
          e.preventDefault();
          var p = S.productById(b.dataset.quick);
          if (!p) return;
          if (!p.stock) { UI.toast("This one is sold out"); return; }
          S.addToCart(p, { color: (p.colors || [])[0], size: (p.sizes || [])[0], qty: 1 });
          UI.toast("Added to bag");
          UI.openCart();
        });
      });
    },

    /* ----- reveal on scroll ----- */
    reveal: function () {
      var els = qsa(".reveal:not(.is-in)");
      if (!("IntersectionObserver" in window)) {
        els.forEach(function (e) { e.classList.add("is-in"); });
        return;
      }
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add("is-in");
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
      els.forEach(function (e) { io.observe(e); });
    },

    /* ----- mount all shared chrome ----- */
    mount: function () {
      this.renderAnnouncement();
      this.renderHeader();
      this.renderFooter();
      this.renderCartDrawer();
      this.renderSearch();
      this.renderMobileNav();
      this.bindCards(document);
      this.reveal();

      S.on("cart:change", function () {
        UI.syncCounts();
        if (qs("#cart-drawer") && qs("#cart-drawer").classList.contains("is-open")) UI.paintCart();
      });
      S.on("wish:change", function () { UI.syncCounts(); });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          UI.closeSearch();
          UI.closeCart();
          UI.closeMobileNav();
        }
      });

      // global quick-add / wishlist delegation
      document.addEventListener("click", function (e) {
        var q = e.target.closest("[data-quick]");
        if (q && !q._bound) {
          e.preventDefault();
          var p = S.productById(q.dataset.quick);
          if (p) {
            if (!p.stock) { UI.toast("This one is sold out"); return; }
            S.addToCart(p, { color: (p.colors || [])[0], size: (p.sizes || [])[0], qty: 1 });
            UI.toast("Added to bag");
            UI.openCart();
          }
        }
      });
    }
  };

  global.UI = UI;
})(window);
