/**
 * PremiumPublicHomePage — Shared premium landing page for ALL non-bespoke website types.
 *
 * Sections: Hero Slideshow · Stats · About · Services · Why Choose Us · Security ·
 *           How It Works · Testimonials · FAQ · Latest News · Contact · Footer
 *
 * Content adapts dynamically via TemplateConfig so every generated site inherits
 * all protected sections automatically.
 */

import { useState, useRef } from "react";
import { Link } from "wouter";
import {
  Shield, Zap, Globe, Smartphone, Headphones, CheckCircle2,
  Lock, Eye, AlertTriangle, ChevronDown, ChevronUp, ArrowRight,
  Star, TrendingUp, Building2, Send, Facebook, Instagram,
  Twitter, Linkedin, Youtube, Phone, Mail, MapPin, MessageCircle,
  Award, Users, BadgeCheck,
  Package, Search, Loader2, XCircle, Plane, Clock, VolumeX, Volume2,
} from "lucide-react";

/**
 * Convert a raw object-storage path (e.g. /objects/uploads/<uuid>) to the
 * public logo-serve URL. External URLs (https://…) are returned unchanged.
 */
function buildLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("/objects/")) {
    return `/api/public/logo-objects/${rawUrl.replace(/^\/objects\//, "")}`;
  }
  return rawUrl;
}
import AssetSlideshow from "@/components/AssetSlideshow";
import type { TemplateConfig } from "@/lib/template-registry";
import TypeSpecificSections from "@/pages/public/type-sections";
import { PublicSiteFooter } from "@/pages/public/site-info";
import { publicTrack } from "@/lib/portal-api";
import WebsiteLogo from "@/components/website-logo";
import type { OwnerTemplateContent } from "@/workspace/api-client-react";
import {
  GENERIC_SERVICES_COPY,
  GENERIC_FAQ_COPY,
  GENERIC_HOW_IT_WORKS_COPY,
  WHY_CHOOSE_US_COPY,
  resolveHomepageCopy,
} from "@/pages/public/homepage-copy";

// ─── Immediate section wrapper ────────────────────────────────────────────────
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// ─── Collapsible FAQ item ─────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] transition-colors"
      >
        <span className="font-medium text-slate-100">{q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed">{a}</div>}
    </div>
  );
}

// ─── Build type-specific content ──────────────────────────────────────────────
function buildContent(cfg: TemplateConfig, templateContent?: OwnerTemplateContent) {
  const icons = [Building2, Send, TrendingUp, Shield, Globe, Smartphone, Headphones, Zap];
  const servicesDefaults = {
    ...GENERIC_SERVICES_COPY,
    items: cfg.features.map((title) => ({
      title,
      body: `Explore ${title.toLowerCase()} options on this website. Your account portal shows which actions are available for your account.`,
    })),
  };
  const servicesSection = resolveHomepageCopy(templateContent?.services, servicesDefaults);
  const services = servicesSection.items.map((item, index) => ({
    ...item,
    icon: icons[index % icons.length],
  }));
  const whyUsSection = resolveHomepageCopy(templateContent?.whyUs, WHY_CHOOSE_US_COPY);
  const whyUsIcons = [CheckCircle2, BadgeCheck, Headphones, Shield];
  const whyUs = whyUsSection.items.map((item, index) => ({
    ...item,
    icon: whyUsIcons[index % whyUsIcons.length],
  }));
  const howItWorksSection = resolveHomepageCopy(templateContent?.howItWorks, GENERIC_HOW_IT_WORKS_COPY);
  const howItWorks = howItWorksSection.items.map((item, index) => [
    String(index + 1).padStart(2, "0"),
    item.title,
    item.body,
  ] as [string, string, string]);
  const faqSection = {
    heading: typeof templateContent?.faq?.heading === "string" && templateContent.faq.heading.trim()
      ? templateContent.faq.heading.trim()
      : GENERIC_FAQ_COPY.heading,
    items: (() => {
      const supplied = (templateContent?.faq?.items ?? []).filter(
        (item) => Boolean(item.question?.trim() || item.answer?.trim()),
      );
      return (supplied.length ? supplied : GENERIC_FAQ_COPY.items).map((item, index) => ({
        question: item.question?.trim() || GENERIC_FAQ_COPY.items[index]?.question || "Question",
        answer: item.answer?.trim() || GENERIC_FAQ_COPY.items[index]?.answer || GENERIC_FAQ_COPY.items[0].answer,
      }));
    })(),
  };
  const testimonialsSection = {
    heading: templateContent?.testimonials?.heading?.trim() || "Customer Testimonials",
    items: (templateContent?.testimonials?.items ?? [])
      .filter((item) => Boolean(item.name?.trim() && item.body?.trim()))
      .map((item) => ({
        name: item.name.trim(),
        role: item.role.trim(),
        body: item.body.trim(),
        rating: Math.max(1, Math.min(5, Math.floor(item.rating))),
      })),
  };
  const newsSection = {
    heading: templateContent?.news?.heading?.trim() || "Latest News",
    items: (templateContent?.news?.items ?? [])
      .filter((item) => Boolean(item.title?.trim() && item.body?.trim()))
      .map((item) => ({
        category: item.category.trim() || "Update",
        title: item.title.trim(),
        body: item.body.trim(),
      })),
  };

  return {
    services,
    servicesSection,
    whyUs,
    whyUsSection,
    howItWorks,
    howItWorksSection,
    faqSection,
    testimonialsSection,
    newsSection,
  };
}

// ─── Hero Tracking Widget (tracking/logistics types only) ─────────────────────
/**
 * HeroTrackingWidget — Prominent above-the-fold tracking form for
 * Tracking and Logistics websites. Visitors immediately see the input and
 * can track any shipment WITHOUT registering or scrolling.
 *
 * PERMANENT: Must never be removed or hidden.
 */
function HeroTrackingWidget({ primary, websiteUid }: { primary: string; websiteUid: string }) {
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");

  const handleTrack = async () => {
    const tn = trackInput.trim();
    if (!tn || trackLoading) return;
    setTrackLoading(true);
    setTrackError("");
    setTrackResult(null);
    try {
      const result = await publicTrack(websiteUid, tn);
      // Auto-navigate to the full tracking page immediately on success
      if (result?.shipment?.trackingNumber) {
        window.location.href = `/track/${websiteUid}?t=${encodeURIComponent(result.shipment.trackingNumber)}`;
        return;
      }
      setTrackResult(result);
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) setTrackError("Tracking number not found. Please check and try again.");
      else if (status === 403) setTrackError("This website is not currently active.");
      else setTrackError("Unable to retrieve tracking information. Please try again.");
    } finally {
      setTrackLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-sm p-6 shadow-2xl w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/[0.08]">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: primary + "25" }}>
          <Package className="w-5 h-5" style={{ color: primary }} />
        </div>
        <div>
          <p className="font-bold text-white text-base leading-tight">Track Your Shipment</p>
          <p className="text-xs text-slate-400 mt-0.5">Real-time worldwide tracking</p>
        </div>
      </div>

      {/* Input + Button */}
      <div className="space-y-3 mb-4">
        <input
          type="text"
          value={trackInput}
          onChange={e => setTrackInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleTrack()}
          placeholder="Enter Tracking Number"
          className="w-full px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/15 text-white text-sm outline-none focus:border-white/35 focus:bg-white/[0.09] placeholder:text-slate-500 font-mono transition-all"
        />
        <button
          onClick={handleTrack}
          disabled={trackLoading || !trackInput.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          style={{ backgroundColor: primary }}>
          {trackLoading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
            : <><Search className="w-4 h-4" /> Track Shipment</>}
        </button>
      </div>

      {/* Error */}
      {trackError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-red-400 text-sm mb-3">
          <XCircle className="w-4 h-4 shrink-0" />{trackError}
        </div>
      )}

      {/* Result — compact summary */}
      {trackResult && !trackError && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: "#0a1628", borderColor: primary + "30" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-0.5">Tracking Number</p>
              <p className="text-white font-bold font-mono text-sm">{trackResult.shipment?.trackingNumber}</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "#22c55e20", color: "#22c55e" }}>
              {trackResult.shipment?.status}
            </span>
          </div>
          {/* Origin → Destination */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <p className="text-slate-500 mb-0.5">From</p>
              <p className="text-white font-medium truncate">
                {[trackResult.shipment?.originCity, trackResult.shipment?.originCountry].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
            <Plane className="w-4 h-4 shrink-0" style={{ color: primary }} />
            <div className="flex-1 min-w-0 text-right">
              <p className="text-slate-500 mb-0.5">To</p>
              <p className="text-white font-medium truncate">
                {[trackResult.shipment?.destinationCity, trackResult.shipment?.destinationCountry].filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          </div>
          {trackResult.shipment?.estimatedDelivery && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1 border-t" style={{ borderColor: primary + "18" }}>
              <Clock className="w-3 h-3" style={{ color: primary }} />
              ETA: <span className="text-white font-semibold ml-0.5">
                {new Date(trackResult.shipment.estimatedDelivery).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          )}
          <a
            href={`/track/${websiteUid}?t=${encodeURIComponent(trackResult.shipment?.trackingNumber ?? "")}`}
            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold border transition-all hover:opacity-80"
            style={{ borderColor: primary + "40", color: primary, background: primary + "10" }}>
            View Full Tracking & Live Map →
          </a>
        </div>
      )}

      {/* Idle state */}
      {!trackResult && !trackError && !trackLoading && (
        <div className="text-center py-2">
          <p className="text-xs text-slate-500">Press Enter or click <strong className="text-slate-400">Track Shipment</strong></p>
        </div>
      )}

      {/* Trust badges */}
      <div className="mt-5 pt-4 border-t border-white/[0.06] flex justify-around text-xs text-slate-500">
        {[["🌍", "190+ Countries"], ["📡", "Live Updates"], ["🔒", "Secure"]].map(([icon, label]) => (
          <div key={label as string} className="flex items-center gap-1">
            <span>{icon}</span><span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Company info shape (populated from the DB via publicInfo) ────────────────
interface CompanyInfo {
  type?: string | null;
  logoUrl?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  ceoName?: string | null;
  launchDate?: string | null;
  businessDescription?: string | null;
  officeLocation?: string | null;
  createdAt?: string | Date | null;
  liveChatCode?: string | null;
  liveChatEnabled?: boolean;
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialLinkedin?: string | null;
  socialYoutube?: string | null;
}

// ─── Promotional video shape ──────────────────────────────────────────────────
export interface PromoVideo {
  fileName: string;
  contentType: string;
  autoplay: boolean;
  loop: boolean;
  muted: boolean;
  placement: "hero" | "about" | "featured";
  viewURL: string | null;
}

// ─── Promotional video embed component ───────────────────────────────────────
export function PromoVideoEmbed({ video, primary, className = "" }: { video: PromoVideo; primary: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Start muted so autoplay is allowed by all browsers; user can unmute via button
  const [muted, setMuted] = useState(true);

  if (!video.viewURL) return null;

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl ${className}`}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        key={video.viewURL}
        src={video.viewURL}
        autoPlay={video.autoplay}
        loop={video.loop}
        muted={muted}
        playsInline
        controls={!video.autoplay}
        preload={video.autoplay ? "auto" : "metadata"}
        className="w-full h-full object-cover"
        style={{ maxHeight: "480px" }}
      />
      {/* Mute / Unmute button — works on all devices including mobile */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/40"
        style={{ background: "rgba(0,0,0,0.60)" }}
      >
        {muted
          ? <VolumeX className="w-4 h-4" />
          : <Volume2 className="w-4 h-4" />
        }
      </button>
      {/* Subtle branded border glow */}
      <div className="absolute inset-0 rounded-2xl ring-1 ring-inset pointer-events-none" style={{ boxShadow: `inset 0 0 0 1px ${primary}30` }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  siteName: string;
  primary: string;
  loginHref: string;
  registerHref: string;
  cfg: TemplateConfig;
  websiteUid?: string;
  /** Dynamic company information — replaces all placeholder/hardcoded values */
  companyInfo?: CompanyInfo;
  /** Promotional video (fetched via public API, null if none) */
  promoVideo?: PromoVideo | null;
  /** Owner-edited homepage copy; defaults remain visible when unset or blank. */
  templateContent?: OwnerTemplateContent;
}

export default function PublicGenericHomePage({ siteName, primary, loginHref, registerHref, cfg, websiteUid = "", companyInfo, promoVideo, templateContent }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const secondaryBg = primary + "18";
  const content = buildContent(cfg, templateContent);
  const heroHeading = templateContent?.hero?.heading?.trim() || siteName;
  const heroDescription = templateContent?.hero?.description?.trim()
    || companyInfo?.businessDescription?.trim()
    || `Explore the services and account tools available through ${siteName}.`;
  const heroActionLabel = templateContent?.hero?.actionLabel?.trim() || cfg.actionLabel;
  const aboutHeading = templateContent?.about?.heading?.trim() || "About Us";
  const aboutDescription = templateContent?.about?.description?.trim()
    || companyInfo?.businessDescription?.trim()
    || `${siteName} provides a customer portal for the services and account options available on this website.`;
  const securityHeading = templateContent?.security?.heading?.trim() || "Security Information";
  const securityDescription = templateContent?.security?.description?.trim()
    || "Review the account guidance and service requirements published on this website. Your customer portal shows the options and requests available for your account.";
  const contactHeading = templateContent?.contact?.heading?.trim() || `Contact ${siteName}`;
  const contactDescription = templateContent?.contact?.description?.trim()
    || "Use the support details published here if you have a question about this website or your account.";

  // ── Dynamic company info helpers ────────────────────────────────────────────
  // These are used throughout the page so no placeholder ever appears when data
  // is set. Fallbacks only appear if the website admin hasn't filled in a field.
  const displayEmail = companyInfo?.supportEmail || companyInfo?.companyEmail || "";
  const displayPhone = companyInfo?.supportPhone || companyInfo?.companyPhone || "";
  const displayAddress = companyInfo?.officeLocation || companyInfo?.companyAddress || "";
  const contactDetails = [
    { icon: Mail, title: "Email", detail: displayEmail },
    { icon: Phone, title: "Phone", detail: displayPhone },
    { icon: MapPin, title: "Office", detail: displayAddress },
    { icon: MessageCircle, title: "Live Chat", detail: companyInfo?.liveChatEnabled && companyInfo.liveChatCode ? "Available" : "" },
  ].filter(({ detail }) => Boolean(detail));
  const socialLinks = [
    { Icon: Facebook,  url: companyInfo?.socialFacebook ?? null },
    { Icon: Instagram, url: companyInfo?.socialInstagram ?? null },
    { Icon: Twitter,   url: companyInfo?.socialTwitter ?? null },
    { Icon: Linkedin,  url: companyInfo?.socialLinkedin ?? null },
    { Icon: Youtube,   url: companyInfo?.socialYoutube ?? null },
  ].filter(({ url }) => Boolean(url));

  /** True for Tracking and Logistics websites — activates logistics-specific hero and imagery */
  const isLogistics = cfg.type === "tracking" || cfg.type === "logistics";
  const heroSignals: string[] = [];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const navIds = ["about", "services", "security", "how-it-works", "faq", "news", "contact"];

  return (
    <div className="min-h-screen bg-[#06090f] text-white scroll-smooth">

      {/* ── Sticky Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#06090f]/90 backdrop-blur-lg border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {companyInfo?.logoUrl
              ? companyInfo.type === "tracking"
                ? <img src={buildLogoUrl(companyInfo.logoUrl) ?? ""} alt={siteName} className="w-9 h-9 rounded-xl object-contain" style={{ background: primary + "22" }} />
                : <WebsiteLogo src={buildLogoUrl(companyInfo.logoUrl) ?? ""} alt={siteName} size={36} style={{ background: primary + "22" }} />
              : <div className={`w-9 h-9 ${companyInfo?.type === "tracking" ? "rounded-xl" : "rounded-full"} flex items-center justify-center font-bold text-white text-base shadow-lg`} style={{ backgroundColor: primary }}>{siteName.charAt(0)}</div>
            }
            <span className="font-bold text-lg tracking-tight">{siteName}</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-5 text-sm text-slate-400">
            {navIds.map(id => (
              <button key={id} onClick={() => scrollTo(id)} className="hover:text-white capitalize transition-colors">{id.replace(/-/g, " ")}</button>
            ))}
          </nav>

          {/* CTAs */}
          <div className="flex items-center gap-2">
            <Link href={loginHref} className="hidden sm:inline-flex text-sm px-4 py-2 rounded-lg border border-white/15 hover:bg-white/5 transition-colors font-medium">Sign In</Link>
            <Link href={registerHref} className="inline-flex text-sm px-4 py-2 rounded-lg font-semibold transition-all hover:opacity-90 shadow-lg" style={{ backgroundColor: primary }}>
              {cfg.actionLabel}
            </Link>
            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 ml-1 text-slate-400 hover:text-white">
              <div className="w-5 h-0.5 bg-current mb-1" />
              <div className="w-5 h-0.5 bg-current mb-1" />
              <div className="w-5 h-0.5 bg-current" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#06090f] px-4 py-3 flex flex-col gap-3 text-sm text-slate-300">
            {navIds.map(id => (
              <button key={id} onClick={() => scrollTo(id)} className="text-left hover:text-white capitalize py-1">{id.replace(/-/g, " ")}</button>
            ))}
          </div>
        )}
      </header>

      {/* ── Hero Slideshow ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center bg-[#050b16]">
        {/* Slideshow background — logistics types use cargo/freight imagery; others use standard imagery */}
        <div className="absolute inset-0 pointer-events-none">
          <AssetSlideshow
            className="absolute inset-0 h-full w-full"
            intervalMs={4300}
            overlay="linear-gradient(135deg, rgba(6,9,15,0.88), rgba(6,9,15,0.44) 52%, rgba(6,9,15,0.82))"
            label={`${siteName} homepage hero`}
            variant={isLogistics ? "logistics" : "investment"}
            priority
          />
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl" style={{ backgroundColor: primary }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl" style={{ backgroundColor: primary }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#06090f]/50 to-[#06090f]" />
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `linear-gradient(${primary}16 1px, transparent 1px), linear-gradient(90deg, ${primary}16 1px, transparent 1px)`,
              backgroundSize: "56px 56px",
              maskImage: "linear-gradient(to bottom, black, transparent 78%)",
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-32 flex flex-col lg:flex-row items-center gap-14">
          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 border shadow-lg shadow-black/20" style={{ backgroundColor: secondaryBg, borderColor: primary + "40", color: primary }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: primary }} />
              {siteName}
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              {heroHeading}<br />
              <span style={{ color: primary }}>{isLogistics ? "Track Your Shipment" : cfg.label}</span>
            </h1>
            {heroDescription && (
              <p className="text-lg text-slate-300 max-w-xl mb-10 leading-relaxed mx-auto lg:mx-0">
                {isLogistics && !templateContent?.hero?.description?.trim()
                  ? "Enter your tracking number to view shipment details."
                  : heroDescription}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {isLogistics ? (
                <button
                  onClick={() => scrollTo("shipment-tracking")}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] shadow-2xl"
                  style={{ backgroundColor: primary }}>
                  <Package className="w-5 h-5" /> Track a Shipment
                </button>
              ) : (
                <Link href={registerHref} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] shadow-2xl" style={{ backgroundColor: primary }}>
                  {heroActionLabel} <ArrowRight className="w-5 h-5" />
                </Link>
              )}
              <button onClick={() => scrollTo("about")} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/20 hover:bg-white/5 transition-colors">
                Learn More
              </button>
            </div>
            {/* Platform signals */}
            <div className="mt-10 flex flex-wrap gap-2 justify-center lg:justify-start">
              {heroSignals.length > 0 && heroSignals.map((label) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: primary }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right panel:
              - Tracking/Logistics: prominent HeroTrackingWidget (above-the-fold form — PERMANENT)
              - Hero video placement: show promo video instead of feature card
              - All other types: standard feature card */}
          <div className="flex-1 max-w-sm w-full lg:max-w-md">
            {isLogistics ? (
              <HeroTrackingWidget primary={primary} websiteUid={websiteUid} />
            ) : promoVideo?.placement === "hero" ? (
              <PromoVideoEmbed video={promoVideo} primary={primary} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-2xl">
                <AssetSlideshow className="mb-5 h-36 rounded-xl" intervalMs={5100} overlay={`linear-gradient(135deg, ${primary}88, rgba(6,9,15,0.45))`} label={`${siteName} overview`} />
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">{cfg.label}</p>
                    <p className="text-lg font-bold">{siteName}</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: secondaryBg }}>
                    {cfg.emoji}
                  </div>
                </div>
                <div className="space-y-2.5 mb-5">
                  {cfg.features.slice(0, 3).map(f => (
                    <div key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: primary }} />
                      {f}
                    </div>
                  ))}
                </div>
                <Link href={registerHref} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ backgroundColor: primary }}>
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Platform highlights ────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {cfg.features.slice(0, 3).map((feature, index) => (
            <div key={feature} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold" style={{ color: primary, backgroundColor: secondaryBg }}>
                0{index + 1}
              </span>
              <span className="text-sm font-medium text-slate-200">{feature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── About ──────────────────────────────────────────────────────────── */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{aboutHeading}</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{aboutHeading}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">{aboutDescription}</p>
            {(templateContent?.about?.missionTitle?.trim() || templateContent?.about?.missionBody?.trim()) && (
              <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
                <h3 className="font-semibold mb-2">{templateContent.about.missionTitle?.trim() || "Our Mission"}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{templateContent.about.missionBody?.trim()}</p>
              </div>
            )}
            {(templateContent?.about?.visionTitle?.trim() || templateContent?.about?.visionBody?.trim()) && (
              <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left">
                <h3 className="font-semibold mb-2">{templateContent.about.visionTitle?.trim() || "Our Vision"}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{templateContent.about.visionBody?.trim()}</p>
              </div>
            )}
            {(companyInfo?.ceoName || companyInfo?.launchDate) && (
              <div className="flex flex-wrap justify-center gap-6 mt-5 text-sm text-slate-500">
                {companyInfo?.ceoName && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                    CEO: <strong className="text-slate-300 font-medium ml-1">{companyInfo.ceoName}</strong>
                  </span>
                )}
                {companyInfo?.launchDate && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                    Est: <strong className="text-slate-300 font-medium ml-1">{companyInfo.launchDate}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
          {promoVideo?.placement === "about"
            ? <PromoVideoEmbed video={promoVideo} primary={primary} className="mb-10" />
            : <AssetSlideshow className="mb-10 h-56 rounded-3xl border border-white/10" intervalMs={5400} overlay="linear-gradient(135deg, rgba(6,9,15,0.55), rgba(6,9,15,0.18))" label={`${siteName} about us`} variant={isLogistics ? "logistics" : "investment"} />
          }
        </Section>
      </section>

      {/* ── Featured Video Section ─────────────────────────────────────────── */}
      {promoVideo?.placement === "featured" && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <Section>
            <div className="text-center mb-10">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Featured Video</span>
              <h2 className="text-3xl sm:text-4xl font-bold">See {siteName} in Action</h2>
            </div>
            <PromoVideoEmbed video={promoVideo} primary={primary} className="max-w-4xl mx-auto" />
          </Section>
        </section>
      )}

      {/* ── Services ───────────────────────────────────────────────────────── */}
      <section id="services" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{content.servicesSection.heading}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{content.servicesSection.heading}</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">{content.servicesSection.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {content.services.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: secondaryBg }}>
                    <Icon className="w-5 h-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Why Choose Us ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24" data-testid="section-why-choose-us">
        <Section>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{content.whyUsSection.heading}</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{content.whyUsSection.heading}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">{content.whyUsSection.description}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.whyUs.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 group">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: secondaryBg }}>
                  <Icon className="w-5 h-5" style={{ color: primary }} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Section>
      </section>

      {/* ── Type-Specific Sections (Investment / Banking / Tracking) ───────── */}
      <TypeSpecificSections
        type={cfg.type}
        primary={primary}
        siteName={siteName}
        registerHref={registerHref}
        websiteUid={websiteUid}
      />

      {/* ── Security ───────────────────────────────────────────────────────── */}
      <section id="security" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="flex flex-col lg:flex-row gap-12 items-center">
              <div className="flex-1">
                <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{securityHeading}</span>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">{securityHeading}</h2>
                <p className="max-w-2xl leading-relaxed text-slate-400">{securityDescription}</p>
              </div>
              {/* Security badge panel */}
              <div className="flex-1 max-w-sm">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <AssetSlideshow className="mb-6 h-36 rounded-2xl" intervalMs={5600} overlay="linear-gradient(135deg, rgba(6,9,15,0.48), rgba(6,9,15,0.12))" label={`${siteName} security`} variant={isLogistics ? "logistics" : "investment"} />
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl" style={{ backgroundColor: primary }}>
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{securityHeading}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{securityDescription}</p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{content.howItWorksSection.heading}</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{content.howItWorksSection.heading}</h2>
            <p className="text-slate-400 max-w-xl mx-auto">{content.howItWorksSection.description}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {content.howItWorks.map(([number, title, body]) => (
              <div key={number} className="relative rounded-2xl border border-white/10 bg-[#06090f] p-6">
                <div className="text-3xl font-black mb-5" style={{ color: primary }}>{number}</div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Section>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{content.testimonialsSection.heading}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{content.testimonialsSection.heading}</h2>
            </div>
            <AssetSlideshow className="mb-10 h-48 rounded-3xl border border-white/10" intervalMs={5000} overlay="linear-gradient(135deg, rgba(6,9,15,0.58), rgba(6,9,15,0.18))" label={`${siteName} customer testimonials`} variant={isLogistics ? "logistics" : "investment"} />
            <div className="grid sm:grid-cols-3 gap-6">
              {content.testimonialsSection.items.map(({ name, role, body, rating }) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 hover:border-white/20 transition-colors">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed mb-6">"{body}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: primary }}>
                      {name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{name}</p>
                      <p className="text-slate-500 text-xs">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {content.testimonialsSection.items.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-[#06090f] px-6 py-8 text-center text-sm text-slate-400">
                Testimonials will appear here when they are published.
              </p>
            )}
          </Section>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="text-center mb-12">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{content.faqSection.heading}</h2>
          </div>
          <div className="space-y-3">
            {content.faqSection.items.map(({ question, answer }) => (
              <FaqItem key={question} q={question} a={answer} />
            ))}
          </div>
        </Section>
      </section>

      {/* ── Latest News ────────────────────────────────────────────────────── */}
      <section id="news" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
              <div>
                <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{content.newsSection.heading}</span>
                <h2 className="text-3xl sm:text-4xl font-bold">{content.newsSection.heading}</h2>
              </div>
            </div>
            <AssetSlideshow className="mb-10 h-52 rounded-3xl border border-white/10" intervalMs={5300} overlay={`linear-gradient(135deg, ${primary}55, rgba(6,9,15,0.38))`} label={`${siteName} latest news`} variant={isLogistics ? "logistics" : "investment"} />
            <div className="grid md:grid-cols-3 gap-6">
              {content.newsSection.items.map(({ category, title, body }) => (
                <article key={title} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 hover:border-white/20 transition-colors">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: primary }}>{category}</p>
                  <h3 className="font-semibold text-lg mb-3">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
                  <button type="button" onClick={() => scrollTo("contact")} className="mt-5 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: primary }}>
                    Read more →
                  </button>
                </article>
              ))}
            </div>
            {content.newsSection.items.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-[#06090f] px-6 py-8 text-center text-sm text-slate-400">
                News and updates will appear here when they are published.
              </p>
            )}
          </Section>
        </div>
      </section>

      {/* ── Contact ────────────────────────────────────────────────────────── */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Contact Us</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{contactHeading}</h2>
            <p className="mx-auto max-w-2xl text-slate-400">{contactDescription}</p>
          </div>
          {contactDetails.length > 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {contactDetails.map(({ icon: Icon, title, detail }) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center hover:border-white/20 transition-colors">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: secondaryBg }}>
                  <Icon className="w-6 h-6" style={{ color: primary }} />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-slate-300 mb-1">{detail}</p>
              </div>
            ))}
          </div>}
        </Section>
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────────── */}
      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.07] bg-[#06090f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                {companyInfo?.logoUrl
                  ? companyInfo.type === "tracking"
                    ? <img src={buildLogoUrl(companyInfo.logoUrl) ?? ""} alt={siteName} className="w-8 h-8 rounded-lg object-contain" style={{ background: primary + "22" }} />
                    : <WebsiteLogo src={buildLogoUrl(companyInfo.logoUrl) ?? ""} alt={siteName} size={32} style={{ background: primary + "22" }} />
                  : <div className={`w-8 h-8 ${companyInfo?.type === "tracking" ? "rounded-lg" : "rounded-full"} flex items-center justify-center font-bold text-white text-sm`} style={{ backgroundColor: primary }}>{siteName.charAt(0)}</div>
                }
                <span className="font-bold">{siteName}</span>
              </div>
              {companyInfo?.businessDescription?.trim() && (
                <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
                  {companyInfo.businessDescription.trim()}
                </p>
              )}
              <div className="flex gap-3">
                {socialLinks.map(({ Icon, url }, i) => (
                  <a key={i} href={url!} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center hover:border-white/25 hover:bg-white/5 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <p className="font-semibold text-sm mb-4">Company</p>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><Link href={`/site/${websiteUid}/about`} className="hover:text-white transition-colors">About</Link></li>
                <li><Link href={`/site/${websiteUid}/blog`} className="hover:text-white transition-colors">Blog</Link></li>
                {["Careers", "News", "Sitemap"].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="font-semibold text-sm mb-4">Legal</p>
              <ul className="space-y-2.5 text-sm text-slate-500">
                <li><Link href={`/site/${websiteUid}/privacy`} className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href={`/site/${websiteUid}/terms`} className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
                {["Cookie Policy", "Compliance", "Disclosures"].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <p className="font-semibold text-sm mb-4">Support</p>
              <ul className="space-y-2.5 text-sm text-slate-500">
                {["Help Center", "Contact", "Security", "Status"].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
              <div className="mt-6">
                <Link href={loginHref} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-white/15 hover:bg-white/5 transition-colors">Sign In</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <p>Secure · Trusted · {cfg.label}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
