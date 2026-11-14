import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicTemplateContent } from "@/workspace/api-client-react";
import { publicInfo, publicGetPromoVideo } from "@/lib/portal-api";
import { getTemplateConfig } from "@/lib/template-registry";
import GenericHome from "@/pages/public/generic-home";
import PublicTrackingPage from "@/pages/public/tracking";
import PublicBankingHomePage from "@/pages/public/banking-home";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";

type ParsedLiveChatScript = {
  src?: string;
  code?: string;
  async: boolean;
  defer: boolean;
  id?: string;
  crossOrigin?: string;
};

const LIVE_CHAT_PROVIDERS = [
  { name: "Smartsupp", pattern: /smartsuppchat\.com|smartsupp\.com|_smartsupp/i, hosts: ["smartsuppchat.com", "smartsupp.com"] },
  { name: "Tawk.to", pattern: /embed\.tawk\.to|Tawk_API/i, hosts: ["tawk.to"] },
  { name: "Crisp", pattern: /crisp\.chat|CRISP_WEBSITE_ID/i, hosts: ["crisp.chat"] },
  { name: "Intercom", pattern: /intercom\.io|intercomSettings/i, hosts: ["intercom.io", "intercomcdn.com", "intercomassets.com"] },
  { name: "Zendesk Chat", pattern: /zdassets\.com|zopim\.com|ze-snippet/i, hosts: ["zendesk.com", "zdassets.com", "zopim.com"] },
  { name: "LiveChat", pattern: /livechatinc\.com|__lc(?:\.license|\s*=)/i, hosts: ["livechatinc.com"] },
];

function liveChatProviderForHost(hostname: string) {
  return LIVE_CHAT_PROVIDERS.find(({ hosts }) =>
    hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );
}

function parseLiveChatEmbed(code: string): { provider?: string; scripts?: ParsedLiveChatScript[]; error?: string } {
  const trimmed = code.trim();
  if (!trimmed) return { error: "Embed code is empty." };
  if (trimmed.length > 10_000) return { error: "Embed code exceeds the 10,000 character limit." };
  if (/^\s*(?:https?:)?\/\/\S+\s*$/i.test(trimmed)) return { error: "Paste a complete provider script, not a URL by itself." };
  if (/\beval\s*\(|\bnew\s+Function\s*\(/i.test(trimmed)) return { error: "Code evaluation is not supported in live-chat embeds." };

  const source = trimmed.replace(/<!--[\s\S]*?-->/g, "");
  const openings = (source.match(/<script\b/gi) ?? []).length;
  const closings = (source.match(/<\/script\s*>/gi) ?? []).length;
  const matches = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  if (!openings || openings !== closings || matches.length !== openings) return { error: "Embed must contain complete, balanced script tags." };
  if (source.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "").trim()) {
    return { error: "Only complete script embed code is supported." };
  }

  const detected = LIVE_CHAT_PROVIDERS.filter(({ pattern }) => pattern.test(source));
  const names = [...new Set(detected.map(({ name }) => name))];
  if (names.length > 1) return { error: "Use one supported live-chat provider per embed." };
  let provider = names[0];
  const scripts: ParsedLiveChatScript[] = [];

  for (const match of matches) {
    const attributes = match[1] ?? "";
    const body = (match[2] ?? "").trim();
    const srcMatch = attributes.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const typeMatch = attributes.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const type = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? "").toLowerCase();
    if (type && !["text/javascript", "application/javascript", "module"].includes(type)) {
      return { error: "Only executable JavaScript script tags are supported." };
    }
    if (srcMatch) {
      const rawSrc = (srcMatch[1] ?? srcMatch[2] ?? srcMatch[3] ?? "").replace(/&amp;/g, "&");
      let url: URL;
      try { url = new URL(rawSrc); } catch { return { error: "External script URL is invalid." }; }
      if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
        return { error: "External scripts must use secure HTTPS URLs." };
      }
      const sourceProvider = liveChatProviderForHost(url.hostname);
      if (!sourceProvider) return { error: "External scripts must come from a supported live-chat provider." };
      if (provider && provider !== sourceProvider.name) return { error: "Script URL does not match the embed provider." };
      provider = sourceProvider.name;
      scripts.push({
        src: url.href,
        async: /\basync\b/i.test(attributes),
        defer: /\bdefer\b/i.test(attributes),
        id: attributes.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1],
        crossOrigin: attributes.match(/\bcrossorigin\s*=\s*["']([^"']*)["']/i)?.[1]
          ?? (/\bcrossorigin\b/i.test(attributes) ? "anonymous" : undefined),
      });
    } else if (body) {
      scripts.push({ code: body, async: false, defer: false });
      const normalizedBody = body.replace(/\\\//g, "/");
      for (const rawUrl of normalizedBody.match(/https?:\/\/[^\s"'`<>]+/gi) ?? []) {
        try {
          const url = new URL(rawUrl.replace(/[),;]+$/, ""));
          if (url.protocol !== "https:" || !liveChatProviderForHost(url.hostname)) {
            return { error: "Inline code references a script outside supported provider domains." };
          }
          const sourceProvider = liveChatProviderForHost(url.hostname)!;
          if (provider && provider !== sourceProvider.name) return { error: "Inline script URL does not match the embed provider." };
          provider = sourceProvider.name;
        } catch {
          return { error: "Inline code contains an invalid external URL." };
        }
      }
    } else {
      return { error: "Each script must contain code or a supported provider URL." };
    }
  }

  if (!provider) return { error: "This embed is not from a supported live-chat provider." };
  if (scripts.some((script) => script.code) && !LIVE_CHAT_PROVIDERS.some(({ name, pattern }) => name === provider && pattern.test(source))) {
    return { error: "Inline script does not match a supported live-chat provider." };
  }
  return { provider, scripts };
}

const injectedLiveChatSites = new Set<string>();

/**
 * SiteHomePage — Public website renderer.
 *
 * Loads the website's configuration from the public API and renders the
 * appropriate template.  Also manages the live-chat widget lifecycle:
 *
 *  1. Prevents duplicate injection (StrictMode / fast navigation safety).
 *  2. Handles ALL embed code patterns:
 *       • External <script src="…">  — the most common form (Tawk.to, Smartsupp…)
 *       • Inline <script>…</script>  — code pasted directly
 *       • Multiple <script> tags     — some providers output several
 *       • Raw JS (no <script> wrapper) — uncommon fallback
 *  3. Scripts load asynchronously and never block initial page rendering.
 *  4. Reports loading success/failure back to the admin portal via the public
 *     API — powers the "Accepted and Connected" / "Failed to Load" status badges
 *     in the website admin dashboard.
 *  5. Errors in a single widget script cannot propagate and break the page.
 *  6. All injected elements are cleaned up on component unmount.
 *
 * SECURITY: Scripts are ONLY injected here, on the public customer-facing page.
 * They are NEVER injected in the admin portal, authentication pages, or any
 * other admin surface.
 */
export default function SiteHomePage({ params }: { params: { websiteUid: string } }) {
  const websiteUid = params?.websiteUid;
  const { data: site, isLoading } = useQuery({
    queryKey: ["public-site", websiteUid],
    queryFn:  () => publicInfo(websiteUid),
    retry: false,
  });
  const { data: promoVideo } = useQuery({
    queryKey: ["public-promo-video", websiteUid],
    queryFn:  () => publicGetPromoVideo(websiteUid),
    enabled:  !!websiteUid,
  });
  const { data: homepageContent } = useQuery({
    queryKey: ["public-homepage-content", websiteUid],
    queryFn: () => getPublicTemplateContent(websiteUid),
    enabled: !!websiteUid,
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    const raw     = (site as any)?.liveChatCode    as string | null | undefined;
    const enabled = (site as any)?.liveChatEnabled as boolean | undefined;
    const siteId  = (site as any)?.websiteUid      as string | undefined;
    if (!raw?.trim() || enabled === false || !siteId) return;
    if (injectedLiveChatSites.has(siteId)) return;
    const apiBase = (import.meta as any).env?.VITE_API_BASE ?? "";
    const statusUrl = `${apiBase}/api/public/websites/${siteId}/live-chat-status`;
    let statusReported = false;
    let pendingScripts = 0;
    let loadedScripts = 0;
    let settledTimer: ReturnType<typeof setTimeout> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const externalScripts = new WeakSet<HTMLScriptElement>();
    const trackedUrls = new Set<string>();
    let injectingInline = false;
    let cleanupWatchers = () => {};

    const reportStatus = (status: "loaded" | "failed", error?: string) => {
      if (statusReported) return;
      statusReported = true;
      if (settledTimer) clearTimeout(settledTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      cleanupWatchers();
      fetch(statusUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, error: error ?? null }),
      }).catch((err) => console.warn("[live-chat] Status report failed:", err));
    };

    const parsed = parseLiveChatEmbed(raw);
    if (parsed.error || !parsed.scripts?.length || !parsed.provider) {
      reportStatus("failed", parsed.error ?? "No valid provider script was found.");
      return;
    }
    if (document.querySelector('script[data-live-chat-widget="1"]')) {
      injectedLiveChatSites.add(siteId);
      return;
    }
    injectedLiveChatSites.add(siteId);

    const scheduleSuccess = () => {
      if (settledTimer) clearTimeout(settledTimer);
      if (pendingScripts === 0) {
        settledTimer = setTimeout(() => reportStatus("loaded"), 1200);
      }
    };
    const trackExternalScript = (script: HTMLScriptElement) => {
      if (externalScripts.has(script) || !script.src) return;
      externalScripts.add(script);
      let url: URL;
      try {
        url = new URL(script.src, window.location.href);
      } catch {
        script.remove();
        reportStatus("failed", "A script attempted to load from an invalid URL.");
        return;
      }
      const hostProvider = liveChatProviderForHost(url.hostname);
      if (url.protocol !== "https:" || hostProvider?.name !== parsed.provider) {
        script.remove();
        reportStatus("failed", "A script attempted to load from an unsupported provider domain.");
        return;
      }
      script.dataset.liveChatWidget = "1";
      script.dataset.liveChatSite = siteId;
      trackedUrls.add(url.href);
      pendingScripts++;
      if (settledTimer) clearTimeout(settledTimer);
      script.addEventListener("load", () => {
        pendingScripts = Math.max(0, pendingScripts - 1);
        loadedScripts++;
        scheduleSuccess();
      }, { once: true });
      script.addEventListener("error", () => {
        pendingScripts = Math.max(0, pendingScripts - 1);
        reportStatus("failed", `Provider script failed to load: ${url.hostname}`);
      }, { once: true });
    };

    const onRuntimeError = (event: ErrorEvent) => {
      if (injectingInline || (event.filename && trackedUrls.has(event.filename))) {
        console.warn("[live-chat] Embed script error:", event.message || event.filename);
        reportStatus("failed", "The live-chat embed raised a script error.");
      }
    };
    window.addEventListener("error", onRuntimeError, true);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLScriptElement) trackExternalScript(node);
          else if (node instanceof Element) node.querySelectorAll("script[src]").forEach((script) => trackExternalScript(script as HTMLScriptElement));
        });
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    cleanupWatchers = () => {
      observer.disconnect();
      window.removeEventListener("error", onRuntimeError, true);
    };

    timeoutTimer = setTimeout(() => {
      if (!statusReported) reportStatus("failed", "Provider scripts did not finish loading before timeout.");
    }, 20_000);

    try {
      for (const item of parsed.scripts) {
        const element = document.createElement("script");
        element.dataset.liveChatWidget = "1";
        element.dataset.liveChatSite = siteId;
        if (item.id) element.id = item.id;
        if (item.crossOrigin) element.crossOrigin = item.crossOrigin;
        element.async = item.async;
        element.defer = item.defer;
        if (item.src) {
          element.src = item.src;
          trackExternalScript(element);
        } else {
          element.text = item.code ?? "";
          injectingInline = true;
          document.body.appendChild(element);
          injectingInline = false;
          continue;
        }
        document.body.appendChild(element);
      }
      if (pendingScripts === 0 && loadedScripts === 0) scheduleSuccess();
    } catch (error) {
      console.warn("[live-chat] Embed injection failed:", error);
      reportStatus("failed", "The live-chat embed could not be initialized.");
    }

  }, [(site as any)?.liveChatCode, (site as any)?.liveChatEnabled, (site as any)?.websiteUid]);

  const cfg     = getTemplateConfig((site as any)?.type, (site as any)?.capabilities);
  const primary = (site as any)?.primaryColor ?? "#2563eb";

  if (!site) {
    if (isLoading) {
      return <CustomerBrandLoader websiteUid={websiteUid} fullScreen label="Loading site" />;
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">This website link is invalid or has been removed.</p>
      </div>
    );
  }

  if ((site as any)?.type === "tracking" || (site as any)?.type === "logistics") {
    return <PublicTrackingPage params={params} promoVideo={(promoVideo as any) ?? null} />;
  }

  const loginHref    = buildLoginHref((site as any)?.type, websiteUid);
  const registerHref = buildRegisterHref((site as any)?.type, websiteUid);

  if ((site as any)?.type === "banking") {
    return (
      <PublicBankingHomePage
        websiteUid={websiteUid}
        siteName={(site as any)?.name ?? cfg.label}
        primary={primary}
        logoUrl={(site as any)?.logoUrl ?? null}
        loginHref={loginHref}
        registerHref={registerHref}
        companyInfo={site}
        promoVideo={(promoVideo as any) ?? null}
        templateContent={homepageContent?.content}
      />
    );
  }

  return (
    <GenericHome
      siteName={(site as any)?.name ?? cfg.label}
      primary={primary}
      cfg={cfg}
      websiteUid={websiteUid}
      loginHref={loginHref}
      registerHref={registerHref}
      companyInfo={site}
      promoVideo={(promoVideo as any) ?? null}
      templateContent={homepageContent?.content}
    />
  );
}

function buildLoginHref(type: string | undefined, uid: string): string {
  switch (type) {
    case "banking":
      return `/banking/${uid}/login`;
    case "investment":
      return `/invest/${uid}/login`;
    case "forex":
      return `/forex/${uid}/login`;
    case "crypto":
      return `/crypto/${uid}/login`;
    case "tracking":
      return `/tracking/${uid}/login`;
    default:
      return `/app/${uid}/login?websiteType=${encodeURIComponent(type ?? "")}`;
  }
}

function buildRegisterHref(type: string | undefined, uid: string): string {
  switch (type) {
    case "banking":
      return `/banking/${uid}/register`;
    case "investment":
      return `/invest/${uid}/register`;
    case "forex":
      return `/forex/${uid}/register`;
    case "crypto":
      return `/crypto/${uid}/register`;
    case "tracking":
      return `/tracking/${uid}/register`;
    default:
      return `/app/${uid}/register?websiteType=${encodeURIComponent(type ?? "")}`;
  }
}
