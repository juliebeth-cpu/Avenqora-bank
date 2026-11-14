import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { makeTheme } from "@/lib/make-theme";
import { cn } from "@/lib/utils";
import { publicInfo } from "@/lib/portal-api";
import { getServiceSignIcon } from "@/lib/template-registry";
import { CircleDot } from "lucide-react";

interface CustomerBranding {
  primaryColor?: string | null;
  logoUrl?: string | null;
}

interface Props {
  /** Pass null for a deliberately neutral loader (master admin and pre-tenant resolution). */
  customer?: CustomerBranding | null;
  websiteType?: string | null;
  websiteUid?: string | null;
  fullScreen?: boolean;
  compact?: boolean;
  label?: string;
  className?: string;
}

function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{3,8}$/i.test(value));
}

/**
 * The shared branded loading primitive used by customer surfaces.
 * It intentionally falls back to slate when tenant metadata has not arrived.
 */
export default function CustomerBrandLoader({
  customer: customerOverride,
  websiteType,
  websiteUid,
  fullScreen = false,
  compact = false,
  label = "Loading",
  className,
}: Props) {
  const { data: siteInfo } = useQuery({
    queryKey: ["customer-brand-loader-site", websiteUid],
    queryFn: () => publicInfo(websiteUid!),
    enabled: Boolean(websiteUid),
    staleTime: 60_000,
  });
  // Customer data is optional branding only. Service identity comes from the
  // explicit canonical type or the server-resolved public website info.
  const customer = customerOverride ?? null;
  const primaryColor = isHexColor(customer?.primaryColor)
    ? customer.primaryColor
    : isHexColor(siteInfo?.primaryColor)
      ? siteInfo.primaryColor
      : null;
  const theme = useMemo(
    () => (primaryColor ? makeTheme(primaryColor) : null),
    [primaryColor],
  );
  const accent = theme?.accent ?? "#94a3b8";
  const resolvedType = websiteType ?? siteInfo?.type;
  const ServiceIcon = resolvedType ? getServiceSignIcon(resolvedType) : CircleDot;
  const rawLogoUrl = customer?.logoUrl ?? siteInfo?.logoUrl ?? null;
  const logoUrl = rawLogoUrl?.startsWith("/objects/")
    ? `/api/public/logo-objects/${rawLogoUrl.replace(/^\/objects\//, "")}`
    : rawLogoUrl;
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl && failedLogoUrl !== logoUrl);
  const isBranded = Boolean(theme);
  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-slate-400",
        compact ? "py-8" : "py-12",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full border",
          compact ? "h-12 w-12" : "h-16 w-16",
        )}
        style={{
          borderColor: `${accent}55`,
          background: isBranded ? `${accent}14` : "rgba(148,163,184,0.08)",
        }}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full border-2 border-transparent animate-spin",
            compact ? "border-t-[3px]" : "border-t-2",
          )}
          style={{ borderTopColor: accent }}
          aria-hidden="true"
        />
        {showLogo ? (
          <img
            src={logoUrl!}
            alt=""
            aria-hidden="true"
            className={cn("relative z-10 object-contain", compact ? "h-6 w-6" : "h-8 w-8")}
            onError={() => setFailedLogoUrl(logoUrl!)}
          />
        ) : (
          <span
            className={cn("relative z-10 leading-none", compact ? "text-xl" : "text-3xl")}
            aria-label={`${resolvedType ?? "neutral"} service`}
          >
            <ServiceIcon className={compact ? "h-5 w-5" : "h-7 w-7"} strokeWidth={1.8} aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="text-xs font-medium tracking-wide">{label}</span>
    </div>
  );

  if (!fullScreen) return content;
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-950 px-6">
      {content}
    </div>
  );
}