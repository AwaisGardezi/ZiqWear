/* ==========================================================================
   ZIQWEAR — homepage
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI, I = UI.icons;
  var qs = UI.qs, qsa = UI.qsa, esc = UI.esc;

  /* ---------------- HERO (morphing colour) ---------------- */
  function renderHero() {
    var host = qs("#hero");
    var slides = S.settings.heroSlides || [];
    if (!host || !slides.length) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var DUR = 6000;

    host.className = "mhero";
    /* A slide can carry a picture or a clip behind the word, the product and the
       copy. With bgOnly the media fills the frame on its own and the scrim is
       dropped, because there is no text left to protect. */
    function heroBg(s, i, only) {
      var shot = s.bgVideo || s.bgImage || (only ? s.image : "");
      if (!shot) return "";
      var media = s.bgVideo
        ? '<video class="mhero__bg-media" data-clip="' + esc(s.bgVideo) + '"' +
            (s.bgImage ? ' poster="' + esc(s.bgImage) + '"' : "") +
            ' muted loop playsinline preload="metadata" tabindex="-1"></video>'
        : '<img class="mhero__bg-media" src="' + esc(shot) + '" alt=""' +
            (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">';
      return '<div class="mhero__bg" aria-hidden="true">' + media +
        (only ? "" : '<span class="mhero__bg-scrim"></span>') + '</div>';
    }

    function heroInner(s, i) {
      var shape = s.shape === "arch" ? " mhero__product--arch" : "";
      var tag = i === 0 ? "h1" : "div";
      return '<div class="mhero__inner wrap">' +
        '<span class="mhero__word" aria-hidden="true">' + esc(s.word || "") + '</span>' +
        '<img class="mhero__product' + shape + '" src="' + esc(s.image) + '" alt="' + esc(s.title) + '"' +
          (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async">' +
        '<div class="mhero__copy">' +
          (s.eyebrow ? '<p class="mhero__eyebrow">' + esc(s.eyebrow) + '</p>' : '') +
          '<' + tag + ' class="mhero__title">' + esc(s.title) + '</' + tag + '>' +
          (s.subtitle ? '<p class="mhero__sub">' + esc(s.subtitle) + '</p>' : '') +
          '<div class="mhero__buy">' +
            (s.price ? '<span class="mhero__price">' + S.money(s.price) +
              (s.compareAt ? '<s>' + S.money(s.compareAt) + '</s>' : '') + '</span>' : '') +
            (s.cta ? '<a class="mhero__cta" href="' + esc(UI.safeUrl(s.link, "shop.html")) + '">' +
              esc(s.cta) + I.arrow + '</a>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }

    host.innerHTML =
      '<div class="mhero__wash"></div><div class="mhero__grain"></div>' +
      '<div class="mhero__slides">' +
        slides.map(function (s, i) {
          var only = !!s.bgOnly;
          /* The heading still reaches readers and search when the slide is bare. */
          var bare = '<' + (i === 0 ? "h1" : "div") + ' class="sr-only">' +
            esc(s.title || s.word || ("Slide " + (i + 1))) + '</' + (i === 0 ? "h1" : "div") + '>';
          return '<div class="mhero__slide' + (i === 0 ? " is-active" : "") + '" data-slide="' + i + '">' +
            heroBg(s, i, only) + (only ? bare : heroInner(s, i)) +
          '</div>';
        }).join("") +
      '</div>' +
      '<div class="mhero__swatches" role="tablist" aria-label="Featured drops">' +
        slides.map(function (s, i) {
          var bg = (s.theme && s.theme.bg) || "#f6f6f6";
          return '<button class="mhero__sw' + (i === 0 ? " is-active" : "") + '" data-sw="' + i + '"' +
            ' style="--sw:' + esc(UI.safeColor(bg, "#f6f6f6")) + '" role="tab" aria-selected="' + (i === 0 ? "true" : "false") + '"' +
            ' aria-label="' + esc(s.word || ("Slide " + (i + 1))) + '"></button>';
        }).join("") +
      '</div>' +
      '<div class="mhero__bar"><i></i></div>';

    var els = qsa(".mhero__slide", host);
    var sws = qsa(".mhero__sw", host);
    var bar = qs(".mhero__bar i", host);
    var cur = 0, timer = null;
    var bgClips = bindClips(host, function () { paint(); });

    function paint() {
      var th = slides[cur].theme || {};
      host.style.backgroundColor = UI.safeColor(th.bg, "#f0f0f0");
      els.forEach(function (el, i) {
        el.classList.toggle("is-active", i === cur);
        var bg = el.querySelector(".mhero__bg-media");
        if (bg && bg.tagName === "VIDEO") {
          if (i === cur && !reduce) bg.play().catch(function () {});
          else bg.pause();
        }
      });
      sws.forEach(function (b, i) {
        b.classList.toggle("is-active", i === cur);
        b.setAttribute("aria-selected", i === cur ? "true" : "false");
      });
    }

    function runBar() {
      if (!bar) return;
      bar.classList.remove("is-running");
      void bar.offsetWidth;
      bar.classList.add("is-running");
    }

    function go(n) {
      cur = (n + els.length) % els.length;
      paint();
      runBar();
    }

    function restart() {
      clearInterval(timer);
      timer = null;
      if (els.length < 2 || reduce) {
        if (bar) bar.parentNode.style.display = "none";
        return;
      }
      runBar();
      timer = setInterval(function () { go(cur + 1); }, DUR);
    }

    sws.forEach(function (b, i) {
      b.addEventListener("click", function () {
        go(i);
        clearInterval(timer);
        timer = null;
      });
    });

    host.addEventListener("mouseenter", function () { clearInterval(timer); timer = null; });
    host.addEventListener("mouseleave", restart);

    document.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (window.scrollY > host.offsetHeight) return;
      go(cur + (e.key === "ArrowRight" ? 1 : -1));
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        clearInterval(timer); timer = null;
        bgClips.forEach(function (v) { v.pause(); });
      } else {
        restart();
        paint();
      }
    });

    paint();
    restart();
  }

  /* ---------------- PROMO STRIP ---------------- */
  function renderPromo() {
    var host = qs("#promo-strip");
    var items = S.settings.promoStrip || [];
    if (!host || !items.length) return;
    var map = { truck: I.truck, cash: I.cash, return: I.ret, shield: I.shield };
    host.className = "promo-strip";
    host.innerHTML = '<div class="wrap"><div class="promo-strip__grid">' +
      items.map(function (it) {
        return '<div class="promo-item">' + (map[it.icon] || I.shield) +
          '<div><strong>' + esc(it.title) + '</strong><span>' + esc(it.text) + '</span></div></div>';
      }).join("") +
      '</div></div>';
  }

  /* ---------------- THE DROP ---------------- */
  /* Every live product lands here automatically — newest first. */
  var DROP_MAX = 12;

  function renderDrop() {
    var host = qs("#drop");
    if (!host) return;
    var all = S.sortList(S.products(), "newest");
    if (!all.length) {
      host.innerHTML = '<div class="wrap"><div class="section-head"><div>' +
        '<p class="eyebrow">Nothing here yet</p><h2>The <em>Drop</em></h2></div></div>' +
        '<p class="drop-empty">No products are live right now. Add one from the <a href="admin.html">admin panel</a> and it will appear here.</p></div>';
      return;
    }
    var list = all.slice(0, DROP_MAX);
    var more = all.length > DROP_MAX;

    host.innerHTML = '<div class="wrap">' +
      '<div class="section-head reveal">' +
        '<div><p class="eyebrow">Drop 01 \u2014 Core Archive</p><h2>The <em>Drop</em></h2></div>' +
        '<a class="section-head__link" href="shop.html">' +
          (more ? 'Shop all ' + all.length + ' pieces' : 'Shop everything') + '</a>' +
      '</div>' + grid(list) +
      (more ? '<div class="drop-more"><a class="btn btn--ghost" href="shop.html">View all ' + all.length + ' products</a></div>' : '') +
      '</div>';
  }

  /* Re-render when the catalogue changes in another tab (e.g. the admin panel). */
  function watchCatalogue() {
    window.addEventListener("storage", function (e) {
      if (e.key !== "ziqwear.db.v1") return;
      S.init();
      renderDrop();
      renderCollections();
      renderRail();
      renderLookbook();
      UI.bindCards(document);
      UI.reveal();
    });
  }

  /* ---------------- COLLECTION TILES ---------------- */
  function renderCollections() {
    var host = qs("#collections");
    if (!host) return;
    var cats = S.categories({ home: true });
    if (!cats.length) { host.innerHTML = ""; return; }
    var n = Math.min(cats.length, 6);
    var spans = n >= 3 ? ["tile--wide", "", "", "", "", ""] : [];
    var gridCls = n >= 3 ? "tiles" : (n === 2 ? "tiles tiles--duo" : "tiles tiles--one");
    host.innerHTML = '<div class="wrap">' +
      '<div class="section-head reveal">' +
        '<div><p class="eyebrow">Browse</p><h2>' + esc(S.settings.storeName) + ' Collections</h2></div>' +
        '<a class="section-head__link" href="shop.html">View everything</a>' +
      '</div>' +
      '<div class="' + gridCls + ' reveal">' + cats.slice(0, 6).map(function (c, i) {
        var count = S.products({ category: c.id }).length;
        return '<a class="tile ' + (spans[i] || "") + '" href="shop.html?c=' + encodeURIComponent(c.id) + '">' +
          '<img src="' + esc(c.image) + '" alt="' + esc(c.name) + '" loading="lazy">' +
          '<div class="tile__body"><h3>' + esc(c.name) + '</h3><span>' + count + (count === 1 ? ' piece' : ' pieces') + '</span></div>' +
        '</a>';
      }).join("") + '</div></div>';
  }

  /* Clips picked in the admin live in IndexedDB, so each one is resolved to a
     blob: URL here. Files on disk and links are used exactly as they are.
     The blob arrives after the observer is already running, so play is retried
     once the source lands — otherwise the clip sits on its poster. */
  function bindClips(scope, afterResolve) {
    var clips = qsa("[data-clip]", scope);
    if (!clips.length) return clips;

    var live = [];
    function tryPlay(v) {
      if (live.indexOf(v) === -1) return;
      // play() restarts loading by itself; an explicit load() here would cancel it.
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var v = entry.target;
          if (entry.isIntersecting) {
            if (live.indexOf(v) === -1) live.push(v);
            tryPlay(v);
          } else {
            live = live.filter(function (x) { return x !== v; });
            v.pause();
          }
        });
      }, { threshold: 0.4 });
      clips.forEach(function (v) { io.observe(v); });
      // The observer only reports changes, so mark what is already on screen.
      clips.forEach(function (v) {
        var box = v.getBoundingClientRect();
        if (box.bottom > 0 && box.top < window.innerHeight) live.push(v);
      });
    } else {
      live = clips.slice();
    }

    clips.forEach(function (video) {
      ZiqMedia.url(video.dataset.clip, function (src) {
        if (!src || !video.isConnected) return;
        video.src = src;
        // Assigning src restarts the load algorithm, and a play() issued in this same
        // tick is cancelled by it, so wait for the first frame before trying to play.
        function ready() {
          if (afterResolve) afterResolve(video);
          else tryPlay(video);
        }
        if (video.readyState >= 2) ready();
        else {
          video.addEventListener("loadeddata", ready, { once: true });
          video.addEventListener("error", ready, { once: true });
        }
      });
    });
    return clips;
  }

  /* ---------------- LOOKBOOK ---------------- */
  function renderLookbook() {
    var host = qs("#lookbook");
    var items = S.settings.lookbook || [];
    if (!host || !items.length) return;

    var fit = function (it) {
      return it.imageFit === "contain" ? ' style="object-fit:contain"' : "";
    };
    var overlay = function (it, href, asButton) {
      var cta = asButton
        ? '<a class="look-card__cta look-card__cta--btn" href="' + href + '">' +
            (it.product ? "View product" : "Shop now") + " " + I.arrow + '</a>'
        : '<span class="look-card__cta">' + (it.product ? "View product" : "Shop now") +
            " " + I.arrow + "</span>";
      return '<div class="look-card__overlay">' +
        (it.tag ? '<span class="look-card__tag">' + esc(it.tag) + '</span>' : "") +
        '<p class="look-card__title">' + esc(it.title) + '</p>' +
        cta +
      '</div>';
    };

    host.innerHTML = '<div class="wrap">' +
      '<div class="section-head reveal">' +
        '<div><p class="eyebrow">Watch. Discover. Shop instantly.</p><h2>Shop The <em>Look</em></h2></div>' +
      '</div>' +
      '<div class="look-rail reveal">' + items.map(function (it) {
        var href = esc(UI.safeUrl(it.link, "shop.html"));
        /* A clip needs room for its own play behaviour, so the card is a figure
           with a real “View product” button rather than one big anchor. */
        if (it.video) {
          return '<figure class="look-card look-card--video">' +
            '<video class="look-card__media" data-clip="' + esc(it.video) + '"' +
              (it.image ? ' poster="' + esc(it.image) + '"' : "") + fit(it) +
              ' muted loop playsinline preload="metadata" tabindex="-1"></video>' +
            overlay(it, href, true) +
          '</figure>';
        }
        return '<a class="look-card" href="' + href + '">' +
          '<img src="' + esc(it.image) + '" alt="' + esc(it.title) + '" loading="lazy"' + fit(it) + '>' +
          overlay(it, href, false) +
        '</a>';
      }).join("") + '</div></div>';

    bindClips(host);
  }

  /* ---------------- MARQUEE ---------------- */
  function renderMarquee() {
    var host = qs("#marquee");
    if (!host) return;
    var txt = S.settings.marquee || "WEAR YOUR IDENTITY";
    var one = '<span class="marquee__item">' + esc(txt) + '</span>';
    var group = new Array(4).join(one) + one;
    host.className = "marquee";
    host.innerHTML = '<div class="marquee__track">' + group + group + '</div>';
  }

  /* ---------------- PRODUCT SECTIONS ---------------- */
  function grid(list) {
    return '<div class="pgrid">' + list.map(function (p) { return UI.productCard(p); }).join("") + '</div>';
  }

  /* ---------------- EDITORIAL ---------------- */
  function renderEditorial() {
    var host = qs("#editorial");
    var e = S.settings.editorial;
    if (!host || !e) return;
    host.className = "editorial";
    host.innerHTML =
      '<div class="editorial__media"><img src="' + esc(e.image) + '" alt="' + esc(e.eyebrow) + '" loading="lazy"></div>' +
      '<div class="editorial__body reveal">' +
        '<p class="eyebrow">' + esc(e.eyebrow) + '</p>' +
        '<h2>' + esc(e.title) + '</h2>' +
        '<p>' + esc(e.text) + '</p>' +
        '<a class="btn btn--ghost" href="' + esc(UI.safeUrl(e.link, "shop.html")) + '">' + esc(e.cta) + '</a>' +
      '</div>';
  }

  /* ---------------- REVIEWS ---------------- */
  var REVIEWS_FALLBACK = [
    { name: "Hamza R.", city: "Multan", text: "Ordered the Sovereign tee on a Thursday, had it by Saturday. The print is thick \u2014 no cracking after four washes.", stars: 5 }
  ];

  function renderReviews() {
    var host = qs("#reviews");
    if (!host) return;
    var list = (S.settings.reviews && S.settings.reviews.length) ? S.settings.reviews : REVIEWS_FALLBACK;
    host.innerHTML = '<div class="wrap">' +
      '<div class="section-head reveal">' +
        '<div><p class="eyebrow">' + esc(S.settings.reviewsEyebrow || "Verified buyers") + '</p><h2>What People <em>Say</em></h2></div>' +
      '</div>' +
      '<div class="reviews">' + list.map(function (r) {
        var stars = Math.max(1, Math.min(5, parseInt(r.stars, 10) || 5));
        return '<figure class="review reveal">' +
          '<div class="stars">' + new Array(stars + 1).join(I.star) + '</div>' +
          '<p>\u201c' + esc(r.text) + '\u201d</p>' +
          '<figcaption class="review__who"><span class="review__avatar">' + esc((r.name || "?").charAt(0)) + '</span>' +
            '<span><b>' + esc(r.name) + '</b>' + (r.city ? ' \u00b7 ' + esc(r.city) : '') + '</span></figcaption>' +
        '</figure>';
      }).join("") + '</div></div>';
  }

  /* ---------------- NEWSLETTER ---------------- */
  function renderNewsletter() {
    var host = qs("#newsletter");
    if (!host) return;
    host.innerHTML = '<div class="wrap wrap--narrow">' +
      '<h2>' + esc(S.settings.newsletterTitle) + '</h2>' +
      '<p>' + esc(S.settings.newsletterText) + '</p>' +
      '<form data-newsletter><input type="email" placeholder="Your email address" required aria-label="Email">' +
      '<button type="submit">Subscribe ' + I.arrow + '</button></form>' +
      '</div>';
    var form = qs("[data-newsletter]", host);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = qs("input", form);
      if (!input.value) return;
      UI.toast("You're on the list \u2014 welcome to ZIQWEAR.");
      input.value = "";
    });
  }

  /* ---------------- THE RAIL ---------------- */
  /* The real 3D rail, stripped of its control panel: hover turns a piece,
     click pulls it off the rail, and the buy row works exactly like the shop. */
  function renderRail() {
    var host = qs("#railband");
    if (!host) return;

    if (window.railBand) { window.railBand.destroy(); window.railBand = null; }

    var head = '<div class="wrap rail-band__head"><div class="section-head reveal">' +
        '<div><p class="eyebrow">New way to browse</p><h2>Walk the <em>rail</em></h2></div>' +
        '<a class="section-head__link" href="wardrobe.html">Open the full wardrobe</a>' +
      '</div></div>';

    if (!window.Rail || !S.products().length) {
      host.className = "section";
      host.innerHTML = '<div class="wrap"><p class="drop-empty">Nothing is hanging on the rail yet — ' +
        '<a href="shop.html">browse the shop</a> or add pieces from the admin.</p></div>';
      return;
    }

    host.className = "rail-shell rail-shell--band";
    host.innerHTML = head + '<div class="rail-band__stage"></div>';

    var rail = new Rail(qs(".rail-band__stage", host), { panel: false });
    rail.caption();
    rail.layout();
    window.railBand = rail;
  }

  /* ---------------- BOOT ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    UI.mount();
    renderHero();
    renderPromo();
    renderMarquee();
    renderDrop();
    renderCollections();
    renderRail();
    renderLookbook();
    renderEditorial();
    renderReviews();
    renderNewsletter();
    watchCatalogue();
    UI.bindCards(document);
    UI.reveal();
  });
})();
