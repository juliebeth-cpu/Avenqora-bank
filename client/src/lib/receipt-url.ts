/**
 * Resolves a stored receipt URL into one that can be opened directly in the
 * browser.
 *
 * Private object paths are resolved through an authenticated, tenant-scoped
 * API endpoint. External URLs remain direct links.
 *
 * External URLs (https://…) are returned unchanged so that customers who
 * submitted a link instead of uploading a file still work.
 */
export function buildReceiptUrl(receiptUrl: string | null | undefined): string | null {
  if (!receiptUrl) return null;

  // External URL (https/http) — open directly
  if (/^https?:\/\//i.test(receiptUrl)) {
    return receiptUrl;
  }

  // Internal object-storage paths require an authenticated portal fetch.
  if (receiptUrl.startsWith("/")) {
    return `/api/website/receipt-file?path=${encodeURIComponent(receiptUrl)}`;
  }

  return receiptUrl;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href*="/api/website/receipt-file?path="]');
    if (!anchor) return;

    const link = new URL(anchor.href, window.location.origin);
    if (link.origin !== window.location.origin) return;
    event.preventDefault();
    const objectPath = link.searchParams.get("path");
    if (!objectPath) return;

    const popup = window.open("about:blank", "_blank");
    if (!popup) return;
    popup.opener = null;
    popup.document.body.textContent = "Opening private file…";

    const token = localStorage.getItem("danzy_portal_token");
    if (!token) {
      popup.document.body.textContent = "Your admin session has expired. Sign in again.";
      return;
    }

    void fetch(link.href, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok || typeof body.url !== "string") {
          throw new Error(body.error ?? "Unable to open private file");
        }
        popup.location.replace(body.url);
      })
      .catch((error: unknown) => {
        popup.document.body.textContent = error instanceof Error ? error.message : "Unable to open private file";
      });
  });
}
