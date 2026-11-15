/**
 * website-meta.ts
 * Dynamically updates the browser title, favicon, and social meta tags.
 */

const DEFAULT_TITLE = 'Avenqora Bank';
const DEFAULT_DESCRIPTION = 'Avenqora Bank — Secure. Reliable. Professional.';
const DEFAULT_FAVICON = '/favicon.svg';
let faviconRequestId = 0;

function resolveLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('/objects/')) {
    return `/api/public/logo-objects/${rawUrl.replace(/^\\/objects\\//, '')}`;
  }
  return rawUrl;
}

function letterFavicon(letter: string, color: string): string {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `<rect width="32" height="32" rx="8" fill="${color}"/>`,
    `<text x="16" y="22" text-anchor="middle" font-size="18" font-weight="bold" font-family="Arial,sans-serif" fill="#fff">${letter.toUpperCase()}</text>`,
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
  name: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  description?: string | null;
}

export function applyWebsiteMeta({ name, primaryColor, logoUrl, faviconUrl, description }: WebsiteMetaOptions) {
  const title = name || DEFAULT_TITLE;
  const desc = description || `${title} — Secure. Reliable. Professional.`;
  const fallback = letterFavicon(title.charAt(0) || 'A', primaryColor || '#D4AF37');
  document.title = title;

  const requestId = ++faviconRequestId;
  const preferredIcon = resolveLogoUrl(faviconUrl) ?? resolveLogoUrl(logoUrl);
  // Apply the actual configured brand logo immediately. Do not wait for an
  // Image() probe: data-URL logos are valid favicon sources too.
  setFaviconHref(preferredIcon || fallback);
  if (preferredIcon && !preferredIcon.startsWith('data:') && typeof Image !== 'undefined') {
    const probe = new Image();
    probe.onerror = () => {
      if (requestId === faviconRequestId) setFaviconHref(fallback);
    };
    probe.src = preferredIcon;
  }

  setMetaTag('description', desc);
  setMetaTag('og:title', title, true);
  setMetaTag('og:description', desc, true);
  setMetaTag('twitter:title', title);
  setMetaTag('twitter:description', desc);
}

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
