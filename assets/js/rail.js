/* ==========================================================================
   ZIQWEAR — 3D Rail Wardrobe
   Every garment hangs edge-on from the rail. Hover turns it to face you,
   click pulls it off the rail into focus. Transitions are lerped per frame
   so the whole rail moves as one physical object.
   ========================================================================== */
(function (global) {
  "use strict";

  var S = global.Store, UI = global.UI;
  var qs = UI.qs, qsa = UI.qsa, esc = UI.esc, I = UI.icons;

  /* Prepared hanging assets live in rail-assets.js so the homepage teaser and
     the rail agree on what each piece looks like hanging. */
  var RAIL_ASSETS = global.RAIL_ASSETS || {};

  var HANGER = '<svg viewBox="0 0 42 58" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 3.5c-4.4 0-7 2.6-7 5.8 0 2.4 1.4 3.9 3.1 5 1.9 1.3 3.9 2.3 3.9 4.6 0 1.6-1.2 2.6-2.6 3.1"/>' +
    '<path d="M18.5 27.2 4 43.6c-1.4 1.6-.3 4.1 2 4.1h30c2.3 0 3.4-2.5 2-4.1L23.5 27.2a3.9 3.9 0 0 0-5 0z"/>' +
    '</svg>';

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  function shortLabel(title) {
    var t = String(title || "").replace(/[“”"']/g, " ");
    var parts = t.split(/\s+/).filter(Boolean);
    if (!parts.length) return "Piece";
    if (parts[0].toUpperCase() === "ZIQWEAR") return parts.slice(1, 3).join(" ") || parts[0];
    return parts.slice(0, 2).join(" ");
  }

  /* ------------------------------------------------------------------ */
  /* opts.panel === false renders the rail on its own, with no control
     column — that is the shape the homepage gets. */
  function Rail(host, opts) {
    opts = opts || {};
    this.host = host;
    this.panel = opts.panel !== false;
    this.items = [];
    this.focus = -1;
    this.hover = -1;
    this.puff = 62;          /* 0 = facing front, 100 = flat edge-on */
    this.flow = 58;
    this.flowOn = true;
    this.size = {};          /* handle -> chosen size */
    this.overrides = {};     /* handle -> object URL of a dropped mockup */
    this.tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    this.time = 0;
    this._off = [];          /* registered listeners, torn down by destroy() */
    this.reduce = global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pointerFine = global.matchMedia("(hover: hover) and (pointer: fine)").matches;
    this.build();

    /* no cursor to hover with on touch, so let the rail hang open for a tap */
    if (!this.pointerFine) {
      this.puff = 30;
      this.setPuff(30);
    }

    this.bind();
    this.layout();
    this.watch();
    this.loop();
  }

  Rail.prototype.on = function (target, evt, fn, o) {
    target.addEventListener(evt, fn, o);
    this._off.push(function () { target.removeEventListener(evt, fn, o); });
  };

  Rail.prototype.products = function () {
    var list = S.products ? S.products({}) : (S.db.products || []);
    return list.filter(function (p) { return p.active !== false; });
  };

  Rail.prototype.build = function () {
    var self = this;
    var prods = this.products();

    var stage =
        '<div class="rail-stage" id="rail-stage">' +
          '<div class="rail-spot"></div>' +
          '<div class="rail-kicker"><span>Drop 01 — Core Archive · hanging now</span></div>' +
          '<div class="rail-track" id="rail-track"><div class="rail-bar"></div></div>' +
          '<div class="rail-floor"></div>' +
          '<button class="rail-nav rail-nav--prev" id="rail-prev" type="button" aria-label="Previous garment">' + I.chevL + '</button>' +
          '<button class="rail-nav rail-nav--next" id="rail-next" type="button" aria-label="Next garment">' + I.chevR + '</button>' +
          '<div class="rail-buy" id="rail-buy"></div>' +
          '<div class="rail-caption">' +
            '<span class="rail-caption__index" id="rail-index"></span>' +
            '<h2 class="rail-caption__name" id="rail-name"></h2>' +
            '<p class="rail-caption__meta" id="rail-meta"></p>' +
          '</div>' +
          '<div class="rail-word">Wardrobe</div>' +
        '</div>';

    var panel = this.panel ?
        '<aside class="rail-panel">' +
          '<div class="rail-panel__brand">' +
            '<img src="assets/img/logo-z.png" alt="">' +
            '<span>' + esc(S.settings.storeName || "ZIQWEAR") + '</span>' +
          '</div>' +
          '<p class="rail-panel__note">The rail — everything hanging, like the shop.</p>' +
          '<button class="rail-btn rail-btn--solid" id="rail-toggle" type="button">Back to one garment</button>' +
          '<div>' +
            '<span class="rail-label">Garment</span>' +
            '<div class="rail-chips" id="rail-chips"></div>' +
          '</div>' +
          '<div class="rail-drop" id="rail-drop" role="button" tabindex="0">' +
            '<b>Drop your mockup</b>' +
            '<small>one transparent PNG/WebP with front&nbsp;+&nbsp;side, or front only</small>' +
          '</div>' +
          '<input type="file" id="rail-file" accept="image/png,image/webp" hidden>' +
          '<div class="rail-slider">' +
            '<div class="rail-slider__head"><span class="rail-label" style="margin:0">Puff</span>' +
              '<span class="rail-slider__val" id="puff-val">62%</span></div>' +
            '<input type="range" class="rail-range" id="puff" min="0" max="100" value="62" aria-label="How puffed the garments hang">' +
          '</div>' +
          '<div class="rail-slider">' +
            '<label class="rail-check"><input type="checkbox" id="flow-on" checked>' +
              '<span class="rail-check__box">' + I.check + '</span>' +
              '<span class="rail-check__text">Flow</span></label>' +
            '<div class="rail-slider__head"><span class="rail-label" style="margin:0">Sway</span>' +
              '<span class="rail-slider__val" id="flow-val">58%</span></div>' +
            '<input type="range" class="rail-range" id="flow" min="0" max="100" value="58" aria-label="How much the fabric swings">' +
          '</div>' +
          '<p class="rail-hint" id="rail-hint"></p>' +
        '</aside>' : '';

    this.host.innerHTML =
      '<div class="rail-grid' + (this.panel ? "" : " rail-grid--solo") + '">' +
        panel + stage +
      '</div>';

    this.stage = qs("#rail-stage", this.host);
    this.track = qs("#rail-track", this.host);
    this.nameEl = qs("#rail-name", this.host);
    this.metaEl = qs("#rail-meta", this.host);
    this.indexEl = qs("#rail-index", this.host);
    this.buyEl = qs("#rail-buy", this.host);
    this.hintEl = this.panel ? qs("#rail-hint", this.host) : null;
    this.toggleBtn = this.panel ? qs("#rail-toggle", this.host) : null;
    this.chipEls = [];

    /* one hanging node per product */
    prods.forEach(function (p, i) {
      var cfg = RAIL_ASSETS[p.handle] || {
        src: (p.images || [])[0] || "assets/img/placeholder.jpg",
        label: shortLabel(p.title),
        cloth: 200,
        masked: true
      };
      var node = document.createElement("div");
      node.className = "hang";
      node.style.setProperty("--w", cfg.cloth + "px");
      node.innerHTML =
        '<div class="hang__body">' +
          '<div class="hang__shadow"><img src="' + esc(cfg.src) + '" alt="" aria-hidden="true"></div>' +
          '<div class="hang__hanger">' + HANGER + '</div>' +
          '<div class="hang__cloth' + (cfg.masked ? " is-masked" : "") + '">' +
            '<img src="' + esc(cfg.src) + '" alt="' + esc(p.title) + '" draggable="false" loading="' + (self.panel && i < 3 ? "eager" : "lazy") + '">' +
          '</div>' +
        '</div>' +
        '<div class="hang__hit" role="button" tabindex="0" aria-label="' + esc(p.title) + '"></div>';
      qs(".rail-track", self.host).appendChild(node);

      var it = {
        i: i,
        product: p,
        label: cfg.label,
        cloth: cfg.cloth,
        base: cfg.src,
        node: node,
        body: qs(".hang__body", node),
        hit: qs(".hang__hit", node),
        clothEl: qs(".hang__cloth", node),
        img: qs(".hang__cloth img", node),
        shadowImg: qs(".hang__shadow img", node),
        /* live + target transform state */
        x: 0, y: 0, z: 0, ry: 0, rz: 0, sc: 1, blur: 0, op: 1,
        tx: 0, ty: 0, tz: 0, try_: 0, trz: 0, tsc: 1, tblur: 0, top_: 1,
        imgRatio: 0.95,
        swayY: 0,
        phase: i * 0.9
      };
      self.items.push(it);

      var measure = function () {
        if (it.img.naturalWidth) it.imgRatio = it.img.naturalHeight / it.img.naturalWidth;
      };
      it.img.addEventListener("load", measure);
      if (it.img.complete) measure();
    });

    /* chips */
    if (!this.panel) return;
    var chips = qs("#rail-chips", this.host);
    chips.innerHTML = this.items.map(function (it) {
      return '<button class="rail-chip" type="button" data-goto="' + it.i + '" title="' + esc(it.product.title) + '">' +
        esc(it.label) + '</button>';
    }).join("");
    this.chipEls = qsa(".rail-chip", chips);
  };

  /* keep the range input and the state in one place, so the touch default can
     be applied whether or not a control panel was rendered */
  Rail.prototype.setPuff = function (v) {
    this.puff = v;
    var input = qs("#puff", this.host), out = qs("#puff-val", this.host);
    if (input) input.value = v;
    if (out) out.textContent = v + "%";
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.bind = function () {
    var self = this;

    this.chipEls.forEach(function (c) {
      self.on(c, "click", function () { self.focusTo(parseInt(c.dataset.goto, 10)); });
    });

    this.items.forEach(function (it) {
      var hit = qs(".hang__hit", it.node);
      self.on(hit, "mouseenter", function () { self.hover = it.i; self.caption(); });
      self.on(hit, "mouseleave", function () {
        if (self.hover === it.i) { self.hover = -1; self.caption(); }
      });
      self.on(hit, "click", function () {
        if (self.focus === it.i) self.release();
        else self.focusTo(it.i);
      });
      self.on(hit, "keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); self.focusTo(it.i); }
      });
    });

    if (this.toggleBtn) {
      this.on(this.toggleBtn, "click", function () {
        if (self.focus > -1) self.release();
        else self.focusTo(self.hover > -1 ? self.hover : 0);
      });
    }

    this.on(qs("#rail-prev", this.host), "click", function () { self.step(-1); });
    this.on(qs("#rail-next", this.host), "click", function () { self.step(1); });

    /* pointer parallax across the whole stage */
    this.on(this.stage, "pointermove", function (e) {
      if (!self.pointerFine || self.reduce) return;
      var r = self.stage.getBoundingClientRect();
      self.tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      self.tilt.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
    this.on(this.stage, "pointerleave", function () { self.tilt.tx = 0; self.tilt.ty = 0; });

    /* keyboard: arrows walk the rail, Esc releases it. On the homepage the rail
       is one band among many, so it only answers keys while focus is inside it
       and must never steal the page's own arrow scrolling. */
    this.on(document, "keydown", function (e) {
      if (!qs("#rail-stage", self.host)) return;
      var panel = qs(".rail-panel", self.host);
      if (e.target && panel && panel.contains(e.target)) return;
      if (!self.panel && !(e.target && self.host.contains(e.target))) return;
      var tag = e.target && e.target.tagName;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag || "")) return;
      if (qs("#cart-drawer.is-open, #search-modal.is-open, #mobile-nav.is-open", document)) return;
      if (e.key === "ArrowRight") { self.step(1); }
      else if (e.key === "ArrowLeft") { self.step(-1); }
      else if (e.key === "Escape" && self.focus > -1) { self.release(); }
    });

    var rt;
    this.on(window, "resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () { self.layout(); }, 120);
    });

    if (!this.panel) return;

    /* puff */
    var puff = qs("#puff", this.host), puffVal = qs("#puff-val", this.host);
    this.on(puff, "input", function () {
      self.setPuff(parseInt(puff.value, 10) || 0);
    });

    /* flow */
    var flow = qs("#flow", this.host), flowVal = qs("#flow-val", this.host), flowOn = qs("#flow-on", this.host);
    this.on(flow, "input", function () {
      self.flow = parseInt(flow.value, 10) || 0;
      flowVal.textContent = self.flow + "%";
    });
    this.on(flowOn, "change", function () { self.flowOn = flowOn.checked; });

    /* mockup drop */
    var drop = qs("#rail-drop", this.host), file = qs("#rail-file", this.host);
    this.on(file, "change", function () {
      if (file.files && file.files[0]) self.applyMockup(file.files[0]);
      file.value = "";
    });
    this.on(drop, "click", function () { file.click(); });
    this.on(drop, "keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); }
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      self.on(drop, ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      self.on(drop, ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
    });
    this.on(drop, "drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) self.applyMockup(f);
    });
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.layout = function () {
    var self = this;
    var r = this.stage.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    var n = this.items.length;
    if (!n) return;

    /* keep the rail centred and let the cloth shrink on narrow stages */
    var pad = Math.max(70, this.W * 0.11);
    var span = this.W - pad * 2;
    var step = n > 1 ? span / (n - 1) : 0;
    var maxW = clamp(step * 0.94, 96, 210);

    this.items.forEach(function (it) {
      it.home = pad + step * it.i - (n > 1 ? 0 : span / 2);
      it.w = Math.min(maxW, it.cloth);
      it.node.style.setProperty("--w", it.w + "px");

      /* first pass drops each piece straight onto the rail, otherwise the
         opening frame lerps every garment out of the top-left corner */
      if (!it.seeded) {
        it.seeded = true;
        it.x = it.tx = it.home;
        it.ry = it.try_ = self.puff * 0.86;
      }
    });
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.focusTo = function (i) {
    if (i < 0 || i >= this.items.length) return;
    this.focus = i;
    this.hover = -1;
    this.host.classList.add("is-focus");
    if (this.toggleBtn) this.toggleBtn.textContent = "Back to the rail";
    this.caption();
  };

  Rail.prototype.release = function () {
    this.focus = -1;
    this.hover = -1;
    this.host.classList.remove("is-focus");
    if (this.toggleBtn) this.toggleBtn.textContent = "Back to one garment";
    this.caption();
  };

  Rail.prototype.step = function (dir) {
    var n = this.items.length;
    if (!n) return;
    var i = this.focus > -1 ? (this.focus + dir + n) % n : (dir > 0 ? 0 : n - 1);
    this.focusTo(i);
  };

  Rail.prototype.syncChips = function () {
    var f = this.focus;
    this.chipEls.forEach(function (c) {
      c.classList.toggle("is-on", parseInt(c.dataset.goto, 10) === f);
    });
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.caption = function () {
    var it = this.focus > -1 ? this.items[this.focus]
           : this.hover > -1 ? this.items[this.hover] : null;
    var n = this.items.length;

    if (this.focus > -1) {
      this.indexEl.textContent = String(this.focus + 1).padStart(2, "0") + " / " + String(n).padStart(2, "0");
    } else if (it) {
      this.indexEl.textContent = String(it.i + 1).padStart(2, "0") + " / " + String(n).padStart(2, "0");
    } else {
      this.indexEl.textContent = n + " pieces on the rail";
    }

    var color = it && (it.product.colors || [])[0];
    this.nameEl.textContent = it ? it.product.title : (S.settings.tagline || "Wear your identity");

    if (it) {
      var price = S.money(it.product.price);
      var was = it.product.compareAt ? " <s>" + S.money(it.product.compareAt) + "</s>" : "";
      var stock = it.product.stock > 0
        ? '<span style="opacity:.55"> · ' + it.product.stock + " left</span>"
        : '<span style="color:var(--sale)"> · sold out</span>';
      this.metaEl.innerHTML = "<b>" + price + "</b>" + was +
        (color ? ' · ' + esc(color) : "") + stock;
    } else {
      this.metaEl.textContent = "Hover to turn a piece · click to open it";
    }

    if (this.hintEl) {
      this.hintEl.textContent = this.focus > -1
        ? "Drop a mockup to reskin this piece, or use the arrows to move along the rail."
        : "Hover to turn one to the front, click to open it. Pick a garment above, then drop a mockup to replace it.";
    }

    this.paintBuy();
    this.syncChips();
  };

  /* the buy row only exists in focus mode */
  Rail.prototype.paintBuy = function () {
    if (this.focus < 0) { this.buyEl.innerHTML = ""; return; }
    var it = this.items[this.focus], p = it.product, self = this;
    var sizes = p.sizes || [];
    var chosen = this.size[p.handle] || sizes[0] || "";

    this.buyEl.innerHTML =
      '<div class="rail-sizes">' + sizes.map(function (s) {
        return '<button class="rail-size' + (s === chosen ? " is-on" : "") + '" type="button" data-size="' + esc(s) + '">' + esc(s) + '</button>';
      }).join("") + '</div>' +
      '<button class="rail-btn rail-btn--gold" type="button" data-add' + (p.stock ? "" : " disabled") + '>' +
        (p.stock ? "Add to bag" : "Sold out") + '</button>' +
      '<a class="rail-btn" href="product.html?p=' + encodeURIComponent(p.handle) + '">View piece</a>' +
      '<button class="rail-btn' + (S.inWish(p.id) ? " is-on" : "") + '" type="button" data-wish="' + esc(p.id) + '" aria-label="Save to wishlist">' +
        I.heart + '</button>';

    qsa("[data-size]", this.buyEl).forEach(function (b) {
      b.addEventListener("click", function () {
        self.size[p.handle] = b.dataset.size;
        self.paintBuy();
      });
    });
    var add = qs("[data-add]", this.buyEl);
    if (add && p.stock) {
      add.addEventListener("click", function () {
        S.addToCart(p, { color: (p.colors || [])[0], size: chosen, qty: 1 });
        UI.toast("Added to bag");
        UI.openCart();
      });
    }
    var wish = qs("[data-wish]", this.buyEl);
    if (wish) {
      wish.addEventListener("click", function () {
        var on = S.toggleWish(p.id);
        wish.classList.toggle("is-on", on);
        UI.syncCounts();
        UI.toast(on ? "Saved to wishlist" : "Removed from wishlist");
      });
    }
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.applyMockup = function (file) {
    if (this.focus < 0) { UI.toast("Open a garment first, then drop the mockup"); return; }
    if (!/image\/(png|webp)/.test(file.type || "")) { UI.toast("Use a transparent PNG or WebP"); return; }
    if (file.size > 8 * 1024 * 1024) { UI.toast("Keep the mockup under 8 MB"); return; }

    var it = this.items[this.focus];
    var url = URL.createObjectURL(file);
    var probe = new Image();
    var self = this;
    probe.onload = function () {
      var old = self.overrides[it.product.handle];
      if (old) URL.revokeObjectURL(old);
      self.overrides[it.product.handle] = url;
      it.img.src = url;
      it.shadowImg.src = url;
      it.clothEl.classList.remove("is-masked");
      UI.toast(it.label + " re-skinned — front only, for sizing");
    };
    probe.onerror = function () { UI.toast("That file would not load"); };
    probe.src = url;
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.targets = function () {
    var edge = this.puff * 0.86;                 /* puff 100 ≈ 86° edge-on */
    var focused = this.focus;
    var hover = this.hover;
    var centre = this.W / 2;
    var stageH = this.H;
    var swayAmp = this.flowOn && !this.reduce ? this.flow / 100 : 0;
    var t = this.time;

    this.items.forEach(function (it) {
      var isF = focused === it.i;
      var isH = hover === it.i && focused < 0;

      if (focused > -1) {
        if (isF) {
          /* pull it off the rail and size it to the stage. The 210px of
             translateZ magnifies it again, so aim under half the height. */
          var targetH = clamp(stageH * 0.42, 150, 400);
          it.tx = centre;
          it.ty = stageH * 0.015;
          it.tz = 210;
          it.try_ = 0;
          it.tsc = clamp(targetH / (it.w * (it.imgRatio || 0.95)), 1, 2.8);
          it.tblur = 0;
          it.top_ = 1;
        } else {
          it.tx = it.home;
          it.ty = 0;
          it.tz = -140;
          it.try_ = edge;
          it.tsc = 0.92;
          it.tblur = 9;
          it.top_ = 0.34;
        }
      } else {
        it.tx = it.home;
        it.ty = isH ? -6 : 0;
        it.tz = isH ? 120 : 0;
        it.try_ = isH ? 0 : edge;
        it.tsc = isH ? 1.08 : 1;
        it.tblur = 0;
        it.top_ = hover > -1 && !isH ? 0.6 : 1;
      }

      /* fabric swing — a slow pendulum, each piece offset so the rail breathes */
      it.trz = swayAmp ? Math.sin(t * 0.9 + it.phase) * 2.6 * swayAmp : 0;
      it.swayY = swayAmp ? Math.cos(t * 0.7 + it.phase) * 1.4 * swayAmp : 0;
    });
  };

  Rail.prototype.paint = function () {
    var k = this.reduce ? 1 : 0.14;
    var self = this;

    this.targets();
    this.items.forEach(function (it) {
      it.x = lerp(it.x, it.tx, k);
      it.y = lerp(it.y, it.ty + it.swayY, k);
      it.z = lerp(it.z, it.tz, k);
      it.ry = lerp(it.ry, it.try_, k);
      it.rz = lerp(it.rz, it.trz, k);
      it.sc = lerp(it.sc, it.tsc, k);
      it.blur = lerp(it.blur, it.tblur, k);
      it.op = lerp(it.op, it.top_, k);

      it.node.style.transform = "translate3d(" + it.x.toFixed(2) + "px," + it.y.toFixed(2) + "px," + it.z.toFixed(2) + "px)";
      it.body.style.transform = "rotateY(" + it.ry.toFixed(2) + "deg) rotateZ(" + it.rz.toFixed(2) + "deg) scale(" + it.sc.toFixed(3) + ")";
      it.body.style.filter = it.blur > 0.05 ? "blur(" + it.blur.toFixed(1) + "px)" : "none";
      it.body.style.opacity = it.op.toFixed(3);

      /* the clickable plane has to grow with the garment, or an open piece
         stops taking clicks anywhere but through its middle */
      it.hit.style.transform = "scale(" + it.sc.toFixed(3) + ")";
    });

    /* the rail itself leans toward the cursor */
    this.tilt.x = lerp(this.tilt.x, this.tilt.tx, 0.06);
    this.tilt.y = lerp(this.tilt.y, this.tilt.ty, 0.06);
    this.track.style.transform =
      "rotateY(" + (this.tilt.x * 8.5).toFixed(2) + "deg) rotateX(" + (-this.tilt.y * 2.4).toFixed(2) + "deg)";

    /* the open piece lights up brighter than its neighbours */
    this.items.forEach(function (it) {
      var on = (self.focus === it.i) || (self.hover === it.i && self.focus < 0);
      if (it._lit === on) return;
      it._lit = on;
      it.clothEl.style.filter = on
        ? "brightness(1.06) contrast(1.03) drop-shadow(0 22px 30px rgba(60, 45, 28, 0.30))"
        : "brightness(0.96) drop-shadow(0 14px 22px rgba(60, 45, 28, 0.18))";
    });
  };

  /* ------------------------------------------------------------------ */
  Rail.prototype.loop = function () {
    var self = this;
    var last = performance.now();
    var tick = function (now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      self.time += dt;
      self.paint();
      self.raf = self.visible ? requestAnimationFrame(tick) : 0;
    };
    if (!this.raf) this.raf = requestAnimationFrame(tick);
  };

  /* The homepage rail sits far down the page — stop burning frames on it
     while it is scrolled out of sight. */
  Rail.prototype.watch = function () {
    var self = this;
    if (!("IntersectionObserver" in global)) { this.visible = true; return; }
    this.visible = true;
    this.io = new IntersectionObserver(function (entries) {
      var onScreen = entries.some(function (e) { return e.isIntersecting; });
      if (onScreen === self.visible) return;
      self.visible = onScreen;
      if (onScreen) { self.raf = 0; self.loop(); }
      else if (self.raf) { cancelAnimationFrame(self.raf); self.raf = 0; }
    }, { rootMargin: "200px 0px" });
    this.io.observe(this.stage);
  };

  Rail.prototype.destroy = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.visible = false;
    if (this.io) { this.io.disconnect(); this.io = null; }
    this._off.splice(0).forEach(function (off) { off(); });
    Object.keys(this.overrides).forEach(function (url) { URL.revokeObjectURL(url); });
    this.overrides = {};
    this.host.innerHTML = "";
  };

  /* ------------------------------------------------------------------ */
  /* Only the wardrobe page boots the rail here; the homepage builds its own
     panel-less rail from home.js, and must not have the chrome mounted twice. */
  document.addEventListener("DOMContentLoaded", function () {
    var host = qs("#wardrobe");
    if (!host) return;
    S.init();
    UI.mount();
    global.rail = new Rail(host);
    rail.caption();
    rail.layout();
  });

  global.Rail = Rail;
})(window);
