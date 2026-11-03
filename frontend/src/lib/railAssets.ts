/* ZIQWEAR — which hanging asset each product uses on the 3D rail.
   Ported from assets/js/rail-assets.js. Anything not listed falls back to the
   product's first photo inside the house tee silhouette, so new pieces reach
   the rail on their own.

   The transparent cutouts live in the React app's public folder (copied, not
   moved, from the repo's assets/img/ziq and assets/img/rail). */

export interface RailAsset {
  /** url of a transparent garment cutout, resolved from the app root */
  src: string;
  /** short label shown on the control chip */
  label: string;
  /** natural cloth height in px (the rail clamps it to the stage width) */
  cloth: number;
}

export const RAIL_ASSETS: Record<string, RailAsset> = {
  "freedom-oversized-tee": { src: "/img/ziq/cut-freedom.png", label: "Freedom", cloth: 208 },
  "vanguard-oversized-tee": { src: "/img/ziq/cut-vanguard.png", label: "Vanguard", cloth: 208 },
  "sovereign-oversized-tee": { src: "/img/rail/g-sovereign.webp", label: "Sovereign", cloth: 208 },
  "diligence-oversized-tee": { src: "/img/rail/g-diligence.webp", label: "Diligence", cloth: 208 },
  "ziqwear-dark-design-tee": { src: "/img/ziq/cut-dark.png", label: "Dark", cloth: 196 },
  "foundation-compression-set": { src: "/img/rail/g-foundation.webp", label: "Foundation Set", cloth: 176 },
};
