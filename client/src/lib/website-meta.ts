/**
 * website-meta.ts
 *
 * Dynamically update browser title, favicon, and social meta tags to reflect
 * the tenant website currently being displayed on a custom domain (or in the
 * Replit preview at /site/:websiteUid).
 *
 * Call applyWebsiteMeta() when site data is known, resetWebsiteMeta() on unmount.
 */

const DEFAULT_TITLE = 'Avenqora Bank';
const DEFAULT_DESCRIPTION = 'Avenqora Bank — Secure. Reliable. Professional.';
const DEFAULT_FAVICON = '/favicon.svg';
let faviconRequestId = 0;

/**
 * Convert a raw object-storage path (/objects/uploads/<uuid>) to the public
 * logo-serve URL. Mirrors buildLogoUrl in generic-home.tsx.
 * External https:// URLs are returned unchanged.
 */
function resolveLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('/objects/')) {
    return `/api/public/logo-objects/${rawUrl.replace(/^\/objects\//, '')}`;
  }
  return rawUrl;
}

/**
 * Generate an inline SVG favicon (letter badge) when no logo is available.
 * Returns a data: URI safe for <link rel="icon" href="...">.
 */
function letterFavicon(letter: string, color: string): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `<rect width="32" height="32" rx="8" fill="${color}"/>`,
    `<text x="16" y="22" text-anchor="middle" font-size="18" font-weight="bold" `,
    `font-family="Inter,Arial,sans-serif" fill="#fff">${letter.toUpperCase()}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function setMetaTag(nameOrProp: string, content: string, useProperty = false) {
  const attr = useProperty ? 'property' : 'name';
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${nameOrProp}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, nameOrProp);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setFaviconHref(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

export interface WebsiteMetaOptions {
  /** Display name of the website (e.g. "BlackRock Investment Inc") */
  name: string;
  /** Brand primary colour hex (e.g. "#1a3c6e") — used for the letter-badge favicon */
  primaryColor?: string | null;
  /** Raw object-storage path or external URL for the logo image */
  logoUrl?: string | null;
  /** Published favicon URL. The website logo is used if this is not configured. */
  faviconUrl?: string | null;
  /** Optional short description for meta/OG/Twitter tags */
  description?: string | null;
}

/**
 * Apply tenant-specific title, favicon, and social meta tags.
 * Safe to call multiple times — later calls overwrite earlier ones.
 */
export function applyWebsiteMeta({ name, primaryColor, logoUrl, faviconUrl, description }: WebsiteMetaOptions) {
  const title = name || DEFAULT_TITLE;
  const desc = description || `${title} — Secure. Reliable. Professional.`;
  const color = primaryColor || '#2563eb';

  // Browser tab / bookmark title
  document.title = title;

  // Keep a no-cost, self-contained favicon visible while testing the configured
  // favicon/logo. If that URL is missing or fails, the generated SVG remains.
  const fallback = letterFavicon(title.charAt(0), color);
  const requestId = ++faviconRequestId;
  setFaviconHref(fallback);
  const preferredIcon = resolveLogoUrl(faviconUrl) ?? resolveLogoUrl(logoUrl);
  if (preferredIcon && typeof Image !== 'undefined') {
    const probe = new Image();
    probe.onload = () => {
      if (requestId === faviconRequestId) setFaviconHref(preferredIcon);
    };
    probe.onerror = () => {
      if (requestId === faviconRequestId) setFaviconHref(fallback);
    };
    probe.src = preferredIcon;
  }

  // Standard meta description
  setMetaTag('description', desc);

  // Open Graph
  setMetaTag('og:title', title, true);
  setMetaTag('og:description', desc, true);

  // Twitter card
  setMetaTag('twitter:title', title);
  setMetaTag('twitter:description', desc);
}

/**
 * Reset all document meta back to Danzy GLE defaults.
 * Call on component unmount so the master-admin interface
 * gets the correct title when navigating back.
 */
export function resetWebsiteMeta() {
  faviconRequestId++;
  document.title = DEFAULT_TITLE;
  setFaviconHref(DEFAULT_FAVICON);
  setMetaTag('description', DEFAULT_DESCRIPTION);
  setMetaTag('og:title', DEFAULT_TITLE, true);
  setMetaTag('og:description', DEFAULT_DESCRIPTION, true);
  setMetaTag('twitter:title', DEFAULT_TITLE);
  setMetaTag('twitter:description', DEFAULT_DESCRIPTION);
}
