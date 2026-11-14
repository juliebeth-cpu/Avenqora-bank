import { useEffect } from "react";

/**
 * Injects a <meta name="robots" content="noindex,nofollow"> tag into the
 * document <head> while any portal admin page is mounted, preventing search
 * engines from indexing admin portal URLs.
 *
 * Used inside PortalLayout so every authenticated portal page gets the tag
 * automatically without needing to add it to each page individually.
 */
export function PortalNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    meta.setAttribute("data-portal-noindex", "true");
    document.head.appendChild(meta);
    return () => {
      // Remove on unmount (e.g. when user navigates away from the portal)
      const existing = document.head.querySelector('meta[data-portal-noindex="true"]');
      if (existing) document.head.removeChild(existing);
    };
  }, []);

  return null;
}
