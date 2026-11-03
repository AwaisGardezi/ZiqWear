/* ==========================================================================
   ZIQWEAR — 3D Rail Wardrobe (TypeScript port of assets/js/rail.js)

   Every garment hangs edge-on from the rail. Hover turns it to face you, click
   pulls it off the rail into focus. Transitions are lerped per frame so the
   whole rail moves as one physical object.

   This is a plain ESM module — no <script> tag, no eval, no CSP workaround.
   All store/UI coupling from the original (window.Store / UI.*) is replaced by
   the RailOptions callbacks passed to the constructor, so the rail can be fed
   from the app's real catalogue and cart.
   ========================================================================== */

import { RAIL_ASSETS } from "./railAssets";

/** The shape the rail needs — mapped from the API Product by the caller. */
export interface RailProduct {
  id: string;
  handle: string;
  title: string;
  price: number;
  compareAt?: number | null;
  stock: number;
  sizes: string[];
  colors: string[];
  /** fallback photo url when no transparent cutout is prepared for this handle */
  image?: string;
  active?: boolean;
}

export interface RailSelection {
  size: string;
  color?: string;
  qty: number;
}

export interface RailOptions {
  /** false renders the control-panel-less band used on the homepage */
  panel?: boolean;
  products: RailProduct[];
  storeName?: string;
  tagline?: string;
  onAddToCart: (product: RailProduct, sel: RailSelection) => void;
  onToggleWish: (product: RailProduct) => void;
  onToast: (msg: string) => void;
  onNavigate: (href: string) => void;
  /** is this product currently in the wishlist (drives the heart's is-on state) */
  isWished?: (product: RailProduct) => boolean;
  /** optional overlay check so the rail never steals keys while a modal is open */
  isOverlayOpen?: () => boolean;
  formatPrice?: (n: number) => string;
}

interface RailAssetResolved {
  src: string;
  label: string;
  cloth: number;
  masked: boolean;
}

interface HangItem {
  i: number;
  product: RailProduct;
  label: string;
  cloth: number;
  base: string;
  node: HTMLElement;
  body: HTMLElement;
  hit: HTMLElement;
  clothEl: HTMLElement;
  img: HTMLImageElement;
  shadowImg: HTMLImageElement;
  x: number; y: number; z: number; ry: number; rz: number; sc: number; blur: number; op: number;
  tx: number; ty: number; tz: number; try_: number; trz: number; tsc: number; tblur: number; top_: number;
  imgRatio: number;
  swayY: number;
  phase: number;
  home?: number;
  w?: number;
  seeded?: boolean;
  _lit?: boolean;
}

const ICON = {
  chevL: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 6l-6 6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0112 8a3.8 3.8 0 017 2.8C19 15.6 12 20 12 20z"/></svg>',
};

const HANGER =
  '<svg viewBox="0 0 42 58" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M21 3.5c-4.4 0-7 2.6-7 5.8 0 2.4 1.4 3.9 3.1 5 1.9 1.3 3.9 2.3 3.9 4.6 0 1.6-1.2 2.6-2.6 3.1"/>' +
  '<path d="M18.5 27.2 4 43.6c-1.4 1.6-.3 4.1 2 4.1h30c2.3 0 3.4-2.5 2-4.1L23.5 27.2a3.9 3.9 0 0 0-5 0z"/>' +
  "</svg>";

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function esc(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function qs(sel: string, root: ParentNode = document): HTMLElement | null {
  return root.querySelector(sel) as HTMLElement | null;
}
function qsa(sel: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel)) as HTMLElement[];
}

function shortLabel(title: string): string {
  const t = String(title || "").replace(/[""']/g, " ");
  const parts = t.split(/\s+/).filter(Boolean);
  if (!parts.length) return "Piece";
  if (parts[0].toUpperCase() === "ZIQWEAR") return parts.slice(1, 3).join(" ") || parts[0];
  return parts.slice(0, 2).join(" ");
}

export class Rail {
  host: HTMLElement;
  opts: RailOptions;
  panel: boolean;
  items: HangItem[] = [];
  focus = -1;
  hover = -1;
  puff = 62; // 0 = facing front, 100 = flat edge-on
  flow = 58;
  flowOn = true;
  size: Record<string, string> = {}; // handle -> chosen size
  overrides: Record<string, string> = {}; // handle -> object URL of a dropped mockup
  tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  time = 0;
  _off: Array<() => void> = [];
  reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  pointerFine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  raf = 0;
  visible = true;
  io: IntersectionObserver | null = null;
  W = 0;
  H = 0;

  stage!: HTMLElement;
  track!: HTMLElement;
  nameEl!: HTMLElement;
  metaEl!: HTMLElement;
  indexEl!: HTMLElement;
  buyEl!: HTMLElement;
  hintEl: HTMLElement | null = null;
  toggleBtn: HTMLElement | null = null;
  chipEls: HTMLElement[] = [];

  constructor(host: HTMLElement, opts: RailOptions) {
    this.host = host;
    this.opts = opts;
    this.panel = opts.panel !== false;
    this.build();

    // no cursor to hover with on touch, so let the rail hang open for a tap
    if (!this.pointerFine) {
      this.setPuff(30);
    }

    this.bind();
    this.layout();
    this.watch();
    this.loop();
  }

  private on(target: EventTarget, evt: string, fn: EventListenerOrEventListenerObject, o?: AddEventListenerOptions): void {
    target.addEventListener(evt, fn, o);
    this._off.push(() => target.removeEventListener(evt, fn, o));
  }

  private money(n: number): string {
    return this.opts.formatPrice ? this.opts.formatPrice(n) : String(n);
  }

  /** keep the range input and the state in one place, so the touch default can
   *  be applied whether or not a control panel was rendered */
  setPuff(v: number): void {
    this.puff = v;
    const input = qs("#puff", this.host) as HTMLInputElement | null;
    const out = qs("#puff-val", this.host);
    if (input) input.value = String(v);
    if (out) out.textContent = v + "%";
  }

  build(): void {
    const prods = this.opts.products.filter((p) => p.active !== false);

    const stage =
      '<div class="rail-stage" data-rail-stage>' +
      '<div class="rail-spot"></div>' +
      '<div class="rail-kicker"><span>Drop 01 — Core Archive · hanging now</span></div>' +
      '<div class="rail-track" data-rail-track><div class="rail-bar"></div></div>' +
      '<div class="rail-floor"></div>' +
      '<button class="rail-nav rail-nav--prev" type="button" aria-label="Previous garment" data-rail-prev>' + ICON.chevL + "</button>" +
      '<button class="rail-nav rail-nav--next" type="button" aria-label="Next garment" data-rail-next>' + ICON.chevR + "</button>" +
      '<div class="rail-buy" data-rail-buy></div>' +
      '<div class="rail-caption">' +
      '<span class="rail-caption__index" data-rail-index></span>' +
      '<h2 class="rail-caption__name" data-rail-name></h2>' +
      '<p class="rail-caption__meta" data-rail-meta></p>' +
      "</div>" +
      '<div class="rail-word">Wardrobe</div>' +
      "</div>";

    const panel = this.panel
      ? '<aside class="rail-panel">' +
        '<div class="rail-panel__brand">' +
        '<img src="/assets/img/logo-z.png" alt="">' +
        "<span>" + esc(this.opts.storeName || "ZIQWEAR") + "</span>" +
        "</div>" +
        '<p class="rail-panel__note">The rail — everything hanging, like the shop.</p>' +
        '<button class="rail-btn rail-btn--solid" type="button" data-rail-toggle>Back to one garment</button>' +
        "<div>" +
        '<span class="rail-label">Garment</span>' +
        '<div class="rail-chips" data-rail-chips></div>' +
        "</div>" +
        '<div class="rail-drop" data-rail-drop role="button" tabindex="0">' +
        "<b>Drop your mockup</b>" +
        "<small>one transparent PNG/WebP with front&nbsp;+&nbsp;side, or front only</small>" +
        "</div>" +
        '<input type="file" data-rail-file accept="image/png,image/webp" hidden>' +
        '<div class="rail-slider">' +
        '<div class="rail-slider__head"><span class="rail-label" style="margin:0">Puff</span>' +
        '<span class="rail-slider__val" data-rail-puff-val>62%</span></div>' +
        '<input type="range" class="rail-range" id="puff" min="0" max="100" value="62" aria-label="How puffed the garments hang">' +
        "</div>" +
        '<div class="rail-slider">' +
        '<label class="rail-check"><input type="checkbox" id="flow-on" checked>' +
        '<span class="rail-check__box">' + ICON.check + "</span>" +
        '<span class="rail-check__text">Flow</span></label>' +
        '<div class="rail-slider__head"><span class="rail-label" style="margin:0">Sway</span>' +
        '<span class="rail-slider__val" data-rail-flow-val>58%</span></div>' +
        '<input type="range" class="rail-range" id="flow" min="0" max="100" value="58" aria-label="How much the fabric swings">' +
        "</div>" +
        '<p class="rail-hint" data-rail-hint></p>' +
        "</aside>"
      : "";

    this.host.innerHTML =
      '<div class="rail-grid' + (this.panel ? "" : " rail-grid--solo") + '">' + panel + stage + "</div>";

    this.stage = qs("[data-rail-stage]", this.host)!;
    this.track = qs("[data-rail-track]", this.host)!;
    this.nameEl = qs("[data-rail-name]", this.host)!;
    this.metaEl = qs("[data-rail-meta]", this.host)!;
    this.indexEl = qs("[data-rail-index]", this.host)!;
    this.buyEl = qs("[data-rail-buy]", this.host)!;
    this.hintEl = this.panel ? qs("[data-rail-hint]", this.host) : null;
    this.toggleBtn = this.panel ? qs("[data-rail-toggle]", this.host) : null;
    this.chipEls = [];

    // one hanging node per product
    prods.forEach((p, i) => {
      const prepared = RAIL_ASSETS[p.handle];
      const cfg: RailAssetResolved = prepared
        ? { src: prepared.src, label: prepared.label, cloth: prepared.cloth, masked: false }
        : {
            src: p.image || "/img/placeholder.jpg",
            label: shortLabel(p.title),
            cloth: 200,
            masked: true,
          };

      const node = document.createElement("div");
      node.className = "hang";
      node.style.setProperty("--w", cfg.cloth + "px");
      node.innerHTML =
        '<div class="hang__body">' +
        '<div class="hang__shadow"><img src="' + esc(cfg.src) + '" alt="" aria-hidden="true"></div>' +
        '<div class="hang__hanger">' + HANGER + "</div>" +
        '<div class="hang__cloth' + (cfg.masked ? " is-masked" : "") + '">' +
        '<img src="' + esc(cfg.src) + '" alt="' + esc(p.title) + '" draggable="false" loading="' +
        (this.panel && i < 3 ? "eager" : "lazy") +
        '">' +
        "</div>" +
        "</div>" +
        '<div class="hang__hit" role="button" tabindex="0" aria-label="' + esc(p.title) + '"></div>';
      this.track.appendChild(node);

      const img = qs(".hang__cloth img", node) as HTMLImageElement;
      const it: HangItem = {
        i,
        product: p,
        label: cfg.label,
        cloth: cfg.cloth,
        base: cfg.src,
        node,
        body: qs(".hang__body", node)!,
        hit: qs(".hang__hit", node)!,
        clothEl: qs(".hang__cloth", node)!,
        img,
        shadowImg: qs(".hang__shadow img", node) as HTMLImageElement,
        x: 0, y: 0, z: 0, ry: 0, rz: 0, sc: 1, blur: 0, op: 1,
        tx: 0, ty: 0, tz: 0, try_: 0, trz: 0, tsc: 1, tblur: 0, top_: 1,
        imgRatio: 0.95,
        swayY: 0,
        phase: i * 0.9,
      };
      this.items.push(it);

      const measure = () => {
        if (img.naturalWidth) it.imgRatio = img.naturalHeight / img.naturalWidth;
      };
      img.addEventListener("load", measure);
      if (img.complete) measure();
    });

    // chips
    if (!this.panel) return;
    const chips = qs("[data-rail-chips]", this.host)!;
    chips.innerHTML = this.items
      .map(
        (it) =>
          '<button class="rail-chip" type="button" data-goto="' + it.i + '" title="' + esc(it.product.title) + '">' +
          esc(it.label) +
          "</button>"
      )
      .join("");
    this.chipEls = qsa(".rail-chip", chips);
  }

  bind(): void {
    this.chipEls.forEach((c) => {
      this.on(c, "click", () => this.focusTo(parseInt(c.dataset.goto || "0", 10)));
    });

    this.items.forEach((it) => {
      const hit = qs(".hang__hit", it.node)!;
      this.on(hit, "mouseenter", () => {
        this.hover = it.i;
        this.caption();
      });
      this.on(hit, "mouseleave", () => {
        if (this.hover === it.i) {
          this.hover = -1;
          this.caption();
        }
      });
      this.on(hit, "click", () => {
        if (this.focus === it.i) this.release();
        else this.focusTo(it.i);
      });
      this.on(hit, "keydown", (e) => {
        const ev = e as KeyboardEvent;
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          this.focusTo(it.i);
        }
      });
    });

    if (this.toggleBtn) {
      this.on(this.toggleBtn, "click", () => {
        if (this.focus > -1) this.release();
        else this.focusTo(this.hover > -1 ? this.hover : 0);
      });
    }

    this.on(qs("[data-rail-prev]", this.host)!, "click", () => this.step(-1));
    this.on(qs("[data-rail-next]", this.host)!, "click", () => this.step(1));

    // pointer parallax across the whole stage
    this.on(this.stage, "pointermove", (e) => {
      if (!this.pointerFine || this.reduce) return;
      const ev = e as PointerEvent;
      const r = this.stage.getBoundingClientRect();
      this.tilt.tx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
      this.tilt.ty = ((ev.clientY - r.top) / r.height - 0.5) * 2;
    });
    this.on(this.stage, "pointerleave", () => {
      this.tilt.tx = 0;
      this.tilt.ty = 0;
    });

    // keyboard: arrows walk the rail, Esc releases it. On the homepage the rail
    // is one band among many, so it only answers keys while focus is inside it
    // and must never steal the page's own arrow scrolling.
    this.on(document, "keydown", (e) => {
      const ev = e as KeyboardEvent;
      if (!qs("[data-rail-stage]", this.host)) return;
      const panel = qs(".rail-panel", this.host);
      const target = ev.target as Element | null;
      if (target && panel && panel.contains(target)) return;
      if (!this.panel && !(target && this.host.contains(target))) return;
      const tag = target && (target as HTMLElement).tagName;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag || "")) return;
      if (this.opts.isOverlayOpen && this.opts.isOverlayOpen()) return;
      if (ev.key === "ArrowRight") this.step(1);
      else if (ev.key === "ArrowLeft") this.step(-1);
      else if (ev.key === "Escape" && this.focus > -1) this.release();
    });

    let rt: number | undefined;
    this.on(window, "resize", () => {
      if (rt) window.clearTimeout(rt);
      rt = window.setTimeout(() => this.layout(), 120);
    });

    if (!this.panel) return;

    // puff
    const puff = qs("#puff", this.host) as HTMLInputElement | null;
    if (puff) this.on(puff, "input", () => this.setPuff(parseInt(puff.value, 10) || 0));

    // flow
    const flow = qs("#flow", this.host) as HTMLInputElement | null;
    const flowVal = qs("[data-rail-flow-val]", this.host);
    const flowOn = qs("#flow-on", this.host) as HTMLInputElement | null;
    if (flow)
      this.on(flow, "input", () => {
        this.flow = parseInt(flow.value, 10) || 0;
        if (flowVal) flowVal.textContent = this.flow + "%";
      });
    if (flowOn)
      this.on(flowOn, "change", () => {
        this.flowOn = flowOn.checked;
      });

    // mockup drop / reskin
    const drop = qs("[data-rail-drop]", this.host)!;
    const file = qs("[data-rail-file]", this.host) as HTMLInputElement | null;
    if (file)
      this.on(file, "change", () => {
        if (file.files && file.files[0]) this.applyMockup(file.files[0]);
        file.value = "";
      });
    this.on(drop, "click", () => file && file.click());
    this.on(drop, "keydown", (e) => {
      const ev = e as KeyboardEvent;
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        file && file.click();
      }
    });
    (["dragenter", "dragover"] as const).forEach((ev) => {
      this.on(drop, ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-over");
      });
    });
    (["dragleave", "drop"] as const).forEach((ev) => {
      this.on(drop, ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-over");
      });
    });
    this.on(drop, "drop", (e) => {
      const dt = (e as DragEvent).dataTransfer;
      const f = dt && dt.files && dt.files[0];
      if (f) this.applyMockup(f);
    });
  }

  layout(): void {
    const r = this.stage.getBoundingClientRect();
    this.W = r.width;
    this.H = r.height;
    const n = this.items.length;
    if (!n) return;

    // keep the rail centred and let the cloth shrink on narrow stages
    const pad = Math.max(70, this.W * 0.11);
    const span = this.W - pad * 2;
    const step = n > 1 ? span / (n - 1) : 0;
    const maxW = clamp(step * 0.94, 96, 210);

    this.items.forEach((it) => {
      it.home = pad + step * it.i - (n > 1 ? 0 : span / 2);
      it.w = Math.min(maxW, it.cloth);
      it.node.style.setProperty("--w", it.w + "px");

      // first pass drops each piece straight onto the rail, otherwise the
      // opening frame lerps every garment out of the top-left corner
      if (!it.seeded) {
        it.seeded = true;
        it.x = it.tx = it.home;
        it.ry = it.try_ = this.puff * 0.86;
      }
    });
  }

  focusTo(i: number): void {
    if (i < 0 || i >= this.items.length) return;
    this.focus = i;
    this.hover = -1;
    this.host.classList.add("is-focus");
    if (this.toggleBtn) this.toggleBtn.textContent = "Back to the rail";
    this.caption();
  }

  release(): void {
    this.focus = -1;
    this.hover = -1;
    this.host.classList.remove("is-focus");
    if (this.toggleBtn) this.toggleBtn.textContent = "Back to one garment";
    this.caption();
  }

  step(dir: number): void {
    const n = this.items.length;
    if (!n) return;
    const i = this.focus > -1 ? (this.focus + dir + n) % n : dir > 0 ? 0 : n - 1;
    this.focusTo(i);
  }

  syncChips(): void {
    const f = this.focus;
    this.chipEls.forEach((c) => {
      c.classList.toggle("is-on", parseInt(c.dataset.goto || "-1", 10) === f);
    });
  }

  caption(): void {
    const it = this.focus > -1 ? this.items[this.focus] : this.hover > -1 ? this.items[this.hover] : null;
    const n = this.items.length;

    if (this.focus > -1) {
      this.indexEl.textContent = String(this.focus + 1).padStart(2, "0") + " / " + String(n).padStart(2, "0");
    } else if (it) {
      this.indexEl.textContent = String(it.i + 1).padStart(2, "0") + " / " + String(n).padStart(2, "0");
    } else {
      this.indexEl.textContent = n + " pieces on the rail";
    }

    const color = it && it.product.colors[0];
    this.nameEl.textContent = it ? it.product.title : this.opts.tagline || "Wear your identity";

    if (it) {
      const p = it.product;
      const price = this.money(p.price);
      const was = p.compareAt ? " <s>" + this.money(p.compareAt) + "</s>" : "";
      const stock =
        p.stock > 0
          ? '<span style="opacity:.55"> · ' + p.stock + " left</span>"
          : '<span style="color:var(--rail-sale)"> · sold out</span>';
      this.metaEl.innerHTML = "<b>" + price + "</b>" + was + (color ? " · " + esc(color) : "") + stock;
    } else {
      this.metaEl.textContent = "Hover to turn a piece · click to open it";
    }

    if (this.hintEl) {
      this.hintEl.textContent =
        this.focus > -1
          ? "Drop a mockup to reskin this piece, or use the arrows to move along the rail."
          : "Hover to turn one to the front, click to open it. Pick a garment above, then drop a mockup to replace it.";
    }

    this.paintBuy();
    this.syncChips();
  }

  /** the buy row only exists in focus mode */
  paintBuy(): void {
    if (this.focus < 0) {
      this.buyEl.innerHTML = "";
      return;
    }
    const it = this.items[this.focus];
    const p = it.product;
    const sizes = p.sizes || [];
    const chosen = this.size[p.handle] || sizes[0] || "";
    const wished = this.opts.isWished ? this.opts.isWished(p) : false;

    this.buyEl.innerHTML =
      '<div class="rail-sizes">' +
      sizes
        .map(
          (s) =>
            '<button class="rail-size' + (s === chosen ? " is-on" : "") + '" type="button" data-size="' + esc(s) + '">' + esc(s) + "</button>"
        )
        .join("") +
      "</div>" +
      '<button class="rail-btn rail-btn--gold" type="button" data-rail-add' + (p.stock ? "" : " disabled") + ">" +
      (p.stock ? "Add to bag" : "Sold out") +
      "</button>" +
      '<a class="rail-btn" href="/product/' + encodeURIComponent(p.handle) + '" data-rail-view>View piece</a>' +
      '<button class="rail-btn' + (wished ? " is-on" : "") + '" type="button" data-rail-wish aria-label="Save to wishlist">' +
      ICON.heart +
      "</button>";

    qsa("[data-size]", this.buyEl).forEach((b) => {
      b.addEventListener("click", () => {
        this.size[p.handle] = b.dataset.size || "";
        this.paintBuy();
      });
    });

    const add = qs("[data-rail-add]", this.buyEl);
    if (add && p.stock) {
      add.addEventListener("click", () => {
        this.opts.onAddToCart(p, { size: chosen, color: p.colors[0], qty: 1 });
      });
    }

    const view = qs("[data-rail-view]", this.buyEl);
    if (view) {
      view.addEventListener("click", (e) => {
        e.preventDefault();
        this.opts.onNavigate("/product/" + encodeURIComponent(p.handle));
      });
    }

    const wish = qs("[data-rail-wish]", this.buyEl);
    if (wish) {
      wish.addEventListener("click", () => {
        this.opts.onToggleWish(p);
      });
    }
  }

  applyMockup(file: File): void {
    if (this.focus < 0) {
      this.opts.onToast("Open a garment first, then drop the mockup");
      return;
    }
    if (!/image\/(png|webp)/.test(file.type || "")) {
      this.opts.onToast("Use a transparent PNG or WebP");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      this.opts.onToast("Keep the mockup under 8 MB");
      return;
    }

    const it = this.items[this.focus];
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      const old = this.overrides[it.product.handle];
      if (old) URL.revokeObjectURL(old);
      this.overrides[it.product.handle] = url;
      it.img.src = url;
      it.shadowImg.src = url;
      it.clothEl.classList.remove("is-masked");
      this.opts.onToast(it.label + " re-skinned — front only, for sizing");
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      this.opts.onToast("That file would not load");
    };
    probe.src = url;
  }

  targets(): void {
    const edge = this.puff * 0.86; // puff 100 ≈ 86° edge-on
    const focused = this.focus;
    const hover = this.hover;
    const centre = this.W / 2;
    const stageH = this.H;
    const swayAmp = this.flowOn && !this.reduce ? this.flow / 100 : 0;
    const t = this.time;

    this.items.forEach((it) => {
      const isF = focused === it.i;
      const isH = hover === it.i && focused < 0;

      if (focused > -1) {
        if (isF) {
          // pull it off the rail and size it to the stage. The 210px of
          // translateZ magnifies it again, so aim under half the height.
          const targetH = clamp(stageH * 0.42, 150, 400);
          it.tx = centre;
          it.ty = stageH * 0.015;
          it.tz = 210;
          it.try_ = 0;
          it.tsc = clamp(targetH / ((it.w || it.cloth) * (it.imgRatio || 0.95)), 1, 2.8);
          it.tblur = 0;
          it.top_ = 1;
        } else {
          it.tx = it.home || 0;
          it.ty = 0;
          it.tz = -140;
          it.try_ = edge;
          it.tsc = 0.92;
          it.tblur = 9;
          it.top_ = 0.34;
        }
      } else {
        it.tx = it.home || 0;
        it.ty = isH ? -6 : 0;
        it.tz = isH ? 120 : 0;
        it.try_ = isH ? 0 : edge;
        it.tsc = isH ? 1.08 : 1;
        it.tblur = 0;
        it.top_ = hover > -1 && !isH ? 0.6 : 1;
      }

      // fabric swing — a slow pendulum, each piece offset so the rail breathes
      it.trz = swayAmp ? Math.sin(t * 0.9 + it.phase) * 2.6 * swayAmp : 0;
      it.swayY = swayAmp ? Math.cos(t * 0.7 + it.phase) * 1.4 * swayAmp : 0;
    });
  }

  paint(): void {
    const k = this.reduce ? 1 : 0.14;

    this.targets();
    this.items.forEach((it) => {
      it.x = lerp(it.x, it.tx, k);
      it.y = lerp(it.y, it.ty + it.swayY, k);
      it.z = lerp(it.z, it.tz, k);
      it.ry = lerp(it.ry, it.try_, k);
      it.rz = lerp(it.rz, it.trz, k);
      it.sc = lerp(it.sc, it.tsc, k);
      it.blur = lerp(it.blur, it.tblur, k);
      it.op = lerp(it.op, it.top_, k);

      it.node.style.transform =
        "translate3d(" + it.x.toFixed(2) + "px," + it.y.toFixed(2) + "px," + it.z.toFixed(2) + "px)";
      it.body.style.transform =
        "rotateY(" + it.ry.toFixed(2) + "deg) rotateZ(" + it.rz.toFixed(2) + "deg) scale(" + it.sc.toFixed(3) + ")";
      it.body.style.filter = it.blur > 0.05 ? "blur(" + it.blur.toFixed(1) + "px)" : "none";
      it.body.style.opacity = it.op.toFixed(3);

      // the clickable plane has to grow with the garment, or an open piece
      // stops taking clicks anywhere but through its middle
      it.hit.style.transform = "scale(" + it.sc.toFixed(3) + ")";
    });

    // the rail itself leans toward the cursor
    this.tilt.x = lerp(this.tilt.x, this.tilt.tx, 0.06);
    this.tilt.y = lerp(this.tilt.y, this.tilt.ty, 0.06);
    this.track.style.transform =
      "rotateY(" + (this.tilt.x * 8.5).toFixed(2) + "deg) rotateX(" + (-this.tilt.y * 2.4).toFixed(2) + "deg)";

    // the open piece lights up brighter than its neighbours
    this.items.forEach((it) => {
      const on = this.focus === it.i || (this.hover === it.i && this.focus < 0);
      if (it._lit === on) return;
      it._lit = on;
      it.clothEl.style.filter = on
        ? "brightness(1.06) contrast(1.03) drop-shadow(0 22px 30px rgba(60, 45, 28, 0.30))"
        : "brightness(0.96) drop-shadow(0 14px 22px rgba(60, 45, 28, 0.18))";
    });
  }

  loop(): void {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.paint();
      this.raf = this.visible ? requestAnimationFrame(tick) : 0;
    };
    if (!this.raf) this.raf = requestAnimationFrame(tick);
  }

  /** The homepage rail sits far down the page — stop burning frames on it
   *  while it is scrolled out of sight. */
  watch(): void {
    if (!("IntersectionObserver" in window)) {
      this.visible = true;
      return;
    }
    this.visible = true;
    this.io = new IntersectionObserver(
      (entries) => {
        const onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen === this.visible) return;
        this.visible = onScreen;
        if (onScreen) {
          this.raf = 0;
          this.loop();
        } else if (this.raf) {
          cancelAnimationFrame(this.raf);
          this.raf = 0;
        }
      },
      { rootMargin: "200px 0px" }
    );
    this.io.observe(this.stage);
  }

  destroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.visible = false;
    if (this.io) {
      this.io.disconnect();
      this.io = null;
    }
    this._off.splice(0).forEach((off) => off());
    Object.keys(this.overrides).forEach((url) => URL.revokeObjectURL(url));
    this.overrides = {};
    this.host.innerHTML = "";
  }
}
