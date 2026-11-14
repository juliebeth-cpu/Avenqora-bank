/**
 * PublicBankingHomePage — Premium public landing page for banking-type websites.
 *
 * Rendered when site.type === "banking" in pages/site/home.tsx.
 * Only the PUBLIC homepage — the banking dashboard/auth flows are untouched.
 */

import { useState } from "react";
import { Link } from "wouter";
import {
  Shield, Zap, Globe, Smartphone, Headphones, DollarSign,
  Lock, Eye, AlertTriangle, CreditCard, CheckCircle2,
  ChevronDown, ChevronUp, ArrowRight, Star, TrendingUp,
  Building2, PiggyBank, Send, Briefcase, BarChart3, Wallet,
  Facebook, Instagram, Twitter, Linkedin, Youtube,
  Phone, Mail, MapPin, MessageCircle, Award, Users, BadgeCheck,
  Bitcoin, LineChart, Gem, Package
} from "lucide-react";
import AssetSlideshow from "../components/AssetSlideshow";
import WebsiteLogo from "../components/website-logo";
import { PromoVideoEmbed, type PromoVideo } from "./PromoVideoEmbed";
type OwnerTemplateContent = Record<string, any>;
import {
  BANKING_FAQ_COPY,
  BANKING_HOW_IT_WORKS_COPY,
  BANKING_KYC_COPY,
  BANKING_SECURITY_COPY,
  BANKING_SERVICES_COPY,
  WHY_CHOOSE_US_COPY,
  resolveHomepageCopy,
} from "./homepage-copy";

// ─── Immediate section wrapper ────────────────────────────────────────────────
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, suffix, label, primary }: { value: number; suffix: string; label: string; primary: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color: primary }}>
        {value.toLocaleString()}{suffix}
      </div>
      <div className="text-slate-400 text-sm uppercase tracking-wide">{label}</div>
    </div>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] transition-colors">
        <span className="font-medium text-slate-100">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed">{a}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface CompanyInfo {
  businessDescription?: string | null;
  companyEmail?: string | null;
  supportEmail?: string | null;
  companyPhone?: string | null;
  supportPhone?: string | null;
  companyAddress?: string | null;
  officeLocation?: string | null;
  launchDate?: string | null;
  createdAt?: string | Date | null;
  socialFacebook?: string | null;
  socialInstagram?: string | null;
  socialTwitter?: string | null;
  socialLinkedin?: string | null;
  socialYoutube?: string | null;
  liveChatEnabled?: boolean;
  liveChatCode?: string | null;
}

interface Props {
  websiteUid: string;
  siteName: string;
  primary: string;
  logoUrl?: string | null;
  loginHref: string;
  registerHref: string;
  promoVideo?: PromoVideo | null;
  companyInfo?: CompanyInfo | null;
  templateContent?: OwnerTemplateContent;
}

function buildLogoUrl(rawUrl: string | null | undefined): string | null {
  return rawUrl || null;
}

export default function PublicBankingHomePage({ websiteUid, siteName, primary, logoUrl, loginHref, registerHref, promoVideo, companyInfo, templateContent }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [calcAmount, setCalcAmount] = useState<number | null>(5000);

  // Scroll spy for smooth nav
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const secondaryBg = primary + "18";
  const primaryDim = primary + "30";
  const resolvedLogo = buildLogoUrl(logoUrl);
  const whyUsCopy = resolveHomepageCopy(templateContent?.whyUs, WHY_CHOOSE_US_COPY);
  const servicesCopy = resolveHomepageCopy(templateContent?.services, BANKING_SERVICES_COPY);
  const howItWorksCopy = resolveHomepageCopy(templateContent?.howItWorks, BANKING_HOW_IT_WORKS_COPY);
  const kycCopy = BANKING_KYC_COPY;
  const securityHeading = templateContent?.security?.heading?.trim() || BANKING_SECURITY_COPY.heading;
  const securityDescription = templateContent?.security?.description?.trim() || BANKING_SECURITY_COPY.description;
  const aboutHeading = templateContent?.about?.heading?.trim() || "About Us";
  const aboutDescription = templateContent?.about?.description?.trim()
    || companyInfo?.businessDescription?.trim()
    || `${siteName} provides a customer portal for the banking services and account options available on this website.`;
  const heroHeading = templateContent?.hero?.heading?.trim() || siteName;
  const heroDescription = templateContent?.hero?.description?.trim() || companyInfo?.businessDescription?.trim();
  const heroActionLabel = templateContent?.hero?.actionLabel?.trim() || "Create Account";
  const contactHeading = templateContent?.contact?.heading?.trim() || `Contact ${siteName}`;
  const contactDescription = templateContent?.contact?.description?.trim()
    || "Use the support details published here if you have a question about this website or your account.";
  const faqCopy = {
    heading: templateContent?.faq?.heading?.trim() || BANKING_FAQ_COPY.heading,
    items: (() => {
      const supplied = (templateContent?.faq?.items ?? []).filter(
        item => Boolean(item.question?.trim() || item.answer?.trim()),
      );
      return (supplied.length ? supplied : BANKING_FAQ_COPY.items).map((item, index) => ({
        question: item.question?.trim() || BANKING_FAQ_COPY.items[index]?.question || "Question",
        answer: item.answer?.trim() || BANKING_FAQ_COPY.items[index]?.answer || BANKING_FAQ_COPY.items[0].answer,
      }));
    })(),
  };
  const publishedTestimonials = (templateContent?.testimonials?.items ?? [])
    .filter(item => Boolean(item.name?.trim() && item.body?.trim()))
    .map(item => ({
      name: item.name.trim(),
      role: item.role.trim(),
      body: item.body.trim(),
      rating: Math.max(1, Math.min(5, Math.floor(item.rating))),
    }));
  const testimonials = publishedTestimonials.length ? publishedTestimonials : [
    { name: "Sarah Mitchell", role: "Small Business Owner", body: `Switching to ${siteName} was the best financial decision I made. The business account tools and international transfer speeds are unmatched.`, rating: 5 },
    { name: "Grace Williams", role: "Software Engineer", body: `The investment platform is incredible. I manage my stocks, crypto, and forex all from one dashboard. The UI is clean and the execution is fast.`, rating: 5 },
    { name: "Priya Sharma", role: "Finance Manager", body: `${siteName}'s security features gave me peace of mind immediately. MFA, real-time alerts, and the fraud monitoring work flawlessly.`, rating: 5 },
  ];
  const testimonialsHeading = templateContent?.testimonials?.heading?.trim() || "Trusted by Thousands";
  const testimonialsLabel = templateContent?.testimonials?.heading?.trim() || "Testimonials";
  const publishedNews = (templateContent?.news?.items ?? [])
    .filter(item => Boolean(item.title?.trim() && item.body?.trim()))
    .map(item => ({
      category: item.category.trim() || "Update",
      title: item.title.trim(),
      body: item.body.trim(),
    }));
  const news = publishedNews.length ? publishedNews : [
    { title: "Building a stronger financial foundation", category: "Guides", body: "Simple habits that can help you plan, save, and manage everyday spending with confidence." },
    { title: "Security updates for safer banking", category: "Security", body: "How layered protection, alerts, and verification help keep your account and information secure." },
    { title: "Planning for long-term growth", category: "Investing", body: "A clear framework for balancing short-term goals with a resilient long-term financial plan." },
  ];
  const newsHeading = templateContent?.news?.heading?.trim() || "Latest News";
  const newsTitle = templateContent?.news?.heading?.trim() || "Insights for Your Financial Future";
  const whyUsIcons = [CheckCircle2, BadgeCheck, Headphones];
  const serviceIcons = [Building2, Send, CreditCard, Wallet];
  const kycIcons = [Shield, BadgeCheck, CheckCircle2, Headphones];
  const displayEmail = companyInfo?.supportEmail || companyInfo?.companyEmail || "";
  const displayPhone = companyInfo?.supportPhone || companyInfo?.companyPhone || "";
  const displayAddress = companyInfo?.officeLocation || companyInfo?.companyAddress || "";
  const contactDetails = [
    { icon: Mail, title: "Email", detail: displayEmail },
    { icon: Phone, title: "Phone", detail: displayPhone },
    { icon: MapPin, title: "Office", detail: displayAddress },
    { icon: MessageCircle, title: "Live Chat", detail: companyInfo?.liveChatEnabled && companyInfo.liveChatCode ? "Available" : "" },
  ].filter(({ detail }) => Boolean(detail));

  return (
    <div className="min-h-screen bg-[#06090f] text-white scroll-smooth">

      {/* ── Sticky Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#06090f]/90 backdrop-blur-lg border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {resolvedLogo ? (
              <WebsiteLogo src={resolvedLogo} alt={siteName} size={36} className="rounded-xl shadow-lg" style={{ background: primary + "22" }} />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-lg" style={{ backgroundColor: primary }}>
                {siteName.charAt(0)}
              </div>
            )}
            <span className="font-bold text-lg tracking-tight">{siteName}</span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
            {["about", "services", "security", "invest", "calculator", "how-it-works", "news", "contact"].map(id => (
              <button key={id} onClick={() => scrollTo(id)} className="hover:text-white capitalize transition-colors">{id}</button>
            ))}
          </nav>

          {/* CTA buttons */}
          <div className="flex items-center gap-2">
            <Link href={loginHref} className="hidden sm:inline-flex text-sm px-4 py-2 rounded-lg border border-white/15 hover:bg-white/5 transition-colors font-medium">Sign In</Link>
            <Link href={registerHref} className="inline-flex text-sm px-4 py-2 rounded-lg font-semibold transition-all hover:opacity-90 shadow-lg" style={{ backgroundColor: primary }}>Open Account</Link>
            {/* Mobile hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 ml-1 text-slate-400 hover:text-white">
              <div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current mb-1" /><div className="w-5 h-0.5 bg-current" />
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 bg-[#06090f] px-4 py-3 flex flex-col gap-3 text-sm text-slate-300">
            {["about", "services", "security", "invest", "calculator", "how-it-works", "news", "contact"].map(id => (
              <button key={id} onClick={() => scrollTo(id)} className="text-left hover:text-white capitalize py-1">{id}</button>
            ))}
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[92vh] flex items-center">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 pointer-events-none">
          <AssetSlideshow
            className="absolute inset-0 h-full w-full"
            intervalMs={4300}
            overlay="linear-gradient(135deg, rgba(6,9,15,0.86), rgba(6,9,15,0.42) 52%, rgba(6,9,15,0.8))"
            label={`${siteName} banking homepage hero`}
            priority
          />
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl" style={{ backgroundColor: primary }} />
          <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl" style={{ backgroundColor: primary }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#06090f]/60 to-[#06090f]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 flex flex-col lg:flex-row items-center gap-14">
          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
              {heroHeading}
            </h1>
            {heroDescription && (
              <p className="text-lg text-slate-300 max-w-xl mb-10 leading-relaxed mx-auto lg:mx-0">
                {heroDescription}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href={registerHref} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-[1.02] shadow-2xl" style={{ backgroundColor: primary }}>
                {heroActionLabel} <ArrowRight className="w-5 h-5" />
              </Link>
              <button onClick={() => scrollTo("about")} className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/20 hover:bg-white/5 transition-colors">
                Learn More
              </button>
            </div>
          </div>

          {/* Right — hero card */}
          <div className="flex-1 max-w-sm w-full lg:max-w-md">
            {promoVideo?.placement === "hero" && promoVideo.viewURL ? (
              <PromoVideoEmbed video={promoVideo} primary={primary} />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur p-6 shadow-2xl">
                <AssetSlideshow className="mb-6 h-32 rounded-xl" intervalMs={5100} overlay={`linear-gradient(135deg, ${primary}99, rgba(6,9,15,0.48))`} label={`${siteName} banking overview`} />
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Main Account</p>
                    <p className="text-2xl font-bold">$24,850.00</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: primary }}>
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[["↑ Income", "+$3,200", "text-emerald-400"], ["↓ Expenses", "-$1,850", "text-rose-400"]].map(([label, val, cls]) => (
                    <div key={label} className="rounded-xl p-3" style={{ backgroundColor: primaryDim }}>
                      <p className="text-xs text-slate-400 mb-1">{label}</p>
                      <p className={`font-bold ${cls}`}>{val}</p>
                    </div>
                  ))}
                </div>
                <Link href={registerHref} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90" style={{ backgroundColor: primary }}>
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
          <StatCard value={5} suffix="M+" label="Active Users" primary={primary} />
          <StatCard value={99} suffix=".9%" label="Uptime Guarantee" primary={primary} />
          <StatCard value={50} suffix="M+" label="Transactions" primary={primary} />
          <StatCard value={190} suffix="+" label="Countries Served" primary={primary} />
        </div>
      </div>

      {/* ── About Us ───────────────────────────────────────────────────────── */}
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
          </div>
          {promoVideo?.placement === "about" && promoVideo.viewURL ? (
            <PromoVideoEmbed video={promoVideo} primary={primary} className="mb-10" />
          ) : (
            <AssetSlideshow className="mb-10 h-56 rounded-3xl border border-white/10" intervalMs={5400} overlay="linear-gradient(135deg, rgba(6,9,15,0.55), rgba(6,9,15,0.18))" label={`${siteName} about us`} />
          )}
        </Section>
      </section>

      {promoVideo?.placement === "featured" && promoVideo.viewURL && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Featured Video</span>
            <h2 className="text-3xl sm:text-4xl font-bold">See {siteName} in Action</h2>
          </div>
          <PromoVideoEmbed video={promoVideo} primary={primary} className="max-w-4xl mx-auto" />
        </section>
      )}

      {/* ── Why Choose Us ──────────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24" data-testid="section-why-choose-us">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{whyUsCopy.heading}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{whyUsCopy.heading}</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">{whyUsCopy.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {whyUsCopy.items.map((item, index) => {
                const Icon = whyUsIcons[index % whyUsIcons.length];
                return (
                  <div key={`${item.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#06090f] p-6">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: secondaryBg }}>
                      <Icon className="w-5 h-5" style={{ color: primary }} />
                    </div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Security ───────────────────────────────────────────────────────── */}
      <section id="security" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
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
                <AssetSlideshow className="mb-6 h-36 rounded-2xl" intervalMs={5600} overlay="linear-gradient(135deg, rgba(6,9,15,0.48), rgba(6,9,15,0.12))" label={`${siteName} security`} />
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl" style={{ backgroundColor: primary }}>
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{securityHeading}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{securityDescription}</p>
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* ── KYC ────────────────────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24" data-testid="section-kyc-information">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>KYC Information</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{kycCopy.heading}</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">{kycCopy.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {kycCopy.items.map((item, index) => {
                const Icon = kycIcons[index % kycIcons.length];
                return (
                  <div key={`${item.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#06090f] p-6">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: secondaryBg }}>
                      <Icon className="w-5 h-5" style={{ color: primary }} />
                    </div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Banking Services ────────────────────────────────────────────────── */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6 py-24" data-testid="section-banking-services">
        <Section>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{servicesCopy.heading}</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{servicesCopy.heading}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">{servicesCopy.description}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {servicesCopy.items.map((item, index) => {
              const Icon = serviceIcons[index % serviceIcons.length];
              return (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#06090f] p-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: secondaryBg }}>
                    <Icon className="w-5 h-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.body}</p>
                </div>
              );
            })}
          </div>
        </Section>
      </section>

      {/* ── Investments ─────────────────────────────────────────────────────── */}
      <section id="invest" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Investment Platform</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Grow Your Wealth Smarter</h2>
              <p className="text-slate-400 max-w-xl mx-auto">Access diversified investment options across global markets — all from within your {siteName} account.</p>
            </div>
            <AssetSlideshow className="mb-10 h-52 rounded-3xl border border-white/10" intervalMs={4700} overlay={`linear-gradient(135deg, ${primary}72, rgba(6,9,15,0.38))`} label={`${siteName} investment services`} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {[
                { icon: Globe, title: "Forex", body: "Review foreign-exchange tools and availability configured for your account." },
                { icon: Bitcoin, title: "Cryptocurrency", body: "Check whether digital-asset services are enabled for this website and your account." },
                { icon: LineChart, title: "Stocks & ETFs", body: "Review available market options and their terms before submitting a request." },
                { icon: Package, title: "Commodities", body: "Explore commodity-related options when they are offered through this website." },
                { icon: Gem, title: "Wealth Management", body: "Find account and service information available through your customer portal." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 hover:border-white/20 transition-colors text-center group">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform" style={{ backgroundColor: secondaryBg }}>
                    <Icon className="w-6 h-6" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Banking Calculator ──────────────────────────────────────────────── */}
      <section id="calculator" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Savings Calculator</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">See Your Money Grow</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Estimate the potential value of your savings with a transparent, simple projection.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <label className="block text-sm font-semibold text-slate-300 mb-3">Starting balance</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                <input
                  type="number"
                  min={0}
                  max={250000}
                  value={calcAmount ?? ""}
                  onChange={e => setCalcAmount(e.target.value === "" ? null : Math.max(0, Math.min(250000, Number(e.target.value))))}
                  className="w-full pl-8 pr-4 py-4 rounded-xl bg-[#06090f] text-white font-bold text-lg outline-none border border-white/10 focus:border-white/25"
                />
              </div>
              <input
                type="range"
                min={0}
                max={250000}
                step={100}
                value={calcAmount ?? 0}
                onChange={e => setCalcAmount(Number(e.target.value))}
                className="w-full mt-5"
                style={{ accentColor: primary }}
                aria-label="Starting balance"
              />
            </div>
            <div className="rounded-3xl border overflow-hidden" style={{ background: `linear-gradient(145deg, ${primary}28, #06090f)`, borderColor: primary + "45" }}>
              <AssetSlideshow className="h-40 w-full" intervalMs={4900} overlay={`linear-gradient(135deg, ${primary}78, rgba(6,9,15,0.48))`} label={`${siteName} savings calculator`} />
              <div className="p-8">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>Illustrative estimate</p>
                <p className="text-4xl sm:text-5xl font-black text-white mb-2">
                  {calcAmount == null ? "" : `$${calcAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ backgroundColor: secondaryBg }}>
                    <p className="text-xs text-slate-500 mb-1">Starting balance</p>
                    <p className="font-bold text-white">{calcAmount == null ? "" : `$${calcAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ backgroundColor: secondaryBg }}>
                    <p className="text-xs text-slate-500 mb-1">Estimated interest</p>
                    <p className="font-bold text-emerald-400"></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{howItWorksCopy.heading}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{howItWorksCopy.heading}</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">{howItWorksCopy.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {howItWorksCopy.items.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-2xl border border-white/10 bg-[#06090f] p-6">
                  <div className="mb-5 text-3xl font-black" style={{ color: primary }}>{String(index + 1).padStart(2, "0")}</div>
                  <h3 className="mb-2 font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ── Mobile Banking ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}18 0%, #06090f 60%)` }}>
            <div className="flex flex-col lg:flex-row items-center gap-10 p-10">
              <div className="flex-1">
                <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Mobile Banking</span>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Bank Anywhere, Anytime</h2>
                <p className="text-slate-400 mb-8 leading-relaxed max-w-lg">
                  The {siteName} mobile app brings the full power of your account to your fingertips. Check balances, send money, pay bills, and invest — all in one app.
                </p>
                <div className="space-y-3 mb-8">
                  {["Instant push notifications for every transaction", "Biometric login (Face ID & Fingerprint)", "Mobile cheque deposit & QR payments", "Real-time spending insights & budgeting tools"].map(f => (
                    <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: primary }} />{f}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  <Link href={registerHref} className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/15 hover:bg-white/5 transition-colors">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <div className="text-xs text-slate-400">Get it on</div>
                      <div className="font-semibold text-sm">Google Play</div>
                    </div>
                  </Link>
                  <Link href={registerHref} className="flex items-center gap-3 px-5 py-3 rounded-xl border border-white/15 hover:bg-white/5 transition-colors">
                    <span className="text-2xl">🍎</span>
                    <div>
                      <div className="text-xs text-slate-400">Download on the</div>
                      <div className="font-semibold text-sm">App Store</div>
                    </div>
                  </Link>
                </div>
              </div>
              {/* Phone mockup */}
              <div className="flex-1 max-w-xs">
                <div className="rounded-3xl border-2 border-white/15 bg-[#0d1117] p-4 shadow-2xl mx-auto w-60">
                  <div className="rounded-2xl overflow-hidden bg-white/[0.04] p-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-slate-400">Balance</span>
                      <span className="text-xs text-emerald-400">● Live</span>
                    </div>
                    <p className="text-2xl font-bold mb-1">$12,450.00</p>
                    <p className="text-xs text-slate-400 mb-5">{siteName} Main Account</p>
                    <div className="flex gap-3 mb-5">
                      {["Send", "Receive", "Pay"].map(a => (
                        <div key={a} className="flex-1 rounded-lg py-2 text-center text-xs font-medium" style={{ backgroundColor: secondaryBg, color: primary }}>{a}</div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[["Netflix", "-$15.99"], ["Salary", "+$4,200"], ["Amazon", "-$89.50"]].map(([label, val]) => (
                        <div key={label} className="flex justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-slate-400">{label}</span>
                          <span className={val.startsWith("+") ? "text-emerald-400" : "text-slate-300"}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{testimonialsLabel}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{testimonialsHeading}</h2>
            </div>
            <AssetSlideshow className="mb-10 h-48 rounded-3xl border border-white/10" intervalMs={5000} overlay="linear-gradient(135deg, rgba(6,9,15,0.58), rgba(6,9,15,0.18))" label={`${siteName} customer testimonials`} />
            <div className="grid sm:grid-cols-3 gap-6">
              {testimonials.map(({ name, role, body, rating }) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 hover:border-white/20 transition-colors">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: rating }).map((_, index) => (
                      <Star key={index} className="w-4 h-4 fill-amber-400 text-amber-400" />
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
          </Section>
        </div>
      </section>

      {/* ── Latest News ─────────────────────────────────────────────────────── */}
      <section id="news" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{newsHeading}</span>
              <h2 className="text-3xl sm:text-4xl font-bold">{newsTitle}</h2>
            </div>
            <p className="text-slate-400 text-sm max-w-sm">Practical guidance, product updates, and perspectives from our financial specialists.</p>
          </div>
          <AssetSlideshow className="mb-10 h-52 rounded-3xl border border-white/10" intervalMs={5300} overlay={`linear-gradient(135deg, ${primary}62, rgba(6,9,15,0.35))`} label={`${siteName} latest news`} />
          <div className="grid md:grid-cols-3 gap-6">
            {news.map(({ category, title, body }, index) => (
              <article key={`${title}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/20 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: primary }}>{category}</p>
                <h3 className="font-semibold text-lg mb-3">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
                <button type="button" onClick={() => scrollTo("contact")} className="mt-5 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: primary }}>Read more →</button>
              </article>
            ))}
          </div>
        </Section>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <Section>
          <div className="text-center mb-12">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{faqCopy.heading}</h2>
          </div>
          <div className="space-y-3">
            {faqCopy.items.map(({ question, answer }) => (
              <FaqItem key={question} q={question} a={answer} />
            ))}
          </div>
        </Section>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────────── */}
      <section id="contact" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Section>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>{contactHeading}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">{contactHeading}</h2>
              <p className="mx-auto max-w-2xl text-slate-400">{contactDescription}</p>
            </div>
            {contactDetails.length > 0 && <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {contactDetails.map(({ icon: Icon, title, detail }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 text-center hover:border-white/20 transition-colors">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: secondaryBg }}>
                    <Icon className="w-6 h-6" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-slate-300 mb-1">{detail}</p>
                </div>
              ))}
            </div>}
          </Section>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.07] bg-[#06090f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white" style={{ backgroundColor: primary }}>
                  {siteName.charAt(0)}
                </div>
                <span className="font-bold">{siteName}</span>
              </div>
              {companyInfo?.businessDescription?.trim() && (
                <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
                  {companyInfo.businessDescription.trim()}
                </p>
              )}
              {/* Social icons */}
              <div className="flex gap-3">
                {[
                  { Icon: Facebook, url: companyInfo?.socialFacebook },
                  { Icon: Instagram, url: companyInfo?.socialInstagram },
                  { Icon: Twitter, url: companyInfo?.socialTwitter },
                  { Icon: Linkedin, url: companyInfo?.socialLinkedin },
                  { Icon: Youtube, url: companyInfo?.socialYoutube },
                ].filter(({ url }) => Boolean(url)).map(({ Icon, url }) => (
                  <a key={url} href={url!} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center hover:border-white/25 hover:bg-white/5 transition-colors">
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
                <li><a href={`/site/${websiteUid}#faq`} className="hover:text-white transition-colors">FAQ</a></li>
                { ["KYC Policy", "AML Policy", "Cookie Policy"].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <p className="font-semibold text-sm mb-4">Support</p>
              <ul className="space-y-2.5 text-sm text-slate-500">
                {["Help Center", "Contact", "Security", "Support"].map(l => (
                  <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
              <div className="mt-6">
                <Link href={loginHref} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-white/15 hover:bg-white/5 transition-colors">Sign In</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved. Licensed financial services provider.</p>
            <p>Regulated · FDIC Insured · Equal Housing Lender</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
