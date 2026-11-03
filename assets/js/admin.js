/* ==========================================================================
   ZIQWEAR — admin panel
   Full CRUD over products, categories, orders, content and settings.
   ========================================================================== */
(function () {
  "use strict";

  var S = window.Store, UI = window.UI, I = UI.icons, Sec = window.Sec;
  var qs = UI.qs, qsa = UI.qsa, esc = UI.esc;

  var view = "dashboard";
  var productQuery = "";
  var productCat = "";
  var draft = null;
  var productSel = {};

  /* ---------- icons ---------- */
  var A = {
    dash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
    box: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>',
    grid: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    cart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
    layers: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    cog: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
    save: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 15h8"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>',
    edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h4L20 8l-4-4L4 16v4z"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    copy: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0014.5 4H5.5A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/></svg>',
    eye: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    dl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v12M7 11l5 5 5-5M4 20h16"/></svg>',
    up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20V8M7 12l5-5 5 5M4 4h16"/></svg>',
    lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
    key: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/></svg>'
  };

  /* =================== helpers =================== */
  function toast(msg) { UI.toast(msg); }

  function openModal(title, bodyHTML, footHTML, opts) {
    qs("#amodal-title").textContent = title;
    qs("#amodal-body").innerHTML = bodyHTML;
    qs("#amodal-foot").innerHTML = footHTML || "";
    var panel = qs("#amodal-panel");
    panel.className = "amodal__panel" + (opts && opts.small ? " amodal__panel--sm" : "");
    qs("#amodal").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    qs("#amodal").classList.remove("is-open");
    document.body.style.overflow = "";
  }

  qsa("[data-close-modal]").forEach(function (b) { b.addEventListener("click", closeModal); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  function confirmDialog(title, text, onYes, danger) {
    openModal(title,
      '<p style="font-size:14px;line-height:1.7;color:var(--ink-60)">' + esc(text) + '</p>',
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button>' +
      '<button class="abtn ' + (danger ? "abtn--danger" : "") + '" id="confirm-yes">Yes, continue</button>',
      { small: true });
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
    qs("#confirm-yes").addEventListener("click", function () {
      closeModal();
      onYes();
    });
  }

  function money(n) { return S.money(n); }

  function compressImage(file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var max = 900;
        var w = img.width, h = img.height;
        if (Math.max(w, h) > max) {
          var r = max / Math.max(w, h);
          w = Math.round(w * r); h = Math.round(h * r);
        }
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        // PNG keeps the transparency a garment cutout needs; photos stay JPEG.
        cb(c.toDataURL(/png/i.test(file.type) ? "image/png" : "image/jpeg", 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- picture fields ----------
     Every content image the admin sets can come from three places: a file he
     uploads, a picture already on a product, or a link he pastes. All three end
     in the same text field so the storefront keeps reading one value.
     `fit` adds the whole-picture / fill-the-frame choice for slots that would
     otherwise crop whatever he uploads. */

  function pictureField(id, value, label, hint, fit) {
    var url = String(value || "").trim();
    return '<div class="f-group f-full">' +
      '<label class="f-label" for="' + id + '">' + esc(label || "Picture") + '</label>' +
      '<div class="pic-field" data-pic-field="' + id + '">' +
        '<div class="pic-field__preview" data-pic-preview="' + id + '">' +
          (url ? '<img src="' + esc(url) + '" alt="Picture preview">'
               : '<span class="pic-field__empty">No picture yet</span>') +
        '</div>' +
        '<div class="pic-field__side">' +
          '<input class="f-input" id="' + id + '" data-pic-typed value="' + esc(value || "") + '"' +
            ' placeholder="assets/img/… or a full https:// link">' +
          '<div class="pic-field__btns">' +
            '<label class="abtn abtn--ghost abtn--sm">' + A.up + ' Upload picture' +
              '<input type="file" accept="image/*" hidden data-pic-upload="' + id + '"></label>' +
            '<button type="button" class="abtn abtn--ghost abtn--sm" data-pic-pick="' + id + '">' +
              A.grid + ' Product picture</button>' +
            '<button type="button" class="abtn abtn--ghost abtn--sm" data-pic-clear="' + id + '">Clear</button>' +
          '</div>' +
          '<div class="pic-field__shots" data-pic-shots="' + id + '" hidden></div>' +
          (fit === undefined ? "" :
            '<div class="pic-field__fit">' +
              '<label class="f-label" for="' + id + '-fit">How it shows on the site</label>' +
              '<select class="f-input" id="' + id + '-fit">' +
                '<option value="contain"' + (fit === "contain" ? " selected" : "") + '>Show the whole picture</option>' +
                '<option value="cover"' + (fit === "cover" ? " selected" : "") + '>Fill the frame (crops)</option>' +
              '</select>' +
            '</div>') +
          (hint ? '<p class="f-help">' + esc(hint) + '</p>' : "") +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function picturePreviewBox(id) {
    return qs('[data-pic-preview="' + id + '"]');
  }

  function showPicture(id, value) {
    var input = qs("#" + id);
    var box = picturePreviewBox(id);
    if (!input || !box) return;
    var url = String(value || "").trim();
    input.value = url;
    box.innerHTML = url
      ? '<img src="' + esc(url) + '" alt="Picture preview">'
      : '<span class="pic-field__empty">No picture yet</span>';
  }

  /* The catalogue opens in its own strip under the buttons rather than a modal:
     a modal would replace the slide/look editor that is already open and lose
     whatever the admin has typed into it. */
  function closeShots(id) {
    var panel = qs('[data-pic-shots="' + id + '"]');
    if (panel) { panel.hidden = true; panel.innerHTML = ""; }
  }

  function pickFromCatalogue(id) {
    var panel = qs('[data-pic-shots="' + id + '"]');
    if (!panel) return;
    if (!panel.hidden) { closeShots(id); return; }

    var shots = [];
    S.products({ includeInactive: true }).forEach(function (p) {
      (p.images || []).forEach(function (src, i) {
        shots.push({ src: src, name: p.title + (i ? " — view " + (i + 1) : "") });
      });
    });

    panel.innerHTML = shots.length
      ? '<p class="f-help">Tap any picture already in the store to use it here.</p>' +
        '<div class="pic-grid">' + shots.map(function (s, i) {
          return '<button type="button" class="pic-grid__cell" data-shot="' + i + '">' +
            '<img src="' + esc(s.src) + '" alt=""><span>' + esc(s.name) + '</span></button>';
        }).join("") + '</div>'
      : '<p class="f-help">No product pictures yet — upload one instead.</p>';
    panel.hidden = false;

    qsa("[data-shot]", panel).forEach(function (cell) {
      cell.addEventListener("click", function () {
        showPicture(id, shots[+cell.dataset.shot].src);
        closeShots(id);
      });
    });
  }

  function wirePictureFields(root) {
    var scope = root || document;
    qsa("[data-pic-upload]", scope).forEach(function (file) {
      if (file._picBound) return;
      file._picBound = true;
      file.addEventListener("change", function () {
        var picked = file.files && file.files[0];
        if (!picked) return;
        var id = file.dataset.picUpload;
        var box = picturePreviewBox(id);
        if (box) box.innerHTML = '<span class="pic-field__empty">Preparing…</span>';
        compressImage(picked, function (dataUrl) { showPicture(id, dataUrl); });
      });
    });
    qsa("[data-pic-pick]", scope).forEach(function (btn) {
      if (btn._picBound) return;
      btn._picBound = true;
      btn.addEventListener("click", function () { pickFromCatalogue(btn.dataset.picPick); });
    });
    qsa("[data-pic-clear]", scope).forEach(function (btn) {
      if (btn._picBound) return;
      btn._picBound = true;
      btn.addEventListener("click", function () { showPicture(btn.dataset.picClear, ""); });
    });
    qsa("[data-pic-typed]", scope).forEach(function (input) {
      if (input._picBound) return;
      input._picBound = true;
      input.addEventListener("input", function () { showPicture(input.id, input.value); });
    });
  }

  /* ---------- video fields ----------
     Same three sources as a picture, except the file goes to IndexedDB (see
     media.js) because a clip is far too large for the settings blob. The field
     itself only ever holds a "ziqmedia:<id>" reference, a path, or a link. */

  function videoField(id, value, label, hint) {
    var src = String(value || "").trim();
    return '<div class="f-group f-full">' +
      '<label class="f-label" for="' + id + '">' + esc(label || "Video") + '</label>' +
      '<div class="vid-field">' +
        '<div class="vid-field__preview" data-vid-preview="' + id + '">' +
          (src ? '<span class="vid-field__empty">Loading…</span>'
               : '<span class="vid-field__empty">No video yet</span>') +
        '</div>' +
        '<div class="vid-field__side">' +
          '<input class="f-input" id="' + id + '" data-vid-typed value="' + esc(src) + '"' +
            ' placeholder="assets/video/… or a full https:// link">' +
          '<div class="pic-field__btns">' +
            '<label class="abtn abtn--ghost abtn--sm">' + A.up + ' Upload video' +
              '<input type="file" accept="video/*" hidden data-vid-upload="' + id + '"></label>' +
            '<button type="button" class="abtn abtn--ghost abtn--sm" data-vid-clear="' + id + '">Clear</button>' +
          '</div>' +
          (hint ? '<p class="f-help">' + esc(hint) + '</p>' : "") +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function showVideo(id, value) {
    var input = qs("#" + id);
    var box = qs('[data-vid-preview="' + id + '"]');
    if (!input || !box) return;
    var src = String(value || "").trim();
    input.value = src;
    if (!src) { box.innerHTML = '<span class="vid-field__empty">No video yet</span>'; return; }
    box.innerHTML = '<span class="vid-field__empty">Loading…</span>';
    ZiqMedia.url(src, function (resolved) {
      if (!qs('[data-vid-preview="' + id + '"]')) return;
      box.innerHTML = resolved
        ? '<video src="' + esc(resolved) + '" controls muted loop playsinline preload="metadata"></video>'
        : '<span class="vid-field__empty">Clip not found — re-upload it</span>';
    });
  }

  function wireVideoFields(root) {
    var scope = root || document;
    qsa("[data-vid-upload]", scope).forEach(function (file) {
      if (file._vidBound) return;
      file._vidBound = true;
      file.addEventListener("change", function () {
        var picked = file.files && file.files[0];
        if (!picked) return;
        var id = file.dataset.vidUpload;
        var box = qs('[data-vid-preview="' + id + '"]');
        if (box) box.innerHTML = '<span class="vid-field__empty">Saving your clip…</span>';
        ZiqMedia.put(picked, function (ref, err) {
          if (err) {
            toast(err.message);
            showVideo(id, qs("#" + id) ? qs("#" + id).value : "");
            return;
          }
          showVideo(id, ref);
          toast("Clip added — it stays in this browser");
        });
        file.value = "";
      });
    });
    qsa("[data-vid-clear]", scope).forEach(function (btn) {
      if (btn._vidBound) return;
      btn._vidBound = true;
      btn.addEventListener("click", function () {
        var id = btn.dataset.vidClear;
        var current = qs("#" + id);
        var prev = current ? current.value : "";
        ZiqMedia.remove(prev);
        showVideo(id, "");
      });
    });
    qsa("[data-vid-typed]", scope).forEach(function (input) {
      if (input._vidBound) return;
      input._vidBound = true;
      input.addEventListener("change", function () { showVideo(input.id, input.value); });
    });
  }

  /* =================== shell =================== */
  var NAV = [
    { id: "dashboard", label: "Dashboard", icon: A.dash },
    { id: "products", label: "Products", icon: A.box },
    { id: "categories", label: "Categories", icon: A.grid },
    { id: "orders", label: "Orders", icon: A.cart },
    { id: "content", label: "Content", icon: A.layers },
    { id: "settings", label: "Settings", icon: A.cog },
    { id: "security", label: "Security", icon: A.lock },
    { id: "backup", label: "Backup", icon: A.save }
  ];

  function renderShell() {
    qs("#side-brand").innerHTML = UI.logo(26);
    qs("#side-nav").innerHTML = NAV.map(function (n) {
      var count = "";
      if (n.id === "orders") {
        var p = S.orders().filter(function (o) { return o.status === "pending"; }).length;
        if (p) count = '<span class="pill-count">' + p + '</span>';
      }
      if (n.id === "products") count = '<span class="pill-count">' + S.db.products.length + '</span>';
      return '<button class="adm-nav-item' + (view === n.id ? " is-on" : "") + '" data-nav="' + n.id + '">' +
        n.icon + '<span>' + n.label + '</span>' + count + '</button>';
    }).join("");
    qsa("[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () { go(b.dataset.nav); });
    });
    qs("#logout").addEventListener("click", function () {
      S.logout();
      location.reload();
    });
  }

  function go(v) {
    view = v;
    renderShell();
    renderView();
    window.scrollTo({ top: 0 });
  }

  function setTitle(t, actionsHTML) {
    qs("#adm-title").textContent = t;
    qs("#adm-actions").innerHTML = actionsHTML || "";
  }

  function renderView() {
    if (view === "dashboard") return viewDashboard();
    if (view === "products") return viewProducts();
    if (view === "categories") return viewCategories();
    if (view === "orders") return viewOrders();
    if (view === "content") return viewContent();
    if (view === "settings") return viewSettings();
    if (view === "security") return viewSecurity();
    if (view === "backup") return viewBackup();
  }

  /* =================== dashboard =================== */
  function viewDashboard() {
    var st = S.stats();
    var orders = S.orders().slice(0, 6);
    var low = S.db.products.filter(function (p) { return p.stock <= 5; }).slice(0, 6);

    setTitle("Dashboard", '<button class="abtn" id="quick-add">' + A.plus + ' Add product</button>');
    qs("#quick-add").addEventListener("click", function () { openProductModal(null); });

    var lockLeft = Sec.lockRemaining();
    var pol = Sec.policy();

    qs("#adm-view").innerHTML =
      (lockLeft
        ? '<div class="sec-banner sec-banner--bad">' +
            '<div class="sec-banner__icon">' + A.lock + '</div>' +
            '<div class="sec-banner__text"><b>Admin login is blocked</b>' +
              '<span>' + pol.maxFails + ' wrong passwords. Unlocks in ' + hms(lockLeft) + '.</span></div>' +
            '<button class="abtn abtn--sm abtn--ghost" id="go-sec">Security</button>' +
          '</div>'
        : '') +
      '<div class="stats">' +
        stat("Revenue", money(st.revenue), st.orders + " orders all time") +
        stat("Orders", st.orders, st.pending + " awaiting confirmation") +
        stat("Products", st.products, st.active + " live · " + st.outOfStock + " out of stock") +
        stat("Avg. order", money(st.avgOrder), "per completed checkout") +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px" class="dash-grid">' +
        '<div class="card"><div class="card__head"><h2>Recent orders</h2>' +
          '<button class="abtn abtn--ghost abtn--sm" data-nav-go="orders">View all</button></div>' +
          (orders.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>' +
            orders.map(function (o) {
              return '<tr><td style="font-family:var(--font-ui);font-size:11.5px">' + esc(o.id) + '</td>' +
                '<td>' + esc(o.customer.name || "—") + '<div style="font-size:11px;color:var(--muted)">' + esc(o.customer.city || "") + '</div></td>' +
                '<td>' + money(o.total) + '</td>' +
                '<td><span class="tag ' + statusTag(o.status) + '">' + esc(o.status) + '</span></td></tr>';
            }).join("") + '</tbody></table></div>'
            : '<div class="adm-empty">No orders yet. Place a test order from the storefront.</div>') +
        '</div>' +
        '<div class="card"><div class="card__head"><h2>Low stock</h2></div>' +
          (low.length ? '<div style="padding:6px 18px 18px">' + low.map(function (p) {
            return '<div style="display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-soft)">' +
              '<img src="' + esc(p.images[0]) + '" style="width:34px;height:42px;object-fit:cover;border-radius:3px">' +
              '<div style="flex:1;min-width:0"><p style="font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.title) + '</p>' +
              '<p style="font-size:11px;color:var(--muted)">' + (p.stock ? p.stock + " left" : "Out of stock") + '</p></div>' +
              '<button class="abtn abtn--ghost abtn--sm" data-edit="' + esc(p.id) + '">Edit</button></div>';
          }).join("") + '</div>' : '<div class="adm-empty">Everything is well stocked.</div>') +
        '</div>' +
      '</div>';

    qsa("[data-nav-go]").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.navGo); }); });
    qsa("[data-edit]").forEach(function (b) { b.addEventListener("click", function () { openProductModal(b.dataset.edit); }); });
    if (qs("#go-sec")) qs("#go-sec").addEventListener("click", function () { go("security"); });
  }

  function stat(label, value, sub) {
    return '<div class="stat"><p class="stat__label">' + label + '</p>' +
      '<p class="stat__value">' + value + '</p><p class="stat__sub">' + sub + '</p></div>';
  }

  function statusTag(s) {
    if (s === "pending") return "tag--low";
    if (s === "cancelled") return "tag--out";
    if (s === "shipped" || s === "delivered") return "tag--on";
    return "";
  }

  /* =================== products =================== */
  function viewProducts() {
    setTitle("Products", '<button class="abtn" id="new-prod">' + A.plus + ' Add product</button>');
    qs("#new-prod").addEventListener("click", function () { openProductModal(null); });

    var cats = S.categories();
    var list = S.products({ includeInactive: true });
    if (productCat) list = list.filter(function (p) { return p.category === productCat; });
    if (productQuery) {
      var q = productQuery.toLowerCase();
      list = list.filter(function (p) {
        return (p.title + " " + p.sku + " " + p.category).toLowerCase().indexOf(q) > -1;
      });
    }

    var shownIds = list.map(function (p) { return p.id; });
    var selCount = shownIds.filter(function (id) { return productSel[id]; }).length;
    var allSel = shownIds.length > 0 && selCount === shownIds.length;

    qs("#adm-view").innerHTML =
      '<div class="adm-toolbar">' +
        '<div class="adm-search">' + A.search + '<input id="p-search" placeholder="Search products by name or SKU" value="' + esc(productQuery) + '"></div>' +
        '<select class="adm-select" id="p-cat"><option value="">All categories</option>' +
          cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (productCat === c.id ? " selected" : "") + '>' + esc(c.name) + '</option>'; }).join("") +
        '</select>' +
        '<span style="font-size:12px;color:var(--muted)">' + list.length + ' products</span>' +
        (selCount ? '<button class="abtn abtn--danger abtn--sm" id="bulk-del" style="margin-left:auto">' + A.trash + ' Delete ' + selCount + ' selected</button>' : '') +
      '</div>' +
      '<div class="card"><div class="tbl-wrap"><table class="tbl">' +
        '<thead><tr>' +
          '<th class="tbl-check"><input type="checkbox" id="check-all" aria-label="Select all"' + (allSel ? " checked" : "") + '></th>' +
          '<th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Visible</th><th style="text-align:right">Actions</th>' +
        '</tr></thead><tbody>' +
        (list.length ? list.map(function (p) {
          var stockTag = !p.stock ? '<span class="tag tag--out">Out</span>'
            : p.stock <= 5 ? '<span class="tag tag--low">' + p.stock + ' left</span>'
            : p.stock;
          var live = p.active !== false;
          return '<tr' + (productSel[p.id] ? ' class="is-sel"' : '') + '>' +
            '<td class="tbl-check"><input type="checkbox" data-check="' + esc(p.id) + '"' + (productSel[p.id] ? " checked" : "") + ' aria-label="Select ' + esc(p.title) + '"></td>' +
            '<td><div class="tbl-prod"><img src="' + esc(p.images[0] || "") + '" alt="">' +
              '<div><p class="tbl-prod__t">' + esc(p.title) + '</p>' +
              '<p class="tbl-prod__s">' + esc(p.sku || "—") + ' · ' + (p.colors || []).length + ' colours</p></div></div></td>' +
            '<td>' + esc((S.category(p.category) || {}).name || p.category) + '</td>' +
            '<td style="white-space:nowrap">' + money(p.price) +
              (p.compareAt ? '<div style="font-size:11px;color:var(--muted);text-decoration:line-through">' + money(p.compareAt) + '</div>' : '') + '</td>' +
            '<td>' + stockTag + '</td>' +
            '<td><button class="tag tagbtn ' + (live ? "tag--on" : "tag--off") + '" data-toggle="' + esc(p.id) + '" title="Click to ' + (live ? "hide" : "show") + '">' + (live ? "Live" : "Hidden") + '</button></td>' +
            '<td><div class="tbl-actions">' +
              '<button class="abtn abtn--ghost abtn--sm" data-p-edit="' + esc(p.id) + '">' + A.edit + ' Edit</button>' +
              '<button class="abtn abtn--ghost abtn--sm" data-p-dup="' + esc(p.id) + '" title="Duplicate">' + A.copy + '</button>' +
              '<button class="abtn abtn--danger abtn--sm" data-p-del="' + esc(p.id) + '" title="Delete">' + A.trash + ' Delete</button>' +
            '</div></td></tr>';
        }).join("") : '<tr><td colspan="7"><div class="adm-empty">No products match your search.</div></td></tr>') +
        '</tbody></table></div></div>' +
      '<p class="f-help" style="margin-top:12px">Tip: click <b>Live / Hidden</b> to take a product off the storefront without deleting it. Deleted products are gone permanently — export a backup first from <b>Backup</b>.</p>';

    var searchEl = qs("#p-search");
    searchEl.addEventListener("input", function () {
      productQuery = this.value;
      var pos = this.selectionStart;
      viewProducts();
      var el = qs("#p-search");
      el.focus();
      el.setSelectionRange(pos, pos);
    });
    qs("#p-cat").addEventListener("change", function () {
      productCat = this.value;
      viewProducts();
    });

    var checkAll = qs("#check-all");
    if (checkAll) checkAll.addEventListener("change", function () {
      shownIds.forEach(function (id) { productSel[id] = checkAll.checked; });
      viewProducts();
    });
    qsa("[data-check]").forEach(function (b) {
      b.addEventListener("change", function () {
        productSel[b.dataset.check] = b.checked;
        viewProducts();
      });
    });
    var bulk = qs("#bulk-del");
    if (bulk) bulk.addEventListener("click", function () {
      var ids = shownIds.filter(function (id) { return productSel[id]; });
      confirmDialog("Delete " + ids.length + " product" + (ids.length === 1 ? "" : "s") + "?",
        "These will be removed from the store permanently. This cannot be undone.",
        function () {
          ids.forEach(function (id) { S.removeProduct(id); });
          ids.forEach(function (id) { delete productSel[id]; });
          toast(ids.length + " product" + (ids.length === 1 ? "" : "s") + " deleted");
          viewProducts();
          renderShell();
        }, true);
    });

    qsa("[data-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.productById(b.dataset.toggle);
        S.updateProduct(p.id, { active: p.active === false });
        toast(p.active === false ? "Product is live" : "Product hidden");
        viewProducts();
      });
    });
    qsa("[data-p-edit]").forEach(function (b) {
      b.addEventListener("click", function () { openProductModal(b.dataset.pEdit); });
    });
    qsa("[data-p-dup]").forEach(function (b) {
      b.addEventListener("click", function () {
        S.duplicateProduct(b.dataset.pDup);
        toast("Product duplicated");
        viewProducts();
      });
    });
    qsa("[data-p-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = S.productById(b.dataset.pDel);
        confirmDialog("Delete product?", "“" + p.title + "” will be removed from the store permanently. This cannot be undone.", function () {
          S.removeProduct(p.id);
          delete productSel[p.id];
          toast("Product deleted");
          viewProducts();
          renderShell();
        }, true);
      });
    });
  }

  /* ---------- product modal ---------- */
  function openProductModal(id) {
    var existing = id ? S.productById(id) : null;
    draft = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: null, title: "", handle: "", category: (S.categories()[0] || {}).id || "tops",
      subcategory: null, price: 0, compareAt: null, images: [], colors: [], sizes: [],
      stock: 0, sku: "", description: "", details: [], tags: [],
      featured: false, isNew: true, active: true, rating: 5, reviews: 0, sold: 0
    };

    openModal(existing ? "Edit product" : "New product", productFormHTML(), "");
    qs("#amodal-foot").innerHTML =
      (existing ? '<button class="abtn abtn--danger" id="del-prod" style="margin-right:auto">' + A.trash + ' Delete this product</button>' : '') +
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button>' +
      '<button class="abtn" id="save-prod">' + (existing ? "Save changes" : "Create product") + '</button>';
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });

    bindProductForm();
    qs("#save-prod").addEventListener("click", function () { saveProduct(!!existing); });

    var delBtn = qs("#del-prod");
    if (delBtn) delBtn.addEventListener("click", function () {
      confirmDialog("Delete product?", "“" + existing.title + "” will be removed from the store permanently. This cannot be undone.", function () {
        S.removeProduct(existing.id);
        delete productSel[existing.id];
        closeModal();
        toast("Product deleted");
        viewProducts();
        renderShell();
      }, true);
    });
  }

  function productFormHTML() {
    var d = draft;
    var cats = S.categories();
    var catOpts = cats.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (d.category === c.id ? " selected" : "") + '>' + esc(c.name) + '</option>';
    }).join("");
    var cat = S.category(d.category);
    var subs = (cat && cat.children) || [];

    return '<div class="f-section">Basics</div>' +
      '<div class="f-grid">' +
        '<div class="f-group f-full"><label class="f-label">Product title</label>' +
          '<input class="f-input" id="f-title" value="' + esc(d.title) + '" placeholder="e.g. Knitted Quarter Zip Sweater"></div>' +
        '<div class="f-group"><label class="f-label">Category</label><select class="f-select" id="f-cat">' + catOpts + '</select></div>' +
        '<div class="f-group"><label class="f-label">Sub-category</label><select class="f-select" id="f-sub">' +
          '<option value="">— none —</option>' +
          subs.map(function (k) { return '<option value="' + esc(k.sub || k.slug) + '"' + (d.subcategory === (k.sub || k.slug) ? " selected" : "") + '>' + esc(k.name) + '</option>'; }).join("") +
        '</select></div>' +
        '<div class="f-group"><label class="f-label">Price (' + esc(S.settings.currency) + ')</label>' +
          '<input class="f-input" id="f-price" type="number" min="0" value="' + (d.price || "") + '"></div>' +
        '<div class="f-group"><label class="f-label">Compare-at price</label>' +
          '<input class="f-input" id="f-compare" type="number" min="0" value="' + (d.compareAt || "") + '" placeholder="Optional — shows a strikethrough"></div>' +
        '<div class="f-group"><label class="f-label">Stock quantity</label>' +
          '<input class="f-input" id="f-stock" type="number" min="0" value="' + (d.stock || 0) + '"></div>' +
        '<div class="f-group"><label class="f-label">SKU</label>' +
          '<input class="f-input" id="f-sku" value="' + esc(d.sku || "") + '" placeholder="ZQ-001"></div>' +
      '</div>' +

      '<div class="f-section">Images</div>' +
      '<div class="img-grid" id="f-images"></div>' +
      '<p class="f-help" style="margin-top:8px">First image is the main photo. Upload files or paste an image URL.</p>' +
      '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        '<label class="abtn abtn--ghost abtn--sm" style="cursor:pointer">' + A.up + ' Upload<input type="file" id="f-upload" accept="image/*" multiple hidden></label>' +
        '<button class="abtn abtn--ghost abtn--sm" id="f-url">' + A.plus + ' Add from URL</button>' +
      '</div>' +

      '<div class="f-section">Variants</div>' +
      '<div class="f-group"><label class="f-label">Colours</label><div class="chips-input" id="f-colors"></div>' +
        '<p class="f-help">Type a colour and press Enter. Customers pick from these on the product page.</p></div>' +
      '<div class="f-group"><label class="f-label">Sizes</label><div class="chips-input" id="f-sizes"></div>' +
        '<p class="f-help">Leave empty for one-size items like watches or fragrances.</p></div>' +

      '<div class="f-section">Description</div>' +
      '<div class="f-group"><label class="f-label">Product description</label>' +
        '<textarea class="f-textarea" id="f-desc" placeholder="What makes this piece worth buying?">' + esc(d.description) + '</textarea></div>' +
      '<div class="f-group"><label class="f-label">Detail bullets (one per line)</label>' +
        '<textarea class="f-textarea" id="f-details" style="min-height:76px" placeholder="100% cotton&#10;Relaxed boxy fit">' + esc((d.details || []).join("\n")) + '</textarea></div>' +

      '<div class="f-section">Visibility</div>' +
      '<div style="display:grid;gap:12px">' +
        '<label class="switch"><input type="checkbox" id="f-active"' + (d.active !== false ? " checked" : "") + '><span class="switch__track"></span>Visible in store</label>' +
        '<label class="switch"><input type="checkbox" id="f-featured"' + (d.featured ? " checked" : "") + '><span class="switch__track"></span>Feature on homepage</label>' +
        '<label class="switch"><input type="checkbox" id="f-new"' + (d.isNew ? " checked" : "") + '><span class="switch__track"></span>Mark as new arrival</label>' +
      '</div>';
  }

  function bindProductForm() {
    paintImages();
    paintChips("f-colors", draft.colors);
    paintChips("f-sizes", draft.sizes);

    qs("#f-cat").addEventListener("change", function () {
      draft.category = this.value;
      var cat = S.category(this.value);
      qs("#f-sub").innerHTML = '<option value="">— none —</option>' +
        ((cat && cat.children) || []).map(function (k) {
          return '<option value="' + esc(k.sub || k.slug) + '">' + esc(k.name) + '</option>';
        }).join("");
    });

    qs("#f-upload").addEventListener("change", function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      var done = 0;
      files.forEach(function (f) {
        compressImage(f, function (data) {
          draft.images.push(data);
          done++;
          if (done === files.length) paintImages();
        });
      });
    });

    qs("#f-url").addEventListener("click", function () {
      openModal("Add image from URL",
        '<div class="f-group"><label class="f-label">Image URL</label>' +
        '<input class="f-input" id="img-url" placeholder="https://… or assets/img/…"></div>',
        '<button class="abtn abtn--ghost" data-close-modal>Cancel</button><button class="abtn" id="img-url-ok">Add image</button>',
        { small: true });
      qsa("[data-close-modal]").forEach(function (b) {
        if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
      });
      qs("#img-url-ok").addEventListener("click", function () {
        var v = qs("#img-url").value.trim();
        if (!v) return;
        draft.images.push(v);
        closeModal();
        paintImages();
      });
    });
  }

  function paintImages() {
    var host = qs("#f-images");
    if (!host) return;
    host.innerHTML = draft.images.map(function (src, i) {
      return '<div class="img-item"><img src="' + esc(src) + '" alt="">' +
        '<div class="img-item__tools">' +
          (i > 0 ? '<button data-img-up="' + i + '">↑</button>' : '') +
          '<button data-img-del="' + i + '">Remove</button>' +
        '</div></div>';
    }).join("") + '<div class="img-add" id="img-add">+<br>Add</div>';

    qsa("[data-img-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        draft.images.splice(+b.dataset.imgDel, 1);
        paintImages();
      });
    });
    qsa("[data-img-up]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.dataset.imgUp;
        var tmp = draft.images[i - 1];
        draft.images[i - 1] = draft.images[i];
        draft.images[i] = tmp;
        paintImages();
      });
    });
    var add = qs("#img-add", host);
    if (add) add.addEventListener("click", function () { qs("#f-upload").click(); });
  }

  function paintChips(hostId, arr) {
    var host = qs("#" + hostId);
    if (!host) return;
    host.innerHTML = arr.map(function (v, i) {
      return '<span class="tagchip">' + esc(v) + '<button data-chip-del="' + i + '">✕</button></span>';
    }).join("") + '<input placeholder="Add…">';

    qsa("[data-chip-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        arr.splice(+b.dataset.chipDel, 1);
        paintChips(hostId, arr);
      });
    });
    var input = qs("input", host);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        var v = input.value.trim().replace(/,$/, "");
        if (v) {
          arr.push(v);
          paintChips(hostId, arr);
          var ni = qs("input", host);
          if (ni) ni.focus();
        }
      } else if (e.key === "Backspace" && !input.value && arr.length) {
        arr.pop();
        paintChips(hostId, arr);
      }
    });
  }

  function saveProduct(isEdit) {
    var title = qs("#f-title").value.trim();
    if (!title) { toast("Give the product a title"); qs("#f-title").focus(); return; }
    var price = parseFloat(qs("#f-price").value) || 0;
    var compare = parseFloat(qs("#f-compare").value) || null;

    var payload = {
      title: title,
      handle: draft.handle || S.slugify(title),
      category: qs("#f-cat").value,
      subcategory: qs("#f-sub").value || null,
      price: price,
      compareAt: compare && compare > price ? compare : null,
      stock: parseInt(qs("#f-stock").value, 10) || 0,
      sku: qs("#f-sku").value.trim(),
      description: qs("#f-desc").value.trim(),
      details: qs("#f-details").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean),
      images: draft.images.slice(),
      colors: draft.colors.slice(),
      sizes: draft.sizes.slice(),
      active: qs("#f-active").checked,
      featured: qs("#f-featured").checked,
      isNew: qs("#f-new").checked
    };

    if (!payload.images.length) payload.images = ["assets/img/ziq/cat-tees.jpg"];

    if (isEdit) {
      S.updateProduct(draft.id, payload);
      toast("Product updated");
    } else {
      S.addProduct(payload);
      toast("Product created");
    }
    closeModal();
    renderShell();
    if (view === "products") viewProducts(); else renderView();
  }

  /* =================== categories =================== */
  function viewCategories() {
    setTitle("Categories", '<button class="abtn" id="new-cat">' + A.plus + ' Add category</button>');
    qs("#new-cat").addEventListener("click", function () { openCategoryModal(null); });

    var cats = S.categories();
    qs("#adm-view").innerHTML =
      '<div class="card"><div class="card__body">' +
      (cats.length ? cats.map(function (c) {
        var n = S.products({ includeInactive: true }).filter(function (p) { return p.category === c.id; }).length;
        return '<div class="cat-row">' +
          '<img src="' + esc(c.image || "") + '" alt="">' +
          '<div><p class="cat-row__n">' + esc(c.name) + (c.navLabel ? ' <span class="tag">nav: ' + esc(c.navLabel) + '</span>' : '') + '</p>' +
            '<p class="cat-row__m">/' + esc(c.slug) + ' · ' + n + ' products · ' + ((c.children || []).length) + ' sub-categories · ' +
            (c.showOnHome ? "on homepage" : "not on homepage") + '</p></div>' +
          '<div class="tbl-actions">' +
            '<button class="abtn abtn--ghost abtn--sm" data-c-edit="' + esc(c.id) + '">' + A.edit + ' Edit</button>' +
            '<button class="abtn abtn--danger abtn--sm" data-c-del="' + esc(c.id) + '">' + A.trash + '</button>' +
          '</div></div>';
      }).join("") : '<div class="adm-empty">No categories yet.</div>') +
      '</div></div>';

    qsa("[data-c-edit]").forEach(function (b) {
      b.addEventListener("click", function () { openCategoryModal(b.dataset.cEdit); });
    });
    qsa("[data-c-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var c = S.category(b.dataset.cDel);
        var n = S.products({ includeInactive: true }).filter(function (p) { return p.category === c.id; }).length;
        confirmDialog("Delete category?", "“" + c.name + "” will be removed. " + n + " product(s) in it will keep their data but lose their category link.", function () {
          S.removeCategory(c.id);
          toast("Category deleted");
          viewCategories();
        }, true);
      });
    });
  }

  function openCategoryModal(id) {
    var c = id ? S.category(id) : { id: null, name: "", slug: "", image: "", showOnHome: false, group: "main", children: [] };
    var kids = (c.children || []).map(function (k) { return k.name + "|" + (k.sub || k.slug); }).join("\n");

    openModal(id ? "Edit category" : "New category",
      '<div class="f-grid">' +
        '<div class="f-group f-full"><label class="f-label">Name</label><input class="f-input" id="c-name" value="' + esc(c.name) + '"></div>' +
        '<div class="f-group"><label class="f-label">Slug (URL)</label><input class="f-input" id="c-slug" value="' + esc(c.slug) + '" placeholder="auto"></div>' +
        '<div class="f-group"><label class="f-label">Short nav label</label><input class="f-input" id="c-nav" value="' + esc(c.navLabel || "") + '" placeholder="Optional"></div>' +
        '<div class="f-group f-full"><label class="f-label">Cover image URL</label><input class="f-input" id="c-img" value="' + esc(c.image || "") + '"></div>' +
        '<div class="f-group f-full"><label class="f-label">Sub-categories (one per line: Name|slug)</label>' +
          '<textarea class="f-textarea" id="c-kids" style="min-height:90px" placeholder="Jackets|jackets&#10;Sweaters|sweaters">' + esc(kids) + '</textarea></div>' +
        '<div class="f-group f-full" style="display:flex;gap:22px;flex-wrap:wrap">' +
          '<label class="switch"><input type="checkbox" id="c-home"' + (c.showOnHome ? " checked" : "") + '><span class="switch__track"></span>Show on homepage</label>' +
        '</div>' +
      '</div>',
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button>' +
      '<button class="abtn" id="c-save">' + (id ? "Save" : "Create") + '</button>');

    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });

    qs("#c-save").addEventListener("click", function () {
      var name = qs("#c-name").value.trim();
      if (!name) { toast("Name is required"); return; }
      var children = qs("#c-kids").value.split("\n").map(function (l) {
        var parts = l.split("|");
        var nm = (parts[0] || "").trim();
        if (!nm) return null;
        var sub = (parts[1] || S.slugify(nm)).trim();
        return { name: nm, slug: sub, sub: sub };
      }).filter(Boolean);

      var payload = {
        name: name,
        slug: qs("#c-slug").value.trim() || S.slugify(name),
        navLabel: qs("#c-nav").value.trim() || undefined,
        image: qs("#c-img").value.trim(),
        showOnHome: qs("#c-home").checked,
        children: children
      };
      if (id) S.updateCategory(id, payload);
      else S.addCategory(payload);
      closeModal();
      toast(id ? "Category saved" : "Category created");
      viewCategories();
    });
  }

  /* =================== orders =================== */
  function viewOrders() {
    setTitle("Orders", '<button class="abtn" id="add-order">' + A.plus + ' Add order</button>');
    qs("#adm-view").innerHTML = '<div class="card"><div class="adm-empty" style="padding:40px">Loading orders...</div></div>';

    /* Bind the add-order button. */
    var addBtn = qs("#add-order");
    if (addBtn) addBtn.addEventListener("click", function () { openAddOrderModal(); });

    /* Fetch from the server first, then render. Falls back to localStorage. */
    S.fetchServerOrders(function (orders, fromServer) {
      renderOrdersTable(orders);
    });
  }

  function renderOrdersTable(orders) {
    qs("#adm-view").innerHTML =
      '<div class="card"><div class="tbl-wrap"><table class="tbl">' +
      '<thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>' +
      (orders.length ? orders.map(function (o) {
        return '<tr>' +
          '<td style="font-family:var(--font-ui);font-size:11.5px">' + esc(o.id) + '</td>' +
          '<td>' + esc(o.customer.name || "—") + '<div style="font-size:11px;color:var(--muted)">' + esc(o.customer.phone || "") + '</div></td>' +
          '<td style="font-size:12px;color:var(--muted)">' + new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + '</td>' +
          '<td>' + o.items.length + '</td>' +
          '<td style="white-space:nowrap">' + money(o.total) + '</td>' +
          '<td><select class="adm-select" style="padding:5px 8px;font-size:11.5px" data-o-status="' + esc(o.id) + '">' +
            ["pending", "confirmed", "shipped", "delivered", "cancelled"].map(function (s) {
              return '<option value="' + s + '"' + (o.status === s ? " selected" : "") + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
            }).join("") +
          '</select></td>' +
          '<td><div class="tbl-actions">' +
            '<button class="abtn abtn--ghost abtn--sm" data-o-view="' + esc(o.id) + '" title="View">' + A.eye + '</button>' +
            '<button class="abtn abtn--danger abtn--sm" data-o-del="' + esc(o.id) + '" title="Delete">' + A.trash + '</button>' +
          '</div></td>' +
        '</tr>';
      }).join("") : '<tr><td colspan="7"><div class="adm-empty">No orders yet. Click "Add order" to create one manually.</div></td></tr>') +
      '</tbody></table></div></div>';

    qsa("[data-o-status]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var orderId = sel.dataset.oStatus;
        var newStatus = sel.value;
        var updated = S.updateOrderStatus(orderId, newStatus);
        if (updated) {
          sendOrderStatusEmail(updated, newStatus);
        }
        toast("Status updated - " + newStatus);
        renderShell();
      });
    });
    qsa("[data-o-view]").forEach(function (b) {
      b.addEventListener("click", function () { openOrderModal(b.dataset.oView); });
    });
    qsa("[data-o-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        var oid = b.dataset.oDel;
        var o = S.orders().filter(function (x) { return x.id === oid; })[0];
        if (!o) return;
        confirmDialog("Delete order?", "Order " + o.id + " (" + (o.customer.name || "unknown") + ", " + money(o.total) + ") will be permanently removed. This cannot be undone.", function () {
          S.deleteOrder(oid);
          toast("Order " + oid + " deleted");
          viewOrders();
          renderShell();
        }, true);
      });
    });
  }

  /* ---------- send order status email to customer ---------- */
  function sendOrderStatusEmail(order, newStatus) {
    if (!window.Email) return;
    if (!order.customer || !order.customer.email) return;

    var LABEL = {
      pending:   "Order placed",
      confirmed: "Order confirmed",
      shipped:   "Order shipped",
      delivered: "Order delivered",
      cancelled: "Order cancelled"
    };
    var label = LABEL[newStatus] || newStatus;

    var lines = [];
    lines.push("Hi " + (order.customer.name || "there") + ",");
    lines.push("");
    lines.push("Your ZIQWEAR order " + order.id + " has been updated.");
    lines.push("");
    lines.push("NEW STATUS: " + label);
    lines.push("");

    if (newStatus === "confirmed") {
      lines.push("Good news! Your order has been confirmed and is being prepared for dispatch.");
    } else if (newStatus === "shipped") {
      lines.push("Your order is on its way! It will be delivered within 2-4 working days depending on your location.");
      if (order.payment === "cod") {
        lines.push("Please keep " + S.money(order.total) + " ready for cash on delivery.");
      }
    } else if (newStatus === "delivered") {
      lines.push("Your order has been delivered. Thank you for shopping with ZIQWEAR!");
      lines.push("");
      lines.push("If you have any issues with your order, reply to this email or WhatsApp us at " + (S.settings.phone || ""));
    } else if (newStatus === "cancelled") {
      lines.push("Your order " + order.id + " has been cancelled.");
      lines.push("If you believe this is an error, please contact us on WhatsApp at " + (S.settings.phone || "") + ".");
    }

    lines.push("");
    lines.push("ORDER DETAILS");
    lines.push("Order ID: " + order.id);
    lines.push("Total: " + S.money(order.total));
    lines.push("Items: " + order.items.length);
    order.items.forEach(function (i) {
      var variant = [i.color, i.size].filter(Boolean).join(" / ");
      lines.push("  - " + i.title + (variant ? " (" + variant + ")" : "") + " x" + i.qty);
    });
    lines.push("");
    lines.push("TRACK YOUR ORDER");
    lines.push("Check your order status anytime at:");
    lines.push(location.origin + location.pathname.replace(/[^/]*$/, "") + "orders.html?phone=" + encodeURIComponent(order.customer.phone || ""));
    lines.push("");
    lines.push("Need help? Reply to this email or WhatsApp us at " + (S.settings.phone || ""));
    lines.push("");
    lines.push("--");
    lines.push("ZIQWEAR | Zenith in Quality");
    lines.push(S.settings.address || "");

    window.Email.send({
      subject: label + " - Order " + order.id + " - ZIQWEAR",
      message: lines.join("\n"),
      replyTo: S.settings.email || "",
      fromName: "ZIQWEAR Store",
      toEmail: order.customer.email
    }, function (ok) {
      if (ok) toast("Status email sent to " + order.customer.email);
    });
  }

  /* ---------- add order modal ---------- */
  function openAddOrderModal() {
    var products = S.products();
    var cats = S.categories();

    openModal("Add manual order",
      /* ---- customer section ---- */
      '<div class="f-section">Customer details</div>' +
      '<div class="f-grid">' +
        '<div class="f-group"><label class="f-label">Name *</label><input class="f-input" id="ao-name" placeholder="Customer name"></div>' +
        '<div class="f-group"><label class="f-label">Phone *</label><input class="f-input" id="ao-phone" placeholder="03xx xxxxxxx"></div>' +
        '<div class="f-group"><label class="f-label">Email</label><input class="f-input" id="ao-email" type="email" placeholder="customer@email.com"></div>' +
        '<div class="f-group"><label class="f-label">Address</label><input class="f-input" id="ao-address" placeholder="Street address"></div>' +
        '<div class="f-group"><label class="f-label">City</label><input class="f-input" id="ao-city" placeholder="Multan"></div>' +
        '<div class="f-group"><label class="f-label">Province</label>' +
          '<select class="f-input" id="ao-province">' +
            '<option value="">Select</option>' +
            '<option>Punjab</option><option>Sindh</option><option>Khyber Pakhtunkhwa</option>' +
            '<option>Balochistan</option><option>Islamabad Capital Territory</option>' +
            '<option>Gilgit-Baltistan</option><option>Azad Kashmir</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      /* ---- items section ---- */
      '<div class="f-section" style="margin-top:20px">Items</div>' +
      '<div id="ao-items" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px"></div>' +
      '<button class="abtn abtn--ghost abtn--sm" id="ao-add-item">' + A.plus + ' Add item</button>' +

      /* ---- payment + shipping ---- */
      '<div class="f-section" style="margin-top:20px">Payment & Shipping</div>' +
      '<div class="f-grid">' +
        '<div class="f-group"><label class="f-label">Payment</label>' +
          '<select class="f-input" id="ao-payment"><option value="cod">Cash on delivery</option><option value="bank">Bank transfer</option></select>' +
        '</div>' +
        '<div class="f-group"><label class="f-label">Shipping fee</label><input class="f-input" id="ao-shipping" type="number" value="0" min="0"></div>' +
        '<div class="f-group"><label class="f-label">Status</label>' +
          '<select class="f-input" id="ao-status">' +
            '<option value="pending">Pending</option><option value="confirmed">Confirmed</option>' +
            '<option value="shipped">Shipped</option><option value="delivered">Delivered</option>' +
            '<option value="cancelled">Cancelled</option>' +
          '</select>' +
        '</div>' +
      '</div>' +
      '<div class="f-group" style="margin-top:12px"><label class="f-label">Notes</label><textarea class="f-textarea" id="ao-notes" style="min-height:60px" placeholder="Order notes (optional)"></textarea></div>',

      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button>' +
      '<button class="abtn" id="ao-save">Create order</button>');

    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });

    /* ---- item row management ---- */
    var itemHost = qs("#ao-items");
    var itemRows = [];

    function addEmptyItemRow() {
      var rowIdx = itemRows.length;
      var row = document.createElement("div");
      row.className = "f-grid";
      row.style.cssText = "gap:8px;align-items:end;padding:10px;border:1px solid var(--line-soft);border-radius:4px";
      row.innerHTML =
        '<div class="f-group" style="flex:2"><label class="f-label">Product</label>' +
          '<select class="f-input ao-prod" data-idx="' + rowIdx + '">' +
            products.map(function (p) {
              return '<option value="' + esc(p.id) + '" data-price="' + p.price + '" data-title="' + esc(p.title) + '" data-img="' + esc(p.images && p.images[0] || "") + '">' + esc(p.title) + " - " + money(p.price) + '</option>';
            }).join("") +
          '</select></div>' +
        '<div class="f-group" style="flex:1"><label class="f-label">Size</label><input class="f-input ao-size" placeholder="M"></div>' +
        '<div class="f-group" style="flex:1"><label class="f-label">Color</label><input class="f-input ao-color" placeholder="Black"></div>' +
        '<div class="f-group" style="flex:1"><label class="f-label">Qty</label><input class="f-input ao-qty" type="number" value="1" min="1" style="width:60px"></div>' +
        '<div class="f-group" style="flex:0"><button class="abtn abtn--danger abtn--sm ao-remove" data-idx="' + rowIdx + '">' + A.trash + '</button></div>';
      itemHost.appendChild(row);

      var entry = {
        el: row,
        prodSel: row.querySelector(".ao-prod"),
        sizeInput: row.querySelector(".ao-size"),
        colorInput: row.querySelector(".ao-color"),
        qtyInput: row.querySelector(".ao-qty")
      };
      itemRows.push(entry);

      row.querySelector(".ao-remove").addEventListener("click", function () {
        row.remove();
        itemRows = itemRows.filter(function (e) { return e.el !== row; });
        if (!itemRows.length) addEmptyItemRow();
      });
    }

    addEmptyItemRow();

    qs("#ao-add-item").addEventListener("click", function () { addEmptyItemRow(); });

    /* ---- save handler ---- */
    qs("#ao-save").addEventListener("click", function () {
      var name = qs("#ao-name").value.trim();
      var phone = qs("#ao-phone").value.trim();
      if (!name || !phone) {
        toast("Name and phone are required");
        return;
      }

      var items = [];
      itemRows.forEach(function (e) {
        var sel = e.prodSel;
        var opt = sel.options[sel.selectedIndex];
        if (!opt || !opt.value) return;
        var qty = Math.max(1, parseInt(e.qtyInput.value, 10) || 1);
        items.push({
          id: opt.value,
          title: opt.getAttribute("data-title") || opt.textContent,
          price: parseFloat(opt.getAttribute("data-price")) || 0,
          qty: qty,
          color: e.colorInput.value.trim() || undefined,
          size: e.sizeInput.value.trim() || undefined,
          image: opt.getAttribute("data-img") || ""
        });
      });

      if (!items.length) {
        toast("Add at least one item");
        return;
      }

      var shipping = parseFloat(qs("#ao-shipping").value) || 0;
      var order = S.addManualOrder({
        customer: {
          name: name,
          phone: phone,
          email: qs("#ao-email").value.trim(),
          address: qs("#ao-address").value.trim(),
          city: qs("#ao-city").value.trim(),
          province: qs("#ao-province").value
        },
        items: items,
        payment: qs("#ao-payment").value,
        shippingFee: shipping,
        status: qs("#ao-status").value,
        notes: qs("#ao-notes").value.trim()
      });

      closeModal();
      toast("Order " + order.id + " created");
      viewOrders();
      renderShell();
    });
  }

  function openOrderModal(id) {
    var o = S.orders().filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    openModal("Order " + o.id,
      '<div style="display:flex;gap:10px;margin-bottom:18px">' +
        '<span class="tag ' + statusTag(o.status) + '">' + esc(o.status) + '</span>' +
        '<span class="tag">' + esc(o.payment === "cod" ? "Cash on delivery" : "Bank transfer") + '</span>' +
        '<span class="tag">' + new Date(o.createdAt).toLocaleString("en-GB") + '</span></div>' +
      '<div class="f-section">Customer</div>' +
      '<p style="font-size:14px;line-height:1.8">' + esc(o.customer.name) + '<br>' + esc(o.customer.phone) +
        (o.customer.email ? '<br>' + esc(o.customer.email) : '') + '<br>' +
        esc(o.customer.address) + ', ' + esc(o.customer.city) + ', ' + esc(o.customer.province) + '</p>' +
      (o.notes ? '<p style="font-size:13px;color:var(--muted);margin-top:10px">Note: ' + esc(o.notes) + '</p>' : '') +
      '<div class="f-section">Items</div>' +
      o.items.map(function (i) {
        return '<div style="display:flex;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line-soft)">' +
          '<img src="' + esc(i.image) + '" style="width:44px;height:56px;object-fit:cover;border-radius:3px">' +
          '<div style="flex:1"><p style="font-size:13px">' + esc(i.title) + '</p>' +
          '<p style="font-size:11.5px;color:var(--muted)">' + [i.color, i.size].filter(Boolean).map(esc).join(" · ") + ' × ' + i.qty + '</p></div>' +
          '<span style="font-family:var(--font-ui);font-size:12px">' + money(i.price * i.qty) + '</span></div>';
      }).join("") +
      '<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:13px"><span>Subtotal</span><span>' + money(o.subtotal) + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:4px 0 12px;font-size:13px"><span>Delivery</span><span>' + (o.shipping ? money(o.shipping) : "Free") + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid var(--line);font-family:var(--font-ui);font-size:15px"><span>Total</span><span>' + money(o.total) + '</span></div>',
      '<a class="abtn abtn--ghost" href="https://wa.me/' + String(o.customer.phone || "").replace(/\D/g, "") + '" target="_blank" rel="noopener">Message customer</a>' +
      '<button class="abtn" data-close-modal>Done</button>');
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
  }

  /* =================== content =================== */
  function viewContent() {
    setTitle("Content", '<button class="abtn" id="save-content">' + A.save + ' Save content</button>');
    var s = S.settings;

    qs("#adm-view").innerHTML =
      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Announcement bar</h2></div>' +
        '<div class="card__body"><div class="f-group"><label class="f-label">Rotating messages (one per line)</label>' +
        '<textarea class="f-textarea" id="ct-ann" style="min-height:80px">' + esc((s.announcements || []).join("\n")) + '</textarea></div></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Hero slides</h2>' +
        '<button class="abtn abtn--ghost abtn--sm" id="add-slide">' + A.plus + ' Add slide</button></div>' +
        '<div class="card__body" id="slides"></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Marquee &amp; newsletter</h2></div>' +
        '<div class="card__body"><div class="f-grid">' +
          '<div class="f-group f-full"><label class="f-label">Marquee text</label><input class="f-input" id="ct-marquee" value="' + esc(s.marquee) + '"></div>' +
          '<div class="f-group"><label class="f-label">Newsletter heading</label><input class="f-input" id="ct-ntitle" value="' + esc(s.newsletterTitle) + '"></div>' +
          '<div class="f-group"><label class="f-label">Newsletter subtext</label><input class="f-input" id="ct-ntext" value="' + esc(s.newsletterText) + '"></div>' +
        '</div></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Shop the look</h2>' +
        '<button class="abtn abtn--ghost abtn--sm" id="add-look">' + A.plus + ' Add card</button></div>' +
        '<div class="card__body" id="looks"></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Editorial block</h2></div>' +
        '<div class="card__body"><div class="f-grid">' +
          pictureField("ct-eimg", s.editorial.image, "Editorial picture",
            "Upload your own photo, pick one already on a product, or paste a link.",
            s.editorial.imageFit || "cover") +
          '<div class="f-group"><label class="f-label">Eyebrow</label><input class="f-input" id="ct-eeyebrow" value="' + esc(s.editorial.eyebrow) + '"></div>' +
          '<div class="f-group"><label class="f-label">Button label</label><input class="f-input" id="ct-ecta" value="' + esc(s.editorial.cta) + '"></div>' +
          '<div class="f-group f-full"><label class="f-label">Heading (use line breaks)</label><textarea class="f-textarea" id="ct-etitle" style="min-height:64px">' + esc(s.editorial.title) + '</textarea></div>' +
          '<div class="f-group f-full"><label class="f-label">Body text</label><textarea class="f-textarea" id="ct-etext">' + esc(s.editorial.text) + '</textarea></div>' +
          '<div class="f-group f-full"><label class="f-label">Button link</label><input class="f-input" id="ct-elink" value="' + esc(s.editorial.link || "shop.html") + '"></div>' +
        '</div></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Service strip</h2>' +
        '<button class="abtn abtn--ghost abtn--sm" id="add-promo">' + A.plus + ' Add item</button></div>' +
        '<div class="card__body" id="promos"></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Customer reviews</h2>' +
        '<button class="abtn abtn--ghost abtn--sm" id="add-review">' + A.plus + ' Add review</button></div>' +
        '<div class="card__body">' +
          '<div class="f-group" style="margin-bottom:14px"><label class="f-label">Small line above the heading</label>' +
            '<input class="f-input" id="ct-reveyebrow" value="' + esc(s.reviewsEyebrow || "") + '" placeholder="4.9 average from 900+ orders"></div>' +
          '<div id="reviews-admin"></div>' +
        '</div></div>' +

      '<div class="card"><div class="card__head"><h2>FAQ (contact page)</h2>' +
        '<button class="abtn abtn--ghost abtn--sm" id="add-faq">' + A.plus + ' Add question</button></div>' +
        '<div class="card__body" id="faqs"></div></div>';

    paintSlides();
    paintLooks();
    paintPromos();
    paintReviews();
    paintFaqs();
    wirePictureFields(qs("#adm-view"));

    qs("#add-slide").addEventListener("click", function () {
      S.settings.heroSlides.push({
        word: "NEW", shape: "cutout", eyebrow: "New drop", title: "New Collection", subtitle: "",
        price: 0, compareAt: 0, cta: "Shop now", link: "shop.html",
        image: "assets/img/ziq/cut-freedom.png",
        bgImage: "", bgVideo: "", bgOnly: false,
        theme: { bg: "#e9e0d2", bg2: "#dcd0bd", word: "#1b1714", ink: "#1b1714", accent: "#86622a" }
      });
      S.persist();
      paintSlides();
    });
    qs("#add-look").addEventListener("click", function () {
      S.settings.lookbook.push({ image: "assets/img/ziq/cat-tees.jpg", video: "", product: "", title: "New look", link: "shop.html", tag: "Style" });
      S.persist();
      paintLooks();
    });
    qs("#add-promo").addEventListener("click", function () {
      S.settings.promoStrip = S.settings.promoStrip || [];
      S.settings.promoStrip.push({ icon: "truck", title: "New promise", text: "Describe it here" });
      S.persist();
      paintPromos();
    });
    qs("#add-review").addEventListener("click", function () {
      S.settings.reviews = S.settings.reviews || [];
      S.settings.reviews.push({ name: "New customer", city: "", text: "", stars: 5 });
      S.persist();
      paintReviews();
      editReview(S.settings.reviews.length - 1);
    });
    qs("#add-faq").addEventListener("click", function () {
      S.settings.faq = S.settings.faq || [];
      S.settings.faq.push(["New question?", ""]);
      S.persist();
      paintFaqs();
      editFaq(S.settings.faq.length - 1);
    });

    qs("#save-content").addEventListener("click", function () {
      var patch = {
        announcements: qs("#ct-ann").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean),
        marquee: qs("#ct-marquee").value,
        newsletterTitle: qs("#ct-ntitle").value,
        newsletterText: qs("#ct-ntext").value,
        reviewsEyebrow: qs("#ct-reveyebrow").value,
        editorial: {
          image: qs("#ct-eimg").value,
          imageFit: qs("#ct-eimg-fit").value,
          eyebrow: qs("#ct-eeyebrow").value,
          cta: qs("#ct-ecta").value,
          title: qs("#ct-etitle").value,
          text: qs("#ct-etext").value,
          link: qs("#ct-elink").value
        }
      };
      S.updateSettings(patch);
      Sec.audit("content", "Homepage content saved.");
      toast("Content saved — refresh the storefront to see it");
    });
  }

  /* ---------- service strip ---------- */
  function paintPromos() {
    var host = qs("#promos");
    if (!host) return;
    var items = S.settings.promoStrip || [];
    var map = { truck: I.truck, cash: I.cash, return: I.ret, shield: I.shield };
    host.innerHTML = items.map(function (it, i) {
      return '<div class="slide-row slide-row--flat">' +
        '<div><p class="promo-row__title">' + (map[it.icon] || I.shield) + '<b>' + esc(it.title) + '</b></p>' +
        '<p style="font-size:11.5px;color:var(--muted)">' + esc(it.text) + '</p></div>' +
        '<div class="tbl-actions">' +
          '<button class="abtn abtn--ghost abtn--sm" data-promo-edit="' + i + '">Edit</button>' +
          '<button class="abtn abtn--danger abtn--sm" data-promo-del="' + i + '">✕</button>' +
        '</div></div>';
    }).join("") || '<p style="font-size:13px;color:var(--muted)">No items — the strip is hidden on the homepage.</p>';

    qsa("[data-promo-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { editPromo(+b.dataset.promoEdit); });
    });
    qsa("[data-promo-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        S.settings.promoStrip.splice(+b.dataset.promoDel, 1);
        S.persist();
        paintPromos();
      });
    });
  }

  function editPromo(i) {
    var it = S.settings.promoStrip[i];
    var icons = [["truck", "Delivery truck"], ["cash", "Cash on delivery"], ["return", "Exchange / return"], ["shield", "Quality / shield"]];
    openModal("Service item",
      '<div class="f-grid">' +
        '<div class="f-group f-full"><label class="f-label">Icon</label><select class="f-input" id="pr-icon">' +
          icons.map(function (o) {
            return '<option value="' + o[0] + '"' + (it.icon === o[0] ? " selected" : "") + '>' + o[1] + '</option>';
          }).join("") +
        '</select></div>' +
        '<div class="f-group f-full"><label class="f-label">Title</label><input class="f-input" id="pr-title" value="' + esc(it.title) + '"></div>' +
        '<div class="f-group f-full"><label class="f-label">Text</label><input class="f-input" id="pr-text" value="' + esc(it.text) + '"></div>' +
      '</div>',
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button><button class="abtn" id="pr-save">Save</button>',
      { small: true });
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
    qs("#pr-save").addEventListener("click", function () {
      it.icon = qs("#pr-icon").value;
      it.title = qs("#pr-title").value;
      it.text = qs("#pr-text").value;
      S.persist();
      closeModal();
      paintPromos();
      toast("Item saved");
    });
  }

  /* ---------- reviews ---------- */
  function paintReviews() {
    var host = qs("#reviews-admin");
    if (!host) return;
    var items = S.settings.reviews || [];
    host.innerHTML = items.map(function (r, i) {
      return '<div class="slide-row slide-row--flat">' +
        '<div><p style="font-size:13.5px"><b>' + esc(r.name) + '</b>' + (r.city ? ' · ' + esc(r.city) : '') +
          ' <span class="stars-inline">' + new Array(Math.max(1, Math.min(5, r.stars || 5)) + 1).join("★") + '</span></p>' +
        '<p style="font-size:11.5px;color:var(--muted)">' + esc((r.text || "").slice(0, 90)) + ((r.text || "").length > 90 ? "…" : "") + '</p></div>' +
        '<div class="tbl-actions">' +
          '<button class="abtn abtn--ghost abtn--sm" data-review-edit="' + i + '">Edit</button>' +
          '<button class="abtn abtn--danger abtn--sm" data-review-del="' + i + '">✕</button>' +
        '</div></div>';
    }).join("") || '<p style="font-size:13px;color:var(--muted)">No reviews yet.</p>';

    qsa("[data-review-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { editReview(+b.dataset.reviewEdit); });
    });
    qsa("[data-review-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        S.settings.reviews.splice(+b.dataset.reviewDel, 1);
        S.persist();
        paintReviews();
      });
    });
  }

  function editReview(i) {
    var r = S.settings.reviews[i];
    openModal("Customer review",
      '<div class="f-grid">' +
        '<div class="f-group"><label class="f-label">Name</label><input class="f-input" id="rv-name" value="' + esc(r.name) + '"></div>' +
        '<div class="f-group"><label class="f-label">City</label><input class="f-input" id="rv-city" value="' + esc(r.city || "") + '"></div>' +
        '<div class="f-group f-full"><label class="f-label">Stars</label><select class="f-input" id="rv-stars">' +
          [5, 4, 3, 2, 1].map(function (n) {
            return '<option value="' + n + '"' + ((r.stars || 5) === n ? " selected" : "") + '>' + n + ' star' + (n === 1 ? "" : "s") + '</option>';
          }).join("") +
        '</select></div>' +
        '<div class="f-group f-full"><label class="f-label">Review text</label><textarea class="f-textarea" id="rv-text">' + esc(r.text || "") + '</textarea></div>' +
      '</div>',
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button><button class="abtn" id="rv-save">Save review</button>',
      { small: true });
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
    qs("#rv-save").addEventListener("click", function () {
      r.name = qs("#rv-name").value;
      r.city = qs("#rv-city").value;
      r.stars = parseInt(qs("#rv-stars").value, 10) || 5;
      r.text = qs("#rv-text").value;
      S.persist();
      closeModal();
      paintReviews();
      toast("Review saved");
    });
  }

  /* ---------- faq ---------- */
  function paintFaqs() {
    var host = qs("#faqs");
    if (!host) return;
    var items = S.settings.faq || [];
    host.innerHTML = items.map(function (f, i) {
      return '<div class="slide-row slide-row--flat">' +
        '<div><p style="font-size:13.5px"><b>' + esc(f[0]) + '</b></p>' +
        '<p style="font-size:11.5px;color:var(--muted)">' + esc((f[1] || "").slice(0, 80)) + ((f[1] || "").length > 80 ? "…" : "") + '</p></div>' +
        '<div class="tbl-actions">' +
          '<button class="abtn abtn--ghost abtn--sm" data-faq-edit="' + i + '">Edit</button>' +
          '<button class="abtn abtn--danger abtn--sm" data-faq-del="' + i + '">✕</button>' +
        '</div></div>';
    }).join("") || '<p style="font-size:13px;color:var(--muted)">No questions yet.</p>';

    qsa("[data-faq-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { editFaq(+b.dataset.faqEdit); });
    });
    qsa("[data-faq-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        S.settings.faq.splice(+b.dataset.faqDel, 1);
        S.persist();
        paintFaqs();
      });
    });
  }

  function editFaq(i) {
    var f = S.settings.faq[i];
    openModal("FAQ entry",
      '<div class="f-grid">' +
        '<div class="f-group f-full"><label class="f-label">Question</label><input class="f-input" id="fq-q" value="' + esc(f[0]) + '"></div>' +
        '<div class="f-group f-full"><label class="f-label">Answer</label><textarea class="f-textarea" id="fq-a" style="min-height:110px">' + esc(f[1] || "") + '</textarea></div>' +
      '</div>',
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button><button class="abtn" id="fq-save">Save</button>',
      { small: true });
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
    qs("#fq-save").addEventListener("click", function () {
      S.settings.faq[i] = [qs("#fq-q").value, qs("#fq-a").value];
      S.persist();
      closeModal();
      paintFaqs();
      toast("Question saved");
    });
  }

  function paintSlides() {
    var host = qs("#slides");
    if (!host) return;
    var slides = S.settings.heroSlides;
    host.innerHTML = slides.map(function (sl, i) {
      var bg = (sl.theme && sl.theme.bg) || "#ccc";
      return '<div class="slide-row">' +
        '<span class="slide-chip" style="background:' + esc(bg) + '"></span>' +
        '<img src="' + esc(sl.image) + '" alt="">' +
        '<div><p style="font-size:13.5px"><b>' + esc(sl.word || "") + '</b> — ' + esc(sl.title) + '</p>' +
        '<p style="font-size:11.5px;color:var(--muted)">' + esc(sl.eyebrow || "") + ' · ' + esc(sl.cta || "") + ' → ' + esc(sl.link || "") + '</p></div>' +
        '<div class="tbl-actions">' +
          '<button class="abtn abtn--ghost abtn--sm" data-slide-edit="' + i + '">Edit</button>' +
          '<button class="abtn abtn--danger abtn--sm" data-slide-del="' + i + '">✕</button>' +
        '</div></div>';
    }).join("");

    qsa("[data-slide-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { editSlide(+b.dataset.slideEdit); });
    });
    qsa("[data-slide-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var gone = slides[+b.dataset.slideDel];
        if (gone && gone.bgVideo) ZiqMedia.remove(gone.bgVideo);
        slides.splice(+b.dataset.slideDel, 1);
        S.persist();
        paintSlides();
      });
    });
  }

  function editSlide(i) {
    var sl = S.settings.heroSlides[i];
    var th = sl.theme || {};
    openModal("Hero slide",
      '<div class="f-grid">' +
        '<div class="f-group"><label class="f-label">Giant word</label><input class="f-input" id="s-word" value="' + esc(sl.word || "") + '" placeholder="RIDE"></div>' +
        '<div class="f-group"><label class="f-label">Product shape</label><select class="f-input" id="s-shape">' +
          '<option value="cutout"' + (sl.shape !== "arch" ? " selected" : "") + '>Cut-out (floats)</option>' +
          '<option value="arch"' + (sl.shape === "arch" ? " selected" : "") + '>Arched photo</option>' +
        '</select></div>' +
        pictureField("s-img", sl.image, "Picture shown in the hero",
          "Upload your own photo, pick a product picture, or paste a link. Transparent PNG suits the cut-out shape.") +
        '<div class="f-group"><label class="f-label">Eyebrow</label><input class="f-input" id="s-eye" value="' + esc(sl.eyebrow || "") + '"></div>' +
        '<div class="f-group"><label class="f-label">Title</label><input class="f-input" id="s-title" value="' + esc(sl.title) + '"></div>' +
        '<div class="f-group f-full"><label class="f-label">Subtitle</label><input class="f-input" id="s-sub" value="' + esc(sl.subtitle || "") + '"></div>' +
        '<div class="f-group"><label class="f-label">Price</label><input class="f-input" id="s-price" type="number" value="' + (sl.price || 0) + '"></div>' +
        '<div class="f-group"><label class="f-label">Compare-at price</label><input class="f-input" id="s-compare" type="number" value="' + (sl.compareAt || 0) + '"></div>' +
        '<div class="f-group"><label class="f-label">Button label</label><input class="f-input" id="s-cta" value="' + esc(sl.cta || "") + '"></div>' +
        '<div class="f-group"><label class="f-label">Button link</label><input class="f-input" id="s-link" value="' + esc(sl.link || "") + '"></div>' +
        pictureField("s-bgimg", sl.bgImage, "Background picture",
          "Sits behind the word, the product and the copy. A soft ivory wash is laid over the left so the text stays readable.") +
        videoField("s-bgvideo", sl.bgVideo, "Background video",
          "Plays behind this slide instead of the picture. Same look as the picture, so the slides and their animation do not change.") +
        '<label class="switch"><input type="checkbox" id="s-bgonly"' + (sl.bgOnly ? " checked" : "") + '>' +
          '<span class="switch__track"></span>Fill the hero — hide the word, product and text on this slide</label>' +
        '<p class="f-help">With this on, the slide is only the picture or the clip, edge to edge. ' +
          "If you have not set a background, the product picture is blown up to fill the frame instead.</p>" +
        '<div class="f-group f-full"><label class="f-label">Slide colour — this is the background the hero morphs to</label>' +
          '<input class="f-input" id="s-bg" type="color" value="' + esc(th.bg || "#6b2bd6") + '" style="height:44px;padding:4px"></div>' +
      '</div>' +
      '<p class="f-help">The giant word, this background colour and the product image all swap together on the storefront.</p>',
      '<button class="abtn abtn--danger" id="s-del">Delete slide</button>' +
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button><button class="abtn" id="s-save">Save slide</button>',
      { small: true });
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
    wirePictureFields(qs("#amodal-body"));
    wireVideoFields(qs("#amodal-body"));
    if (sl.bgVideo) showVideo("s-bgvideo", sl.bgVideo);
    qs("#s-save").addEventListener("click", function () {
      sl.word = qs("#s-word").value.toUpperCase();
      sl.shape = qs("#s-shape").value;
      sl.image = qs("#s-img").value;
      sl.bgImage = qs("#s-bgimg").value;
      sl.bgVideo = qs("#s-bgvideo").value;
      sl.bgOnly = qs("#s-bgonly").checked;
      sl.eyebrow = qs("#s-eye").value;
      sl.title = qs("#s-title").value;
      sl.subtitle = qs("#s-sub").value;
      sl.price = parseInt(qs("#s-price").value, 10) || 0;
      sl.compareAt = parseInt(qs("#s-compare").value, 10) || 0;
      sl.cta = qs("#s-cta").value;
      sl.link = qs("#s-link").value;
      sl.theme = sl.theme || {};
      sl.theme.bg = qs("#s-bg").value;
      S.persist();
      closeModal();
      paintSlides();
      toast("Slide saved");
    });
    qs("#s-del").addEventListener("click", function () {
      closeModal();
      confirmDialog("Delete slide?", "This hero slide will be removed.", function () {
        if (sl.bgVideo) ZiqMedia.remove(sl.bgVideo);
        S.settings.heroSlides.splice(i, 1);
        S.persist();
        paintSlides();
        toast("Slide deleted");
      }, true);
    });
  }

  /* Cards saved before the product picker only have a link, so read the handle
     back out of it to pre-select the right product. */
  function lookHandleFromLink(link) {
    var m = /[?&]p=([^&]+)/.exec(String(link || ""));
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
  }

  function paintLooks() {
    var host = qs("#looks");
    if (!host) return;
    var items = S.settings.lookbook || [];
    host.innerHTML = items.map(function (it, i) {
      return '<div class="slide-row slide-row--look">' +
        '<img src="' + esc(it.image) + '" alt="">' +
        '<div><p style="font-size:13.5px">' + esc(it.title) +
          (it.video ? ' <span class="look-row__video">' + A.eye + ' Video</span>' : "") + '</p>' +
        '<p style="font-size:11.5px;color:var(--muted)">' + esc(it.tag || "") + ' → ' + esc(it.link || "") + '</p></div>' +
        '<div class="tbl-actions">' +
          '<button class="abtn abtn--ghost abtn--sm" data-look-edit="' + i + '">Edit</button>' +
          '<button class="abtn abtn--danger abtn--sm" data-look-del="' + i + '">✕</button>' +
        '</div></div>';
    }).join("") || '<p style="font-size:13px;color:var(--muted)">No look cards yet.</p>';

    qsa("[data-look-edit]", host).forEach(function (b) {
      b.addEventListener("click", function () { editLook(+b.dataset.lookEdit); });
    });
    qsa("[data-look-del]", host).forEach(function (b) {
      b.addEventListener("click", function () {
        var gone = items[+b.dataset.lookDel];
        if (gone && gone.video) ZiqMedia.remove(gone.video);
        items.splice(+b.dataset.lookDel, 1);
        S.persist();
        paintLooks();
      });
    });
  }

  function editLook(i) {
    var it = S.settings.lookbook[i];
    var catalogue = S.products({ includeInactive: true });
    var attached = it.product || lookHandleFromLink(it.link);

    openModal("Look card",
      '<div class="f-grid">' +
        videoField("lk-video", it.video, "Video shown on the card",
          "Upload a clip, or point at a file in assets/video/ or a link. Cards with a video play them on the homepage.") +
        pictureField("lk-img", it.image, "Picture shown before the video plays",
          "Used as the poster. Upload your own photo, pick a product picture, or paste a link.",
          it.imageFit || "cover") +
        '<div class="f-group f-full"><label class="f-label" for="lk-prod">Attached product</label>' +
          '<select class="f-input" id="lk-prod">' +
            '<option value="">No product — use the link below</option>' +
            catalogue.map(function (p) {
              return '<option value="' + esc(p.handle) + '"' + (p.handle === attached ? " selected" : "") + '>' +
                esc(p.title) + " — " + money(p.price) + '</option>';
            }).join("") +
          '</select>' +
          '<p class="f-help">The “View product” button on the card opens this product.</p>' +
        '</div>' +
        '<div class="f-group"><label class="f-label">Title</label><input class="f-input" id="lk-title" value="' + esc(it.title) + '"></div>' +
        '<div class="f-group"><label class="f-label">Tag</label><input class="f-input" id="lk-tag" value="' + esc(it.tag || "") + '"></div>' +
        '<div class="f-group f-full"><label class="f-label">Link</label><input class="f-input" id="lk-link" value="' + esc(it.link || "") + '"></div>' +
      '</div>',
      '<button class="abtn abtn--ghost" data-close-modal>Cancel</button><button class="abtn" id="lk-save">Save card</button>',
      { small: true });
    qsa("[data-close-modal]").forEach(function (b) {
      if (!b._bound) { b._bound = true; b.addEventListener("click", closeModal); }
    });
    wirePictureFields(qs("#amodal-body"));
    wireVideoFields(qs("#amodal-body"));
    if (it.video) showVideo("lk-video", it.video);

    qs("#lk-prod").addEventListener("change", function () {
      var handle = qs("#lk-prod").value;
      var picked = null;
      catalogue.forEach(function (p) { if (p.handle === handle) picked = p; });
      if (!picked) return;
      if (!qs("#lk-link").value) qs("#lk-link").value = "product.html?p=" + encodeURIComponent(picked.handle);
      if (!qs("#lk-img").value) showPicture("lk-img", (picked.images || [])[0] || "");
      if (!qs("#lk-title").value) qs("#lk-title").value = picked.title;
    });

    qs("#lk-save").addEventListener("click", function () {
      var handle = qs("#lk-prod").value;
      it.video = qs("#lk-video").value;
      it.image = qs("#lk-img").value;
      it.imageFit = qs("#lk-img-fit").value;
      it.title = qs("#lk-title").value;
      it.tag = qs("#lk-tag").value;
      it.product = handle || "";
      it.link = handle
        ? "product.html?p=" + encodeURIComponent(handle)
        : qs("#lk-link").value;
      S.persist();
      closeModal();
      paintLooks();
      toast("Look card saved");
    });
  }

  /* =================== settings =================== */
  function viewSettings() {
    setTitle("Settings",
      '<button class="abtn abtn--ghost" id="go-security">' + A.lock + ' Security</button>' +
      '<button class="abtn" id="save-settings">' + A.save + ' Save settings</button>');
    var s = S.settings;

    qs("#adm-view").innerHTML =
      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Store identity</h2></div><div class="card__body">' +
        '<div class="f-grid">' +
          '<div class="f-group"><label class="f-label">Store name</label><input class="f-input" id="st-name" value="' + esc(s.storeName) + '"></div>' +
          '<div class="f-group"><label class="f-label">Brand mark</label><input class="f-input" value="assets/img/logo-z.png" disabled title="Replace this file to change the logo"></div>' +
          '<div class="f-group"><label class="f-label">Currency symbol</label><input class="f-input" id="st-cur" value="' + esc(s.currency) + '"></div>' +
          '<div class="f-group"><label class="f-label">Tagline</label><input class="f-input" id="st-tag" value="' + esc(s.tagline) + '"></div>' +
          '<div class="f-group f-full"><label class="f-label">Brand meaning (shown in the footer)</label><input class="f-input" id="st-meaning" value="' + esc(s.brandMeaning || "") + '" placeholder="Zenith in Quality"></div>' +
        '</div></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Shipping &amp; payment</h2></div><div class="card__body">' +
        '<div class="f-grid f-grid--3">' +
          '<div class="f-group"><label class="f-label">Free shipping above</label><input class="f-input" id="st-free" type="number" value="' + s.freeShipping + '"></div>' +
          '<div class="f-group"><label class="f-label">Standard shipping fee</label><input class="f-input" id="st-ship" type="number" value="' + s.shippingFee + '"></div>' +
          '<div class="f-group"><label class="f-label">Cash-on-delivery fee</label><input class="f-input" id="st-cod" type="number" value="' + (s.codFee || 0) + '"></div>' +
        '</div></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Contact details</h2>' +
        '<span class="tag tag--off">Customers see these</span></div><div class="card__body">' +
        '<div class="f-grid">' +
          '<div class="f-group"><label class="f-label">Phone</label><input class="f-input" id="st-phone" value="' + esc(s.phone) + '"></div>' +
          '<div class="f-group"><label class="f-label">WhatsApp (digits only, with country code)</label><input class="f-input" id="st-wa" value="' + esc(s.whatsapp) + '"></div>' +
          '<div class="f-group"><label class="f-label">Email for customer enquiries</label><input class="f-input" id="st-email" type="email" value="' + esc(s.email) + '"></div>' +
          '<div class="f-group"><label class="f-label">Store hours</label><input class="f-input" id="st-hours" value="' + esc(s.hours) + '"></div>' +
          '<div class="f-group f-full"><label class="f-label">Address</label><input class="f-input" id="st-addr" value="' + esc(s.address) + '"></div>' +
          '<div class="f-group f-full"><label class="f-label">Footer note</label><textarea class="f-textarea" id="st-note" style="min-height:70px">' + esc(s.footerNote) + '</textarea></div>' +
        '</div>' +
        '<p class="f-help">Order buttons, the contact page and the footer all read from these fields — change them here and the whole site updates.</p>' +
      '</div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Social links</h2></div><div class="card__body">' +
        '<div class="f-grid f-grid--3">' +
          '<div class="f-group"><label class="f-label">Instagram</label><input class="f-input" id="st-insta" value="' + esc(s.socials.instagram || "") + '"></div>' +
          '<div class="f-group"><label class="f-label">TikTok</label><input class="f-input" id="st-tiktok" value="' + esc(s.socials.tiktok || "") + '"></div>' +
          '<div class="f-group"><label class="f-label">Facebook</label><input class="f-input" id="st-fb" value="' + esc(s.socials.facebook || "") + '"></div>' +
          '<div class="f-group"><label class="f-label">YouTube</label><input class="f-input" id="st-yt" value="' + esc(s.socials.youtube || "") + '"></div>' +
        '</div></div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Theme colours</h2></div><div class="card__body">' +
        '<div class="f-grid f-grid--4">' +
          '<div class="f-group"><label class="f-label">Ink (text)</label><input class="f-input" id="st-ink" type="color" value="' + esc(s.theme.ink) + '" style="height:44px;padding:4px"></div>' +
          '<div class="f-group"><label class="f-label">Cream (surfaces)</label><input class="f-input" id="st-cream" type="color" value="' + esc(s.theme.cream) + '" style="height:44px;padding:4px"></div>' +
          '<div class="f-group"><label class="f-label">Accent</label><input class="f-input" id="st-accent" type="color" value="' + esc(s.theme.accent) + '" style="height:44px;padding:4px"></div>' +
          '<div class="f-group"><label class="f-label">Sale / alert</label><input class="f-input" id="st-sale" type="color" value="' + esc(s.theme.sale || "#b3382f") + '" style="height:44px;padding:4px"></div>' +
        '</div></div></div>' +

      '<div class="card"><div class="card__head"><h2>Admin password</h2></div><div class="card__body">' +
        '<div class="f-group"><label class="f-label">New password</label>' +
          '<input class="f-input" id="st-pw" type="password" value="" autocomplete="new-password" placeholder="Leave blank to keep the current password">' +
        '</div>' +
        '<p class="f-help">Minimum 8 characters. The password is stored as a salted hash, never as plain text. ' +
          'After too many wrong attempts the login locks itself — tune that in the Security tab.</p>' +
      '</div></div>';

    qs("#go-security").addEventListener("click", function () { go("security"); });

    qs("#save-settings").addEventListener("click", function () {
      var before = S.settings;
      var newPw = qs("#st-pw").value;

      if (newPw && newPw.length < 8) {
        toast("Password must be at least 8 characters");
        qs("#st-pw").focus();
        return;
      }

      var patch = {
        storeName: qs("#st-name").value,
        currency: qs("#st-cur").value,
        tagline: qs("#st-tag").value,
        brandMeaning: qs("#st-meaning").value,
        freeShipping: parseInt(qs("#st-free").value, 10) || 0,
        shippingFee: parseInt(qs("#st-ship").value, 10) || 0,
        codFee: parseInt(qs("#st-cod").value, 10) || 0,
        phone: qs("#st-phone").value,
        whatsapp: qs("#st-wa").value,
        email: qs("#st-email").value,
        hours: qs("#st-hours").value,
        address: qs("#st-addr").value,
        footerNote: qs("#st-note").value,
        socials: {
          instagram: qs("#st-insta").value,
          tiktok: qs("#st-tiktok").value,
          facebook: qs("#st-fb").value,
          youtube: qs("#st-yt").value
        },
        theme: {
          ink: qs("#st-ink").value,
          cream: qs("#st-cream").value,
          accent: qs("#st-accent").value,
          sale: qs("#st-sale").value
        }
      };

      var contactChanged = patch.email !== before.email ||
        String(patch.whatsapp).replace(/\D/g, "") !== String(before.whatsapp).replace(/\D/g, "") ||
        patch.phone !== before.phone;

      S.updateSettings(patch);
      if (newPw) S.setPassword(newPw);

      if (newPw) Sec.audit("pw-change", "Admin password changed.");
      if (contactChanged) {
        Sec.audit("email-change", "Contact details changed to " + patch.email + " / " + patch.whatsapp + ".");
      }

      renderShell();
      renderView();
      toast(newPw ? "Settings and password saved" : "Settings saved");
    });
  }

  /* =================== security =================== */
  function ago(ts) {
    var d = Date.now() - ts;
    if (d < 60000) return "just now";
    if (d < 3600000) return Math.floor(d / 60000) + " min ago";
    if (d < 86400000) return Math.floor(d / 3600000) + " hr ago";
    return Math.floor(d / 86400000) + " d ago";
  }

  function hms(ms) {
    var s = Math.ceil(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + "h " : "") + (h || m ? m + "m " : "") + sec + "s";
  }

  var LOG_LABEL = {
    "login-ok": ["Signed in", "ok"],
    "login-fail": ["Wrong password", "warn"],
    "lockout": ["Login blocked", "bad"],
    "unlock": ["Block cleared", "ok"],
    "pw-change": ["Password changed", "ok"],
    "email-change": ["Contact details changed", "warn"],
    "content": ["Content saved", "ok"],
    "policy": ["Lockout rules changed", "warn"],
    "export": ["Backup downloaded", "warn"],
    "import": ["Backup restored", "warn"],
    "reset": ["Store reset", "bad"]
  };

  function viewSecurity() {
    setTitle("Security", "");
    var pol = Sec.policy();
    var lockLeft = Sec.lockRemaining();
    var left = Sec.failsLeft();

    qs("#adm-view").innerHTML =
      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Protection status</h2>' +
        '<span class="sec-chips">' +
          (lockLeft ? '<span class="tag tag--bad">Blocked ' + hms(lockLeft) + '</span>'
                    : '<span class="tag tag--ok">Not blocked</span>') +
        '</span></div><div class="card__body">' +
        '<div class="sec-grid">' +
          '<div class="sec-stat"><span>Blocked after</span><b>' + pol.maxFails + ' wrong passwords</b></div>' +
          '<div class="sec-stat"><span>Block lasts</span><b>' + pol.lockMinutes + ' minute' + (pol.lockMinutes === 1 ? "" : "s") + '</b></div>' +
          '<div class="sec-stat"><span>Tries left</span><b>' + (lockLeft ? "none — blocked" : left + " of " + pol.maxFails) + '</b></div>' +
          '<div class="sec-stat"><span>Status</span><b>' + (lockLeft ? "Blocked" : "Open") + '</b></div>' +
        '</div>' +
      '</div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Password lockout</h2></div><div class="card__body">' +
        '<p class="sec-p">After the set number of wrong passwords the login screen freezes for the set time. ' +
          'The counter goes back to zero as soon as you sign in successfully.</p>' +
        '<div class="f-grid">' +
          '<div class="f-group"><label class="f-label">Wrong passwords before the block</label>' +
            '<input class="f-input" id="sc-max" type="number" min="1" max="20" value="' + pol.maxFails + '"></div>' +
          '<div class="f-group"><label class="f-label">How long the block lasts (minutes)</label>' +
            '<input class="f-input" id="sc-mins" type="number" min="1" max="1440" value="' + pol.lockMinutes + '"></div>' +
        '</div>' +
        '<div class="sec-row"><button class="abtn" id="sc-save">' + A.save + ' Save</button>' +
          (lockLeft ? '<button class="abtn abtn--ghost" id="sc-unlock">Unblock now</button>' : '') + '</div>' +
        '<p class="sec-msg" id="sc-msg"></p>' +
      '</div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Security log</h2>' +
        '<button class="abtn abtn--ghost abtn--sm" id="sc-clearlog">Clear log</button></div>' +
        '<div class="card__body" style="padding:0">' + renderLog() + '</div></div>' +

      '<div class="card sec-note"><div class="card__head"><h2>What this can and cannot do</h2></div><div class="card__body">' +
        '<p class="sec-p">The site has no server, so the block is enforced by the page and remembered in this browser. ' +
          'It stops someone guessing at the login screen, which is the realistic threat.</p>' +
        '<p class="sec-p" style="margin-bottom:0">Anyone with access to this computer could clear the browser data and reset the counter — ' +
          'so the password itself still matters. If you lock yourself out, wait for the timer, or delete just the ' +
          '<code>ziqwear.sec.v1</code> entry in your browser storage. Your products and orders are stored under a different key and are not touched.</p>' +
      '</div></div>';

    function say(msg, ok) {
      var el = qs("#sc-msg");
      el.textContent = msg;
      el.className = "sec-msg is-on" + (ok ? " is-ok" : " is-bad");
    }

    qs("#sc-save").addEventListener("click", function () {
      var max = parseInt(qs("#sc-max").value, 10);
      var mins = parseInt(qs("#sc-mins").value, 10);
      if (!(max >= 1 && max <= 20)) { say("Choose between 1 and 20 attempts.", false); return; }
      if (!(mins >= 1 && mins <= 1440)) { say("Choose between 1 and 1440 minutes.", false); return; }
      S.updateSettings({ security: { maxFails: max, lockMinutes: mins } });
      Sec.audit("policy", "Lockout set to " + max + " attempts / " + mins + " minutes.");
      renderView();
      toast("Lockout rules saved");
    });

    if (qs("#sc-unlock")) {
      qs("#sc-unlock").addEventListener("click", function () {
        Sec.unlock();
        renderView();
        toast("Login unblocked");
      });
    }

    qs("#sc-clearlog").addEventListener("click", function () {
      confirmDialog("Clear the security log?", "The record of past sign-ins and blocked attempts will be erased.", function () {
        var db = JSON.parse(localStorage.getItem("ziqwear.sec.v1") || "{}");
        db.log = [];
        localStorage.setItem("ziqwear.sec.v1", JSON.stringify(db));
        renderView();
        toast("Log cleared");
      }, true);
    });
  }

  function renderLog() {
    var log = Sec.log();
    if (!log.length) {
      return '<p style="padding:22px;font-size:13.5px;color:var(--muted)">Nothing logged yet. Sign-ins, wrong passwords and changes will appear here.</p>';
    }
    return '<div class="sec-log">' + log.map(function (e) {
      var meta = LOG_LABEL[e.kind] || [e.kind, ""];
      return '<div class="sec-log__row">' +
        '<span class="sec-log__dot sec-log__dot--' + (meta[1] || "warn") + '"></span>' +
        '<span class="sec-log__what">' + esc(meta[0]) + (e.note ? '<em>' + esc(e.note) + '</em>' : '') + '</span>' +
        '<span class="sec-log__when">' + ago(e.t) + '</span>' +
      '</div>';
    }).join("") + '</div>';
  }

  /* =================== backup =================== */
  function viewBackup() {
    setTitle("Backup & data", "");
    var size = 0;
    try { size = (localStorage.getItem("ziqwear.db.v1") || "").length; } catch (e) {}

    qs("#adm-view").innerHTML =
      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Export</h2></div><div class="card__body">' +
        '<p style="font-size:13.5px;color:var(--ink-60);line-height:1.7;max-width:520px">Download every product, category, order and setting as a single JSON file. Keep it somewhere safe — it is your full store backup.</p>' +
        '<button class="abtn" id="do-export" style="margin-top:16px">' + A.dl + ' Download backup</button>' +
        '<p class="f-help" style="margin-top:10px">Current data size: ' + Math.round(size / 1024) + ' KB (browser limit is roughly 5 MB)</p>' +
      '</div></div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head"><h2>Import</h2></div><div class="card__body">' +
        '<p style="font-size:13.5px;color:var(--ink-60);line-height:1.7;max-width:520px">Restore from a backup file. This replaces everything currently in the store.</p>' +
        '<label class="abtn abtn--ghost" style="margin-top:16px;cursor:pointer">' + A.up + ' Choose JSON file<input type="file" id="do-import" accept="application/json" hidden></label>' +
      '</div></div>' +

      '<div class="card"><div class="card__head"><h2 style="color:var(--sale)">Danger zone</h2></div><div class="card__body">' +
        '<p style="font-size:13.5px;color:var(--ink-60);line-height:1.7;max-width:520px">Reset the store back to the demo catalogue. All your products, edits and orders will be lost.</p>' +
        '<button class="abtn abtn--danger" id="do-reset" style="margin-top:16px">Reset to demo data</button>' +
      '</div></div>';

    qs("#do-export").addEventListener("click", function () {
      var blob = new Blob([S.exportJSON()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ziqwear-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      Sec.audit("export", "Full backup downloaded.");
      toast("Backup downloaded");
    });

    qs("#do-import").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          S.importJSON(ev.target.result);
          Sec.audit("import", "Backup restored from " + file.name + ".");
          toast("Backup restored");
          renderShell();
          go("dashboard");
        } catch (err) {
          toast("Could not read that file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    qs("#do-reset").addEventListener("click", function () {
      confirmDialog("Reset everything?", "This wipes your products, orders and settings and restores the demo catalogue. There is no undo.", function () {
        S.reset();
        Sec.audit("reset", "Store reset to demo data.");
        toast("Store reset");
        renderShell();
        go("dashboard");
      }, true);
    });
  }

  /* =================== boot =================== */
  document.addEventListener("DOMContentLoaded", function () {
    S.init();
    qs("#login-logo").innerHTML = UI.logo(40);

    function showApp() {
      qs("#login").style.display = "none";
      qs("#app").style.display = "grid";
      renderShell();
      renderView();
    }

    if (S.isLoggedIn()) showApp();

    /* ---- login with wrong-password lockout ---- */
    var lockTimer = null;

    function paintLock() {
      var left = Sec.lockRemaining();
      var pol = Sec.policy();
      var btn = qs("#login-btn");
      var lockEl = qs("#login-lock");
      if (left > 0) {
        btn.disabled = true;
        btn.textContent = "Blocked";
        lockEl.className = "login-lock is-on is-bad";
        lockEl.innerHTML = "Too many wrong passwords. Try again in <b>" + hms(left) + "</b>.";
        if (!lockTimer) lockTimer = setInterval(paintLock, 1000);
      } else {
        btn.disabled = false;
        btn.textContent = "Sign in";
        if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
        var n = Sec.failsLeft();
        if (n < pol.maxFails) {
          lockEl.className = "login-lock is-on is-warn";
          lockEl.textContent = n + " attempt" + (n === 1 ? "" : "s") + " left before a " +
            pol.lockMinutes + "-minute block.";
        } else {
          lockEl.className = "login-lock";
          lockEl.textContent = "";
        }
      }
    }
    paintLock();

    qs("#login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      if (Sec.lockRemaining() > 0) return;

      if (!S.login(qs("#pw").value)) {
        var r = Sec.recordFail();
        qs("#pw").value = "";
        qs("#login-err").style.display = r.locked ? "none" : "block";
        paintLock();
        if (!r.locked) qs("#pw").focus();
        return;
      }

      Sec.recordSuccess();
      qs("#login-err").style.display = "none";
      qs("#pw").value = "";
      showApp();
    });

    S.on("storage:error", function () {
      toast("Storage is full — try smaller images or export a backup");
    });
  });
})();
