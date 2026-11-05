/* ==========================================================================
   ZIQWEAR — data layer
   Single source of truth for products, categories, cart, wishlist and orders.
   Persists to localStorage. Swap `Store.persist()` for API calls to go live.
   ========================================================================== */
(function (global) {
  "use strict";

  var DB_KEY = "ziqwear.db.v1";
  var CART_KEY = "ziqwear.cart.v1";
  var WISH_KEY = "ziqwear.wish.v1";
  var SESSION_KEY = "ziqwear.admin";

  var listeners = {};

  /* Storage shim — falls back to memory when localStorage is unavailable
     (private mode, file:// restrictions, quota exceeded). */
  var mem = {};
  var hasLS = (function () {
    try {
      localStorage.setItem("__dn_test", "1");
      localStorage.removeItem("__dn_test");
      return true;
    } catch (e) { return false; }
  })();

  function readRaw(key) {
    if (hasLS) {
      try { return localStorage.getItem(key); } catch (e) { /* fall through */ }
    }
    return mem[key] != null ? mem[key] : null;
  }

  function writeRaw(key, val) {
    mem[key] = val;
    if (!hasLS) return "nols";
    try {
      localStorage.setItem(key, val);
      return "ok";
    } catch (e) {
      hasLS = false;
      console.warn("localStorage unavailable — using in-memory storage.", e);
      return "quota";
    }
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  var Store = {
    db: null,

    /* ---------- lifecycle ---------- */
    init: function () {
      var raw = readRaw(DB_KEY);
      if (raw) {
        try { this.db = JSON.parse(raw); } catch (e) { this.db = null; }
      }
      if (!this.db || !this.db.products) {
        this.db = clone(global.SEED_DATA);
        this.persist();
      }
      // forward-compatible defaults
      var s = this.db.settings || {};
      var seedS = (global.SEED_DATA && global.SEED_DATA.settings) || {};
      Object.keys(seedS).forEach(function (k) {
        // Never let the seed hash overwrite a password the owner already set.
        if (k === "adminPasswordHash" && (s.adminPassword || s.adminPasswordHash)) return;
        if (k === "adminPassword" && s.adminPasswordHash) return;
        if (s[k] === undefined) s[k] = clone(seedS[k]);
      });
      this.db.settings = s;
      if (!this.db.orders) this.db.orders = [];
      if (!this.db.categories) this.db.categories = [];

      // One-off corrections for values saved before they were finalised.
      var wa = String(s.whatsapp || "").replace(/\D/g, "");
      if (wa === "03089680431" || wa === "923089680431") {
        s.whatsapp = "923281267379";
        s.phone = "+92 328 126 7379";
        this.persist();
      }
      if (!s.email || /@ziqwear\.com$/i.test(s.email)) {
        s.email = "Zohaib8muneer@gmail.com";
        this.persist();
      }

      // Replace any plain-text admin password with a salted hash.
      this.migrateSecrets();

      // One-off: update store location to Multan.
      if (s.address && /Lahore/i.test(s.address) && !/Multan/i.test(s.address)) {
        s.address = "Multan, Punjab, Pakistan";
        s.footerNote = "ZIQWEAR — Zenith in Quality. An independent Pakistani label making graphic-led streetwear in small runs. Drawn, printed, checked and shipped by hand from Multan, Punjab.";
        this.persist();
      }

      // One-off: the palette moves from the ivory boutique theme to white and
      // black. Only colours from the old warm palette are replaced, so a colour
      // the owner picked by hand survives. The logo is untouched — it always
      // sits on dark chrome, which style.css handles per surface.
      var warmHex = ["#1b1714", "#14110e", "#1f1a15", "#262019", "#2a231b", "#332b22", "#3b3222",
        "#4a3c26", "#645a4b", "#6d5c3c", "#6f4f13", "#7d5a17", "#86622a", "#a8813c", "#c9a24b",
        "#d9b878", "#f0dcb4", "#e4dcc9", "#e5dcc9", "#ece5d7", "#f4efe6", "#eae1d3", "#dcd2bd",
        "#d7ccb7", "#dcd2c1", "#e7dfd1", "#e9e0d2", "#dcd0bd", "#e3d3c8", "#d5c1b3", "#e6dbc4",
        "#d8cab0", "#dbe0d3", "#cad1c0", "#f6f2ea", "#f5f0e9", "#faf7f1"];
      var isWarm = function (v) { return warmHex.indexOf(String(v || "").toLowerCase()) >= 0; };
      var monoTheme = { ink: "#111111", cream: "#f6f6f6", accent: "#111111", sale: "#b3382f" };
      if (s.theme) {
        var t = s.theme;
        if (!t.ink || !t.cream || !t.accent || isWarm(t.ink) || isWarm(t.cream) || isWarm(t.accent)) {
          s.theme = Object.assign({}, t, monoTheme);
          this.persist();
        }
      }

      // One-off: the hero stages used saturated brand colours; the old boutique
      // theme turned them into ivory tints. Both eras come back as white and
      // black — saturated or missing stages re-seed, warm ones are recoloured in
      // place so any copy or picture the owner put on a slide stays put.
      if (global.SEED_DATA && global.SEED_DATA.settings && global.SEED_DATA.settings.heroSlides) {
        var seedSlides = global.SEED_DATA.settings.heroSlides;
        var oldStageColors = ["#6b2bd6", "#d6214e", "#f0621e", "#2dbe4e", "#111111", "#333333", "#444444", "#000000", "#1a1a1a", "#222222", "#ffffff"];
        var cur = s.heroSlides || [];
        var needsHeroUpdate = !cur.length || cur.length !== seedSlides.length;
        cur.forEach(function (sl, i) {
          var bg = sl && sl.theme ? String(sl.theme.bg || "").toLowerCase() : "";
          if (!bg || oldStageColors.indexOf(bg) >= 0) needsHeroUpdate = true;
        });
        if (needsHeroUpdate) s.heroSlides = clone(seedSlides);

        var recoloured = false;
        (s.heroSlides || []).forEach(function (sl, i) {
          var th = sl && sl.theme;
          if (!th) return;
          var seed = seedSlides[i] && seedSlides[i].theme;
          ["bg", "bg2", "word", "ink", "accent"].forEach(function (k) {
            if (!isWarm(th[k])) return;
            th[k] = (seed && seed[k]) || (k === "bg" || k === "bg2" ? "#f0f0f0" : "#111111");
            recoloured = true;
          });
        });
        if (needsHeroUpdate || recoloured) this.persist();
      }

      this.syncSeed();
      this.backfillPageSections();
      this.applyTheme();
      this.flushPending();
      return this;
    },

    /* The catalogue is seeded from data.js but stored in the browser, so a product
       that was renamed or re-shot never reaches a visitor who last came before the
       change — they keep the old title and the old image path, which now 404s.
       Bump `version` in data.js whenever the catalogue changes. On a mismatch we
       re-apply the seed's descriptive fields by product id: prices, stock, orders,
       cart and anything the owner added in /admin.html are left alone. Marketing
       copy (hero slides, lookbook, editorial, footer note, reviews) comes back
       from the seed, because it is the seed. */
    syncSeed: function () {
      var seed = global.SEED_DATA;
      if (!seed || !seed.products) return;
      var sv = Number(seed.version) || 0;
      if (Number(this.db.version) === sv) return;

      var byId = {};
      seed.products.forEach(function (sp) { byId[sp.id] = sp; });
      var FIELDS = ["title", "handle", "slug", "description", "images", "tags", "subcategory"];
      (this.db.products || []).forEach(function (p) {
        var sp = byId[p.id];
        if (!sp) return;
        FIELDS.forEach(function (k) { if (sp[k] !== undefined) p[k] = clone(sp[k]); });
      });

      var seeded = {};
      (seed.categories || []).forEach(function (c) { seeded[c.id || c.slug] = 1; });
      var ownerAdded = (this.db.categories || []).filter(function (c) { return !seeded[c.id || c.slug]; });
      this.db.categories = (seed.categories || []).concat(ownerAdded);

      var s = this.db.settings || {};
      ["heroSlides", "lookbook", "editorial", "reviews", "footerNote"].forEach(function (k) {
        if (seed.settings && seed.settings[k] !== undefined) s[k] = clone(seed.settings[k]);
      });
      this.db.settings = s;
      this.db.version = sv;
      this.persist();
    },

    /* The page sections (Key features, Material, Performance, Style) are new
       fields, so a browser that stored the catalogue before they existed has
       products without them. A version bump would overwrite them the moment the
       owner edits one, so this only ever fills keys that are truly absent. */
    backfillPageSections: function () {
      var seed = global.SEED_DATA;
      if (!seed || !seed.products) return;
      var byId = {};
      seed.products.forEach(function (sp) { byId[sp.id] = sp; });
      var KEYS = ["features", "material", "performance", "style"];
      var changed = false;
      (this.db.products || []).forEach(function (p) {
        var sp = byId[p.id];
        if (!sp) return;
        KEYS.forEach(function (k) {
          if (p[k] === undefined && sp[k] !== undefined) { p[k] = clone(sp[k]); changed = true; }
        });
      });
      if (changed) this.persist();
    },

    persist: function () {
      var res = writeRaw(DB_KEY, JSON.stringify(this.db));
      if (res === "quota") this.emit("storage:error", new Error("quota-exceeded"));
      this.emit("db:change", this.db);
    },

    reset: function () {
      this.db = clone(global.SEED_DATA);
      this.persist();
      this.applyTheme();
      this.emit("db:reset");
    },

    /* ---------- events ---------- */
    on: function (evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return function () {
        listeners[evt] = (listeners[evt] || []).filter(function (f) { return f !== fn; });
      };
    },
    emit: function (evt, payload) {
      (listeners[evt] || []).forEach(function (fn) {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    },

    /* ---------- settings ---------- */
    get settings() { return this.db.settings; },
    updateSettings: function (patch) {
      // Copy key by key and refuse prototype keys, so a crafted object can never
      // rewrite the settings object's prototype chain.
      if (patch && typeof patch === "object") {
        Object.keys(patch).forEach(function (k) {
          if (k === "__proto__" || k === "constructor" || k === "prototype") return;
          this.db.settings[k] = patch[k];
        }, this);
      }
      this.persist();
      this.applyTheme();
      return this.db.settings;
    },
    applyTheme: function () {
      var t = this.db.settings.theme || {};
      var root = document.documentElement;
      // Only well-formed colours reach the stylesheet — a value like
      // "red; background-image:url(...)" must not be able to inject rules.
      var hex = function (v) { return /^#[0-9a-f]{3,8}$/i.test(String(v || "").trim()) ? String(v).trim() : ""; };
      if (hex(t.ink)) root.style.setProperty("--ink", hex(t.ink));
      if (hex(t.cream)) root.style.setProperty("--cream", hex(t.cream));
      if (hex(t.accent)) root.style.setProperty("--accent", hex(t.accent));
      if (hex(t.sale)) root.style.setProperty("--sale", hex(t.sale));
    },

    /* ---------- categories ---------- */
    categories: function (opts) {
      var list = (this.db.categories || []).slice().sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
      if (opts && opts.home) list = list.filter(function (c) { return c.showOnHome; });
      return list;
    },
    category: function (id) {
      return this.categories().filter(function (c) { return c.id === id || c.slug === id; })[0] || null;
    },
    addCategory: function (data) {
      var c = Object.assign({ id: uid("cat"), name: "New Category", slug: "", image: "", showOnHome: false, group: "main", order: (this.db.categories.length + 1), children: [] }, data);
      if (!c.slug) c.slug = slugify(c.name);
      this.db.categories.push(c);
      this.persist();
      return c;
    },
    updateCategory: function (id, patch) {
      var c = this.db.categories.filter(function (x) { return x.id === id; })[0];
      if (!c) return null;
      Object.assign(c, patch);
      if (!c.slug) c.slug = slugify(c.name);
      this.persist();
      return c;
    },
    removeCategory: function (id) {
      this.db.categories = this.db.categories.filter(function (c) { return c.id !== id; });
      this.persist();
    },

    /* ---------- products ---------- */
    products: function (opts) {
      opts = opts || {};
      var list = (this.db.products || []).slice();
      if (!opts.includeInactive) list = list.filter(function (p) { return p.active !== false; });
      if (opts.category) {
        list = list.filter(function (p) {
          return p.category === opts.category || p.subcategory === opts.category;
        });
      }
      if (opts.featured) list = list.filter(function (p) { return p.featured; });
      if (opts.isNew) list = list.filter(function (p) { return p.isNew; });
      if (opts.inStock) list = list.filter(function (p) { return p.stock > 0; });
      if (opts.sort) list = this.sortList(list, opts.sort);
      if (opts.limit) list = list.slice(0, opts.limit);
      return list;
    },

    sortList: function (list, sort) {
      var l = list.slice();
      switch (sort) {
        case "price-asc": return l.sort(function (a, b) { return a.price - b.price; });
        case "price-desc": return l.sort(function (a, b) { return b.price - a.price; });
        case "newest": return l.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
        case "best": return l.sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); });
        case "name": return l.sort(function (a, b) { return a.title.localeCompare(b.title); });
        default: return l;
      }
    },

    product: function (handleOrId) {
      if (!handleOrId) return null;
      var key = String(handleOrId).toLowerCase();
      return (this.db.products || []).filter(function (p) {
        return p.handle === key || p.id === handleOrId;
      })[0] || null;
    },
    productById: function (id) {
      return (this.db.products || []).filter(function (p) { return p.id === id; })[0] || null;
    },

    search: function (q, limit) {
      q = String(q || "").trim().toLowerCase();
      if (!q) return [];
      var terms = q.split(/\s+/);
      var scored = (this.db.products || [])
        .filter(function (p) { return p.active !== false; })
        .map(function (p) {
          var hay = [p.title, p.category, p.subcategory, (p.colors || []).join(" "), (p.tags || []).join(" "), p.description].join(" ").toLowerCase();
          var score = 0;
          terms.forEach(function (t) {
            if (!hay) return;
            if (p.title.toLowerCase().indexOf(t) === 0) score += 6;
            if (p.title.toLowerCase().indexOf(t) > -1) score += 4;
            if (hay.indexOf(t) > -1) score += 1;
          });
          return { p: p, score: score };
        })
        .filter(function (x) { return x.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (x) { return x.p; });
      return limit ? scored.slice(0, limit) : scored;
    },

    related: function (product, limit) {
      limit = limit || 4;
      var out = (this.db.products || []).filter(function (p) {
        return p.id !== product.id && p.active !== false &&
          (p.category === product.category || p.subcategory === product.subcategory);
      });
      return this.sortList(out, "best").slice(0, limit);
    },

    addProduct: function (data) {
      var p = Object.assign({
        id: uid("p"),
        title: "Untitled product",
        handle: "",
        category: "tops",
        subcategory: null,
        price: 0,
        compareAt: null,
        images: [],
        colors: [],
        sizes: [],
        extraOptions: [],
        stock: 0,
        sku: "",
        description: "",
        details: [],
        tags: [],
        featured: false,
        isNew: true,
        rating: 5,
        reviews: 0,
        sold: 0,
        active: true,
        createdAt: Date.now()
      }, data);
      if (!p.handle) p.handle = slugify(p.title) || p.id;
      p.discount = p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
      this.db.products.unshift(p);
      this.persist();
      return p;
    },

    updateProduct: function (id, patch) {
      var p = this.productById(id);
      if (!p) return null;
      Object.assign(p, patch);
      p.discount = p.compareAt && p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
      this.persist();
      return p;
    },

    removeProduct: function (id) {
      this.db.products = this.db.products.filter(function (p) { return p.id !== id; });
      this.persist();
    },

    duplicateProduct: function (id) {
      var p = this.productById(id);
      if (!p) return null;
      var copy = clone(p);
      copy.id = uid("p");
      copy.title = p.title + " (Copy)";
      copy.handle = slugify(copy.title);
      copy.createdAt = Date.now();
      this.db.products.unshift(copy);
      this.persist();
      return copy;
    },

    /* ---------- cart ---------- */
    cart: function () {
      try { return JSON.parse(readRaw(CART_KEY) || "[]"); } catch (e) { return []; }
    },
    saveCart: function (items) {
      writeRaw(CART_KEY, JSON.stringify(items));
      this.emit("cart:change", items);
    },
    cartKey: function (id, color, size) {
      return [id, color || "-", size || "-"].join("|");
    },
    addToCart: function (product, opts) {
      opts = opts || {};
      var items = this.cart();
      var key = this.cartKey(product.id, opts.color, opts.size);
      var found = items.filter(function (i) { return i.key === key; })[0];
      var qty = Math.max(1, parseInt(opts.qty, 10) || 1);
      if (found) found.qty += qty;
      else items.push({
        key: key,
        id: product.id,
        title: product.title,
        handle: product.handle,
        image: (product.images || [])[0] || "",
        price: product.price,
        compareAt: product.compareAt || null,
        color: opts.color || "",
        size: opts.size || "",
        qty: qty
      });
      this.saveCart(items);
      return items;
    },
    updateCartQty: function (key, qty) {
      var items = this.cart();
      items.forEach(function (i) {
        if (i.key === key) i.qty = Math.max(0, parseInt(qty, 10) || 0);
      });
      items = items.filter(function (i) { return i.qty > 0; });
      this.saveCart(items);
    },
    removeFromCart: function (key) {
      this.saveCart(this.cart().filter(function (i) { return i.key !== key; }));
    },
    clearCart: function () { this.saveCart([]); },
    cartCount: function () {
      return this.cart().reduce(function (n, i) { return n + i.qty; }, 0);
    },
    cartSubtotal: function () {
      return this.cart().reduce(function (n, i) { return n + i.price * i.qty; }, 0);
    },

    /* ---------- wishlist ---------- */
    wishlist: function () {
      try { return JSON.parse(readRaw(WISH_KEY) || "[]"); } catch (e) { return []; }
    },
    toggleWish: function (id) {
      var w = this.wishlist();
      var has = w.indexOf(id) > -1;
      if (has) w = w.filter(function (x) { return x !== id; });
      else w.push(id);
      writeRaw(WISH_KEY, JSON.stringify(w));
      this.emit("wish:change", w);
      return !has;
    },
    inWish: function (id) { return this.wishlist().indexOf(id) > -1; },
    wishProducts: function () {
      var self = this;
      return this.wishlist().map(function (id) { return self.productById(id); }).filter(Boolean);
    },

    /* ---------- orders ---------- */
    orders: function () {
      return (this.db.orders || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    },
    createOrder: function (payload) {
      var items = this.cart();
      var subtotal = this.cartSubtotal();
      var s = this.settings;
      var shipping = payload.shippingFee != null ? payload.shippingFee : (subtotal >= s.freeShipping ? 0 : s.shippingFee);
      var order = {
        id: "ZQ-" + String(Date.now()).slice(-6),
        createdAt: Date.now(),
        status: "pending",
        items: items,
        subtotal: subtotal,
        shipping: shipping,
        total: subtotal + shipping,
        customer: payload.customer || {},
        payment: payload.payment || "cod",
        notes: payload.notes || "",
        channel: payload.channel || "web"
      };
      this.db.orders = this.db.orders || [];
      this.db.orders.unshift(order);
      // decrement stock
      var self = this;
      items.forEach(function (line) {
        var p = self.productById(line.id);
        if (p) p.stock = Math.max(0, (p.stock || 0) - line.qty);
      });
      this.persist();
      this.clearCart();

      /* Sync order to the server so the admin can see it from any browser. */
      this.syncOrderToServer(order);

      return order;
    },
    updateOrderStatus: function (id, status) {
      var o = (this.db.orders || []).filter(function (x) { return x.id === id; })[0];
      if (o) { o.status = status; this.persist(); }

      /* Also update the server-side order store. */
      this.syncStatusToServer(id, status);

      return o;
    },
    deleteOrder: function (id) {
      this.db.orders = (this.db.orders || []).filter(function (x) { return x.id !== id; });
      this.persist();

      /* Also delete from the server-side order store. */
      this.syncDeleteOrder(id);

      return true;
    },
    addManualOrder: function (payload) {
      var items = payload.items || [];
      var subtotal = items.reduce(function (sum, i) { return sum + (i.price * i.qty); }, 0);
      var shipping = payload.shippingFee != null ? payload.shippingFee : 0;
      var order = {
        id: "ZQ-" + String(Date.now()).slice(-6),
        createdAt: Date.now(),
        status: payload.status || "pending",
        items: items,
        subtotal: subtotal,
        shipping: shipping,
        total: subtotal + shipping,
        customer: payload.customer || {},
        payment: payload.payment || "cod",
        notes: payload.notes || "",
        channel: "manual"
      };
      this.db.orders = this.db.orders || [];
      this.db.orders.unshift(order);
      this.persist();

      /* Sync to server so it shows across all browsers. */
      this.syncOrderToServer(order);

      return order;
    },
    /* ---- Server-side order sync -------------------------------- ----
       These pages run with no backend at all, but an order that only lives in
       one browser is an order nobody can fulfil. Previously the endpoints were
       relative, so they resolved against the page path and only ever reached
       the API when the backend itself served the page from the site root.

       The base is same-origin "/api" by default, which is what both servers
       answer: the backend when it serves these pages, and server.ps1 on :8777,
       which implements /api/orders itself. Override with
       `window.ZIQ_API = "/api"` (a script tag before store.js) when the API is
       mounted elsewhere. It must stay same-origin, because every page declares
       `connect-src 'self'`. When no base is available, or the POST fails, the
       order goes into a pending queue and is retried on the next visit rather
       than being dropped silently. */
    apiBase: function () {
      var cfg = global.ZIQ_API;
      if (!cfg) {
        return location.protocol === "http:" || location.protocol === "https:" ? "/api" : "";
      }
      cfg = String(cfg).trim();
      if (!cfg) return "";
      if (/^[a-z][a-z0-9+.-]*:/i.test(cfg)) {
        try {
          if (new URL(cfg).origin !== location.origin) {
            console.warn("ZIQ_API is cross-origin; CSP connect-src 'self' would block it. Ignoring.", cfg);
            return "";
          }
          return cfg.replace(/\/+$/, "");
        } catch (e) { return ""; }
      }
      return cfg.replace(/\/+$/, "");
    },
    request: function (method, path, body, cb) {
      var base = this.apiBase();
      cb = cb || function () {};
      if (!base) { cb(false); return; }
      var xhr = new XMLHttpRequest();
      xhr.open(method, base + path, true);
      xhr.timeout = 8000;
      if (body) xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        cb(xhr.status >= 200 && xhr.status < 300);
      };
      try { xhr.send(body ? JSON.stringify(body) : null); }
      catch (e) { cb(false); }
    },
    queuePending: function (entry) {
      this.db.pending = this.db.pending || [];
      this.db.pending.unshift(entry);
      if (this.db.pending.length > 200) this.db.pending.length = 200;
      this.persist();
      console.warn("Order not synced to the server yet — queued for retry (" + entry.id + ").");
    },
    flushPending: function () {
      var self = this;
      var queue = (this.db && this.db.pending) || [];
      if (!queue.length || !this.apiBase()) return;
      queue.slice().forEach(function (entry) {
        self.request("POST", "/orders", entry.payload, function (ok) {
          if (!ok) return;
          self.db.pending = (self.db.pending || []).filter(function (x) { return x.id !== entry.id; });
          self.persist();
        });
      });
    },
    syncOrderToServer: function (order) {
      var self = this;
      if (!this.apiBase()) { this.queuePending({ id: order.id, payload: order }); return; }
      this.request("POST", "/orders", order, function (ok) {
        if (!ok) self.queuePending({ id: order.id, payload: order });
      });
    },
    syncStatusToServer: function (id, status) {
      if (!this.apiBase()) return;
      this.request("POST", "/orders/status", { orderId: id, status: status }, function (ok) {
        if (!ok) console.warn("Status change did not reach the server: " + id);
      });
    },
    syncDeleteOrder: function (id) {
      if (!this.apiBase()) return;
      this.request("POST", "/orders/delete", { orderId: id }, function (ok) {
        if (!ok) console.warn("Delete did not reach the server: " + id);
      });
    },
    /* Fetch all orders from the server. Falls back to localStorage on error. */
    fetchServerOrders: function (cb) {
      cb = cb || function () {};
      var base = this.apiBase();
      if (!base) { cb(this.orders(), false); return; }
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", base + "/orders", true);
        xhr.timeout = 8000;
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) return;
          if (xhr.status === 200) {
            try {
              var serverOrders = JSON.parse(xhr.responseText);
              if (serverOrders && serverOrders.length) {
                /* Merge server orders into localStorage, avoiding duplicates. */
                var local = (this.db && this.db.orders) ? this.db.orders : [];
                var seen = {};
                local.forEach(function (o) { seen[o.id] = true; });
                var self2 = this;
                serverOrders.forEach(function (so) {
                  if (!seen[so.id]) {
                    self2.db.orders = self2.db.orders || [];
                    self2.db.orders.unshift(so);
                  }
                });
                this.persist();
                cb(this.orders(), true);
                return;
              }
            } catch (e) {}
          }
          cb(this.orders(), false);
        }.bind(this);
        xhr.send();
      } catch (e) {
        cb(this.orders(), false);
      }
    },
    ordersByPhone: function (phone) {
      var digits = String(phone || "").replace(/\D/g, "").slice(-10);
      if (!digits) return [];
      return this.orders().filter(function (o) {
        var p = String((o.customer && o.customer.phone) || "").replace(/\D/g, "");
        return p.slice(-10) === digits;
      });
    },

    /* ---------- stats ---------- */
    stats: function () {
      var orders = this.orders();
      var revenue = orders.filter(function (o) { return o.status !== "cancelled"; })
        .reduce(function (n, o) { return n + o.total; }, 0);
      var products = this.db.products || [];
      return {
        revenue: revenue,
        orders: orders.length,
        products: products.length,
        active: products.filter(function (p) { return p.active !== false; }).length,
        lowStock: products.filter(function (p) { return p.stock > 0 && p.stock <= 5; }).length,
        outOfStock: products.filter(function (p) { return !p.stock; }).length,
        pending: orders.filter(function (o) { return o.status === "pending"; }).length,
        avgOrder: orders.length ? Math.round(revenue / orders.length) : 0
      };
    },

    /* ---------- admin auth ---------- */
    /* Passwords are stored as "sha256$iter$salt$hex" in settings.adminPasswordHash.
       Older builds kept a plain-text settings.adminPassword; migrateSecrets()
       converts and deletes it so the value never sits readable in localStorage. */
    login: function (pw) {
      var s = this.settings || {};
      var ok = false;

      if (global.Sec && global.Sec.verifyPw && s.adminPasswordHash) {
        ok = global.Sec.verifyPw(String(pw), s.adminPasswordHash);
      } else if (s.adminPassword) {
        // Only reachable if the hash could not be created (e.g. a page that does
        // not load security.js). Better than locking the owner out entirely.
        ok = String(pw) === String(s.adminPassword);
      }

      if (ok) {
        try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) { mem[SESSION_KEY] = "1"; }
        return true;
      }
      return false;
    },
    /* Move any plain-text password into a salted hash. Safe to call repeatedly. */
    migrateSecrets: function () {
      if (!global.Sec || !global.Sec.makeHash) return false;
      var s = (this.db && this.db.settings) || {};
      var changed = false;

      if (s.adminPassword) {
        // Plain text always wins over a hash copied in from the seed — it is the
        // password the owner is actually using.
        s.adminPasswordHash = global.Sec.makeHash(String(s.adminPassword));
        delete s.adminPassword;
        changed = true;
      }
      if (!s.adminPasswordHash) {
        var seed = (global.SEED_DATA && global.SEED_DATA.settings) || {};
        if (seed.adminPasswordHash && global.Sec.isHash(seed.adminPasswordHash)) {
          s.adminPasswordHash = seed.adminPasswordHash;
        } else {
          s.adminPasswordHash = global.Sec.makeHash(String(seed.adminPassword || "ziqwear-admin"));
        }
        changed = true;
      }
      if (changed) this.persist();
      return changed;
    },
    /* Used by the admin panel when the password is changed. */
    setPassword: function (pw) {
      if (!global.Sec || !global.Sec.makeHash) return false;
      if (String(pw).length < 8) return false;
      var s = this.db.settings;
      s.adminPasswordHash = global.Sec.makeHash(String(pw));
      delete s.adminPassword;
      this.persist();
      return true;
    },
    isLoggedIn: function () {
      try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return mem[SESSION_KEY] === "1"; }
    },
    logout: function () {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
      delete mem[SESSION_KEY];
    },

    /* ---------- import / export ---------- */
    exportJSON: function () {
      return JSON.stringify(this.db, null, 2);
    },
    importJSON: function (text) {
      var data = JSON.parse(text);
      if (!data || !Array.isArray(data.products)) throw new Error("Invalid backup file — missing products.");
      if (data.settings == null || typeof data.settings !== "object") data.settings = {};

      // Keep only the shapes the app knows how to render. A hand-edited or
      // malicious backup cannot smuggle in a prototype key or a non-array
      // where a list is expected.
      if (!Array.isArray(data.orders)) data.orders = [];
      if (!Array.isArray(data.categories)) data.categories = [];
      ["products", "orders", "categories"].forEach(function (k) {
        data[k] = data[k].filter(function (r) { return r && typeof r === "object" && !Array.isArray(r); });
      });

      this.db = data;
      this.persist();
      this.migrateSecrets();
      this.applyTheme();
      return true;
    },

    /* ---------- helpers ---------- */
    money: function (n) {
      var cur = (this.db && this.db.settings && this.db.settings.currency) || "Rs";
      var v = Math.round(Number(n) || 0);
      return cur + " " + v.toLocaleString("en-US");
    },
    uid: uid,
    slugify: slugify
  };

  global.Store = Store;
})(window);
