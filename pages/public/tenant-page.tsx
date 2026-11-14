import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Building2, CalendarDays, Shield, Star } from "lucide-react";
import { publicInfo } from "@/lib/portal-api";
import { getTemplateConfig } from "@/lib/template-registry";
import { applyWebsiteMeta, resetWebsiteMeta } from "@/lib/website-meta";
import { TrackingBlogContent } from "@/pages/public/tracking-content";
import WebsiteLogo from "@/components/website-logo";
import { formatWebsiteCopyright, UNAVAILABLE } from "@/lib/site-display";

type PageKind = "about" | "blog";

function logoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.startsWith("/objects/")
    ? `/api/public/logo-objects/${raw.replace(/^\/objects\//, "")}`
    : raw;
}

interface Props {
  params: { websiteUid: string };
  kind: PageKind;
}

export default function TenantPublicPage({ params, kind }: Props) {
  const { websiteUid } = params;
  const { data: site, isLoading } = useQuery({
    queryKey: ["public-info", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });

  useEffect(() => {
    if (!site) return;
    applyWebsiteMeta({
      name: site.name,
      primaryColor: site.primaryColor ?? null,
      logoUrl: site.logoUrl ?? null,
    });
    return () => resetWebsiteMeta();
  }, [site?.name, site?.primaryColor, site?.logoUrl]);

  if (!site) {
    return (
      <div className="min-h-screen bg-[#06090f] text-slate-400 flex items-center justify-center px-6">
        {isLoading ? "Loading…" : "This website link is invalid or has been removed."}
      </div>
    );
  }

  const cfg = getTemplateConfig(site.type, site.capabilities);
  const primary = site.primaryColor ?? "#2563eb";
  const name = site.name ?? UNAVAILABLE;
  const contactEmail = site.supportEmail ?? site.companyEmail ?? "";

  return (
    <div className="min-h-screen bg-[#06090f] text-white">
      <header className="border-b border-white/[0.07] sticky top-0 z-50 backdrop-blur-md bg-[#06090f]/90">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href={`/site/${websiteUid}`} className="flex items-center gap-3 min-w-0">
            {logoUrl(site.logoUrl) ? (
              site.type === "tracking"
                ? <img src={logoUrl(site.logoUrl) ?? ""} alt={name} className="w-9 h-9 rounded-xl object-contain shrink-0" style={{ backgroundColor: `${primary}22` }} />
                : <WebsiteLogo src={logoUrl(site.logoUrl) ?? ""} alt={name} size={36} style={{ backgroundColor: `${primary}22` }} />
            ) : (
              <span className={`w-9 h-9 ${site.type === "tracking" ? "rounded-xl" : "rounded-full"} flex items-center justify-center font-bold shrink-0`} style={{ backgroundColor: primary }}>
                {name.charAt(0)}
              </span>
            )}
            <span className="font-semibold truncate">{name}</span>
          </Link>
          <Link href={`/site/${websiteUid}`} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to website
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        {kind === "about" ? (
          <>
            <div className="max-w-3xl mb-14">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: `${primary}22` }}>
                <Building2 className="w-6 h-6" style={{ color: primary }} />
              </div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: primary }}>About {name}</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">About {name}</h1>
              {site.businessDescription?.trim() && (
                <p className="text-lg text-slate-400 leading-relaxed">{site.businessDescription.trim()}</p>
              )}
            </div>
            {(site.ceoName || site.launchDate || site.officeLocation || site.companyAddress || contactEmail) && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <h2 className="text-xl font-semibold mb-5">Company information</h2>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  {site.ceoName && <p className="text-slate-400">Leadership <strong className="text-white block mt-1">{site.ceoName}</strong></p>}
                  {site.launchDate && <p className="text-slate-400">Creation date <strong className="text-white block mt-1">{site.launchDate}</strong></p>}
                  {(site.officeLocation || site.companyAddress) && <p className="text-slate-400">Location <strong className="text-white block mt-1">{site.officeLocation || site.companyAddress}</strong></p>}
                  {contactEmail && <p className="text-slate-400">Contact <strong className="block mt-1">
                    {contactEmail.includes("@")
                      ? <a className="underline" style={{ color: primary }} href={`mailto:${contactEmail}`}>{contactEmail}</a>
                      : contactEmail}
                  </strong></p>}
                </div>
              </div>
            )}
          </>
        ) : cfg.type === "tracking" ? (
          <TrackingBlogContent siteName={name} primary={primary} />
        ) : (
          <>
            <div className="max-w-3xl mb-12">
              <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: primary }}>From {name}</p>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">News and insights</h1>
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>{formatWebsiteCopyright(name, site.launchDate, site.createdAt)}</span>
          <div className="flex items-center gap-4">
            <Link href={`/site/${websiteUid}/about`} className="hover:text-white">About</Link>
            <Link href={`/site/${websiteUid}/blog`} className="hover:text-white">Blog</Link>
            <Link href={`/site/${websiteUid}/privacy`} className="hover:text-white">Privacy</Link>
            <Link href={`/site/${websiteUid}/terms`} className="hover:text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}