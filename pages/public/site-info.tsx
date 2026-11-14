import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cookie,
  FileText,
  HelpCircle,
  LifeBuoy,
  Mail,
  MapPin,
  Newspaper,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { publicInfo } from "@/lib/portal-api";
import { formatWebsiteCopyright, UNAVAILABLE } from "@/lib/site-display";
import WebsiteLogo from "@/components/website-logo";

type SocialLink = { url?: string | null; Icon?: LucideIcon };

export type PublicSiteInfoSlug =
  | "about"
  | "careers"
  | "blog"
  | "news"
  | "sitemap"
  | "legal"
  | "faq"
  | "cookie-policy"
  | "compliance"
  | "disclosures"
  | "help-center"
  | "contact"
  | "security"
  | "status";

interface SiteInfo {
  type?: string | null;
  name?: string | null;
  primaryColor?: string | null;
  logoUrl?: string | null;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  businessDescription?: string | null;
  officeLocation?: string | null;
  launchDate?: string | null;
  createdAt?: string | Date | null;
}

interface FooterProps {
  siteName: string;
  websiteUid: string;
  primary: string;
  websiteType?: string | null;
  loginHref?: string;
  logoUrl?: string | null;
  description?: string;
  socialLinks?: SocialLink[];
}

const COMPANY_LINKS = [
  ["About", "about"],
  ["Careers", "careers"],
  ["Blog", "blog"],
  ["News", "news"],
  ["Sitemap", "sitemap"],
] as const;

const LEGAL_LINKS = [
  ["Privacy Policy", "privacy"],
  ["Terms & Conditions", "terms"],
  ["FAQ", "faq"],
  ["Cookie Policy", "cookie-policy"],
  ["Compliance", "compliance"],
  ["Disclosures", "disclosures"],
] as const;

const SUPPORT_LINKS = [
  ["Help Center", "help-center"],
  ["Contact", "contact"],
  ["Security", "security"],
  ["Status", "status"],
] as const;

function pageHref(websiteUid: string, slug: string) {
  return `/site/${websiteUid}/${slug}`;
}

function buildLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("/objects/")) {
    return `/api/public/logo-objects/${rawUrl.replace(/^\/objects\//, "")}`;
  }
  return rawUrl;
}

function SiteLink({
  websiteUid,
  slug,
  children,
  className = "",
}: {
  websiteUid: string;
  slug: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={pageHref(websiteUid, slug)} className={className}>
      {children}
    </Link>
  );
}

export function PublicSiteFooter({
  siteName,
  websiteUid,
  primary,
  websiteType,
  loginHref,
  logoUrl,
  description,
  socialLinks = [],
}: FooterProps) {
  const resolvedLogo = buildLogoUrl(logoUrl);
  const { data: footerSite } = useQuery({
    queryKey: ["publicInfo", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    enabled: Boolean(websiteUid),
    staleTime: 5 * 60_000,
  });
  const copyright = formatWebsiteCopyright(
    siteName,
    footerSite?.launchDate,
    footerSite?.createdAt,
  );
  const footerDescription = description?.trim() || footerSite?.businessDescription?.trim();

  return (
    <footer className="border-t border-white/[0.07] bg-[#06090f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              {resolvedLogo ? (
                websiteType === "tracking"
                  ? <img src={resolvedLogo} alt={siteName} className="w-8 h-8 rounded-lg object-contain" style={{ background: primary + "22" }} />
                  : <WebsiteLogo src={resolvedLogo} alt={siteName} size={32} style={{ background: primary + "22" }} />
              ) : (
                <div
                  className={`w-8 h-8 ${websiteType === "tracking" ? "rounded-lg" : "rounded-full"} flex items-center justify-center font-bold text-white text-sm`}
                  style={{ backgroundColor: primary }}
                >
                  {siteName.charAt(0)}
                </div>
              )}
              <span className="font-bold">{siteName}</span>
            </div>
            {footerDescription && (
              <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">{footerDescription}</p>
            )}
            {socialLinks.length > 0 && (
              <div className="flex gap-3">
                {socialLinks.map(({ url, Icon }, index) =>
                  url ? (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${siteName} social link`}
                      className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center hover:border-white/25 hover:bg-white/5 transition-colors text-xs text-slate-400"
                    >
                      {Icon ? <Icon className="w-3.5 h-3.5" /> : "↗"}
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </div>

          <FooterColumn title="Company" links={COMPANY_LINKS} websiteUid={websiteUid} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} websiteUid={websiteUid} />
          <div>
            <p className="font-semibold text-sm mb-4">Support</p>
            <ul className="space-y-2.5 text-sm text-slate-500">
              {SUPPORT_LINKS.map(([label, slug]) => (
                <li key={slug}>
                  <SiteLink websiteUid={websiteUid} slug={slug} className="hover:text-white transition-colors">
                    {label}
                  </SiteLink>
                </li>
              ))}
            </ul>
            {loginHref && <div className="mt-6">
              <Link
                href={loginHref}
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-white/15 hover:bg-white/5 transition-colors"
              >
                Sign In
              </Link>
            </div>}
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>{copyright}</p>
          <SiteLink websiteUid={websiteUid} slug="legal" className="hover:text-white transition-colors">
            Legal &amp; privacy information
          </SiteLink>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  websiteUid,
}: {
  title: string;
  links: readonly (readonly [string, string])[];
  websiteUid: string;
}) {
  return (
    <div>
      <p className="font-semibold text-sm mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm text-slate-500">
        {links.map(([label, slug]) => (
          <li key={slug}>
            <SiteLink websiteUid={websiteUid} slug={slug} className="hover:text-white transition-colors">
              {label}
            </SiteLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FAQS: Array<[string, string]> = [];

const PAGE_COPY: Record<PublicSiteInfoSlug, { title: string; eyebrow: string; icon: typeof FileText }> = {
  about: { title: "About Us", eyebrow: "Company", icon: Sparkles },
  careers: { title: "Careers", eyebrow: "Company", icon: BriefcaseBusiness },
  blog: { title: "Blog", eyebrow: "Company", icon: Newspaper },
  news: { title: "News", eyebrow: "Company", icon: Newspaper },
  sitemap: { title: "Sitemap", eyebrow: "Company", icon: Search },
  legal: { title: "Legal", eyebrow: "Legal", icon: Scale },
  faq: { title: "Frequently Asked Questions", eyebrow: "Legal", icon: HelpCircle },
  "cookie-policy": { title: "Cookie Policy", eyebrow: "Legal", icon: Cookie },
  compliance: { title: "Compliance", eyebrow: "Legal", icon: ShieldCheck },
  disclosures: { title: "Disclosures", eyebrow: "Legal", icon: FileText },
  "help-center": { title: "Help Center", eyebrow: "Support", icon: LifeBuoy },
  contact: { title: "Contact", eyebrow: "Support", icon: Mail },
  security: { title: "Security", eyebrow: "Support", icon: Shield },
  status: { title: "Platform Status", eyebrow: "Support", icon: Activity },
};

function InfoLayout({
  children,
  site,
  websiteUid,
  slug,
}: {
  children: React.ReactNode;
  site: SiteInfo;
  websiteUid: string;
  slug: PublicSiteInfoSlug;
}) {
  const primary = site.primaryColor ?? "#2563eb";
  const siteName = site.name ?? UNAVAILABLE;
  const { title, eyebrow, icon: Icon } = PAGE_COPY[slug];

  return (
    <div className="min-h-screen bg-[#06090f] text-white">
      <header className="border-b border-white/[0.07] sticky top-0 z-50 backdrop-blur-md bg-[#06090f]/90">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            href={`/site/${websiteUid}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {siteName}
          </Link>
          <span className="text-xs text-slate-500 uppercase tracking-widest">{eyebrow}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: primary + "22" }}>
              <Icon className="w-5 h-5" style={{ color: primary }} />
            </div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
          </div>
          {site.businessDescription?.trim() && (
            <p className="text-slate-400 text-sm leading-relaxed">{site.businessDescription.trim()}</p>
          )}
        </div>
        <div className="space-y-8 text-slate-300 text-sm leading-relaxed">{children}</div>
      </main>

      <PublicSiteFooter
        siteName={siteName}
        websiteUid={websiteUid}
        primary={primary}
        websiteType={site.type}
        description={site.businessDescription?.trim() || UNAVAILABLE}
      />
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function PublicSiteInfoPage({
  params,
}: {
  params: { websiteUid: string; page: string };
}) {
  const { websiteUid, page } = params;
  const slug = (page in PAGE_COPY ? page : "about") as PublicSiteInfoSlug;
  const { data: site, isLoading } = useQuery({
    queryKey: ["public-info", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });

  if (isLoading) return null;
  if (!site) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">This website link is invalid or has been removed.</p>
      </div>
    );
  }

  const info = site as SiteInfo;
  const siteName = info.name ?? "Our Platform";
  const contactEmail = info.supportEmail ?? info.companyEmail ?? UNAVAILABLE;
  const contactPhone = info.supportPhone ?? info.companyPhone ?? UNAVAILABLE;
  const address = info.officeLocation ?? info.companyAddress ?? UNAVAILABLE;
  const primary = info.primaryColor ?? "#2563eb";

  const renderContent = () => {
    switch (slug) {
      case "about":
        return (
          <>
            <InfoSection title={`About ${siteName}`}>
              {info.businessDescription?.trim() && <p>{info.businessDescription.trim()}</p>}
            </InfoSection>
            {address && <InfoSection title="Where we operate"><p>{address}</p></InfoSection>}
          </>
        );
      case "careers":
        return (
          <>
            <InfoSection title={`Build the future with ${siteName}`}>
            </InfoSection>
            <InfoSection title="What we value">
            </InfoSection>
            <InfoSection title="Interested?">
            </InfoSection>
          </>
        );
      case "blog":
      case "news":
        return (
          <>
            <InfoSection title={`Updates from ${siteName}`}>
            </InfoSection>
          </>
        );
      case "sitemap":
        return (
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              ["Company", COMPANY_LINKS],
              ["Legal", LEGAL_LINKS],
              ["Support", SUPPORT_LINKS],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h2 className="font-semibold text-white mb-3">{title as string}</h2>
                <ul className="space-y-2">
                  {(links as readonly (readonly [string, string])[]).map(([label, target]) => (
                    <li key={target}>
                      <SiteLink websiteUid={websiteUid} slug={target} className="text-slate-400 hover:text-white transition-colors">
                        {label}
                      </SiteLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      case "legal":
        return (
          <>
            <InfoSection title="Legal information">
              <p>Review the policies and disclosures that govern use of {siteName}.</p>
            </InfoSection>
            <div className="grid sm:grid-cols-2 gap-4">
              {LEGAL_LINKS.map(([label, target]) => (
                <SiteLink key={target} websiteUid={websiteUid} slug={target} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-white hover:border-white/25 transition-colors">
                  {label} →
                </SiteLink>
              ))}
            </div>
          </>
        );
      case "faq":
        return (
          <div className="space-y-3">
            {FAQS.map(([question, answer]) => (
              <FaqItem key={question} question={question} answer={answer} />
            ))}
          </div>
        );
      case "cookie-policy":
        return (
          <>
            <InfoSection title="How cookies are used">
              <p>{siteName} may use cookies and similar technologies to keep sessions secure, remember preferences, understand page usage, and improve the platform.</p>
            </InfoSection>
            <InfoSection title="Your choices">
              <p>You can manage cookies through your browser settings. Disabling required cookies may prevent sign-in or other platform features from working correctly.</p>
            </InfoSection>
          </>
        );
      case "compliance":
        return (
          <>
            <InfoSection title="Responsible operation">
              <p>{siteName} applies account, identity, transaction, and security controls appropriate to the services enabled for this website.</p>
            </InfoSection>
            <InfoSection title="Identity and transaction reviews">
              <p>Some activities may require identity verification, additional information, review, or a temporary hold to meet legal and platform requirements.</p>
            </InfoSection>
          </>
        );
      case "disclosures":
        return (
          <>
            <InfoSection title="Important information">
              <p>Information on this website is provided for general platform and service guidance. Availability, eligibility, fees, limits, and processing times may vary by customer, location, and service.</p>
            </InfoSection>
            <InfoSection title="Service-specific terms">
              <p>Always review the applicable terms, confirmations, and notices before completing an account action or transaction.</p>
            </InfoSection>
          </>
        );
      case "help-center":
        return (
          <>
            <InfoSection title="How can we help?">
            </InfoSection>
            <div className="grid sm:grid-cols-2 gap-4">
              {["Registration and verification", "Account access", "Transactions and receipts", "Security and privacy"].map((topic) => (
                <div key={topic} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="font-semibold text-white mb-2">{topic}</h2>
                  <p className="text-slate-400 text-sm">Contact support for assistance with this topic.</p>
                </div>
              ))}
            </div>
          </>
        );
      case "contact":
        return (
          <>
            <InfoSection title={`Contact ${siteName}`}>
              <p>Use the following details for general questions, support requests, or business enquiries.</p>
            </InfoSection>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
              <p className="font-semibold text-white">{siteName}</p>
              {contactEmail && (
                <p className="flex items-start gap-3"><Mail className="w-4 h-4 mt-1 shrink-0" style={{ color: primary }} />
                  {contactEmail.includes("@")
                    ? <a href={`mailto:${contactEmail}`} className="hover:text-white" style={{ color: primary }}>{contactEmail}</a>
                    : <span>{contactEmail}</span>}
                </p>
              )}
              {contactPhone && <p className="text-slate-400">{contactPhone}</p>}
              {address && <p className="flex items-start gap-3 text-slate-400"><MapPin className="w-4 h-4 mt-1 shrink-0" style={{ color: primary }} />{address}</p>}
            </div>
          </>
        );
      case "security":
        return (
          <>
            <InfoSection title={`Security at ${siteName}`}>
              <p>Security controls help protect accounts, personal information, and platform activity. Keep your credentials private and report suspicious activity promptly.</p>
            </InfoSection>
            <div className="grid sm:grid-cols-2 gap-4">
              {["Encrypted connections", "Identity verification", "Audit logging", "Account notifications"].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex items-center gap-3">
                  <Shield className="w-5 h-5" style={{ color: primary }} /> {item}
                </div>
              ))}
            </div>
          </>
        );
      case "status":
        return (
          <>
            <InfoSection title="Current platform status">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div><p className="font-semibold text-white">Services operating normally</p><p className="text-emerald-200/70 text-sm">No active incidents are currently posted.</p></div>
              </div>
            </InfoSection>
            <InfoSection title="Need help?">
              <p>If you are experiencing a problem, visit the Help Center or Contact page with the time and details of the issue.</p>
            </InfoSection>
          </>
        );
    }
  };

  return (
    <InfoLayout site={info} websiteUid={websiteUid} slug={slug}>
      {renderContent()}
    </InfoLayout>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button onClick={() => setOpen((current) => !current)} className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.03] transition-colors">
        <span className="font-medium text-slate-100">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-5 text-slate-400 text-sm leading-relaxed">{answer}</div>}
    </div>
  );
}