import { useEffect } from 'react';

export interface PageMeta {
  title?: string;
  description?: string;
  /** Absolute or root-relative; root-relative is resolved against this origin. */
  image?: string;
  /** Defaults to the current URL, which is what a SPA should canonicalise to. */
  url?: string;
  noIndex?: boolean;
}

const SITE_SUFFIX = 'ZIQWEAR';

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

function absolute(url: string): string {
  if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url;
  return new URL(url, window.location.origin).toString();
}

/**
 * Sets document title, description, canonical and the social card for the
 * current view.
 *
 * A crawler never runs the React bundle, but link previews do read og tags from
 * the served HTML — and the storefront shell is a single index.html for every
 * route, so without this every product share on WhatsApp or Instagram renders
 * the same generic card pointing at the homepage.
 */
export function usePageMeta(meta: PageMeta | null) {
  useEffect(() => {
    if (!meta) return;

    const url = absolute(meta.url ?? window.location.pathname + window.location.search);
    const description = (meta.description ?? '').trim();

    document.title = meta.title
      ? `${meta.title} | ${SITE_SUFFIX}`
      : `${SITE_SUFFIX} — Zenith In Quality Wear`;

    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertLink('canonical', url);

    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_SUFFIX);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', document.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);

    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', document.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    if (meta.image) {
      const image = absolute(meta.image);
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    }

    if (meta.noIndex) {
      upsertMeta('meta[name="robots"]', 'name', 'robots', 'noindex, nofollow');
    } else {
      const robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
      if (robots) robots.setAttribute('content', 'index, follow');
    }
    // The effect intentionally re-runs only when the page identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta?.title, meta?.description, meta?.image, meta?.url, meta?.noIndex]);
}
