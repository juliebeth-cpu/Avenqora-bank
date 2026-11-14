import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setBankingAdminRegion, useBankingAdminRegion } from "@/lib/banking-admin-region";
import { PortalNoIndex } from "@/components/portal-no-index";
import WebsiteLogo from "@/components/website-logo";

/**
 * Convert a raw object-storage path (e.g. /objects/uploads/<uuid>) to the
 * public logo-serve URL (/api/public/logo-objects/uploads/<uuid>).
 * External URLs (https://…) are returned unchanged.
 */
function buildLogoUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("/objects/")) {
    return `/api/public/logo-objects/${rawUrl.replace(/^\/objects\//, "")}`;
  }
  return rawUrl;
}
import { Link, useLocation } from "wouter";
import { usePortalAuth } from "@/lib/portal-auth";
import {
  LayoutDashboard, CreditCard, HeadphonesIcon, Package, LogOut,
  Menu, X, Users, ArrowDownCircle, ArrowUpCircle,
  ArrowLeftRight, Fingerprint, Settings, Building2, Layers,
  DollarSign, Tag, Bell, Sun, Plane, Shield, TrendingUp, Landmark, Activity, Globe,
  Video, Receipt, GitBranch, ClipboardCheck, PanelLeft, Files, Calculator,
  WandSparkles, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTemplateConfig, getServiceSignIcon, isGenericTemplate } from "@/lib/template-registry";
import { getServiceWorkflow } from "@/lib/service-workflows";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { makeTheme } from "@/lib/make-theme";

interface Props { children: React.ReactNode }

export default function PortalLayout({ children }: Props) {
  const { admin, logout } = usePortalAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const bankingRegion = useBankingAdminRegion();
  const queryClient = useQueryClient();

  const theme = useMemo(
    () => makeTheme(admin?.primaryColor ?? "#1a56db"),
    [admin?.primaryColor],
  );

  if (!admin) return null;
  const uid = admin.websiteUid;
  const cfg = getTemplateConfig(admin.websiteType, admin.capabilities);
  const workflow = getServiceWorkflow(admin.websiteType);

  const baseItems = [
    {
      href: admin.websiteType === "banking"
        ? `/portal/${uid}/banking/dashboard`
        : `/portal/${uid}/dashboard`,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
  ];

  const trackingItems = (admin.websiteType === "tracking" || admin.websiteType === "logistics")
    && admin.capabilities?.customerFeatures?.includes("tracking") ? [
    { href: `/portal/${uid}/shipments`,       label: "Shipments",       icon: Package },
    { href: `/portal/${uid}/payment-settings`, label: "Payment Settings", icon: DollarSign },
    { href: `/portal/${uid}/custom-statuses`, label: "Custom Statuses", icon: Tag },
  ] : [];

  const genericItems = isGenericTemplate(admin.websiteType) && admin.capabilities?.customerAccounts && admin.capabilities.recordCategory ? [
    ...(admin.capabilities?.adminFeatures?.includes("customers")
      ? [{ href: `/portal/${uid}/generic/customers`, label: "Customers", icon: Users }]
      : []),
    { href: `/portal/${uid}/generic/records`, label: workflow ? `${workflow.label} operations` : cfg.recordLabelPlural, icon: Layers },
    ...(admin.capabilities?.kycSupported
      ? [{ href: `/portal/${uid}/generic/kyc`, label: "KYC", icon: Fingerprint }]
      : []),
  ] : [];

  const investmentItems = admin.websiteType === "investment" ? [
    { href: `/portal/${uid}/investment/plans`,        label: "Investment Plans", icon: Layers },
    { href: `/portal/${uid}/investment/real-estate`,  label: "Real Estate",      icon: Building2 },
    { href: `/portal/${uid}/investment/customers`,    label: "Customers",        icon: Users },
    { href: `/portal/${uid}/investment/kyc`,           label: "KYC",              icon: Fingerprint },
    { href: `/portal/${uid}/investment/investments`,  label: "Investments",      icon: ArrowLeftRight },
    { href: `/portal/${uid}/investment/deposits`,     label: "Deposits",         icon: ArrowDownCircle },
    { href: `/portal/${uid}/investment/withdrawals`,  label: "Withdrawals",      icon: ArrowUpCircle },
    { href: `/portal/${uid}/investment/crypto-wallets`, label: "Crypto Wallets",  icon: DollarSign },
    { href: `/portal/${uid}/investment/referrals`,    label: "Referrals",         icon: GitBranch },
    { href: `/portal/${uid}/receipts`,                label: "Receipts",          icon: Receipt },
  ] : [];

  const bankingItems = admin.websiteType === "banking" && admin.capabilities?.accountNumber ? [
    { href: `/portal/${uid}/banking/customers`,   label: "Customers",  icon: Users },
    { href: `/portal/${uid}/banking/accounts`,    label: "Accounts",   icon: Building2 },
    { href: `/portal/${uid}/banking/transactions`, label: "Transactions", icon: Activity },
    { href: `/portal/${uid}/banking/deposits`,    label: "Deposits",   icon: ArrowDownCircle },
    { href: `/portal/${uid}/banking/withdrawals`, label: "Withdrawals",icon: ArrowUpCircle },
    { href: `/portal/${uid}/banking/transfers`,   label: "Transfers",  icon: ArrowLeftRight },
    { href: `/portal/${uid}/banking/approvals`,   label: "Approvals",  icon: ClipboardCheck },
    { href: `/portal/${uid}/banking/kyc`,         label: "KYC",        icon: Fingerprint },
    { href: `/portal/${uid}/banking/cards`,       label: "Bank Cards", icon: CreditCard },
    { href: `/portal/${uid}/banking/loans`,       label: "Loans",      icon: Landmark },
    { href: `/portal/${uid}/banking/regions`,     label: "Regional Management", icon: Globe },
    { href: `/portal/${uid}/banking/customer-services`, label: "Customer actions & messages", icon: ClipboardCheck },
    { href: `/portal/${uid}/receipts`,            label: "Receipts",   icon: Receipt },
    { href: `/portal/${uid}/banking/analytics`,   label: "Reports & Analytics", icon: Activity },
    { href: `/portal/${uid}/banking/audit-logs`,  label: "Audit Logs", icon: ClipboardCheck },
    { href: `/portal/${uid}/banking/settings`,    label: "Settings",   icon: Settings },
  ] : [];

  const promoVideoItem = [
    { href: `/portal/${uid}/promotional-video`, label: "Promotional Video", icon: Video },
  ];

  const teamReviewItem = admin.capabilities?.teamReview === true
    ? [{ href: `/portal/${uid}/team-review`, label: "Team Review", icon: ClipboardCheck }]
    : [];

  const bottomItems = [
    { href: `/portal/${uid}/support`,      label: "Customer Support", icon: HeadphonesIcon },
    { href: `/portal/${uid}/security`,     label: "Security",         icon: Shield },
    { href: `/portal/${uid}/email-settings`, label: "Email & Notifications", icon: Bell },
  ];

  const navItems = [
    ...baseItems,
    ...trackingItems,
    ...bankingItems,
    ...investmentItems,
    ...genericItems,
    ...promoVideoItem,
    ...teamReviewItem,
    ...bottomItems,
  ];

  const isPackageTracking = admin.websiteType === "tracking";
  const trackingSidebarSections = [
    {
      label: "Workspace",
      items: [
        { href: `/portal/${uid}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
        { href: `/portal/${uid}/templates`, label: "Templates (6)", icon: Layers },
        // These links keep the portal connected to the existing public website
        // and theme surfaces without creating parallel editor systems.
        { href: `/site/${uid}`, label: "Page Editor", icon: PanelLeft },
        { href: `/site/${uid}`, label: "My Pages", icon: Files },
      ],
    },
    {
      label: "Shipments",
      items: [
        { href: `/portal/${uid}/shipments`, label: "Shipments", icon: Package },
        { href: `/track/${uid}`, label: "Tracking Widget", icon: Package },
        // Shipment labels/receipts are generated from the persistent shipment
        // record and its detail actions, not from the financial receipts list.
        { href: `/portal/${uid}/shipments`, label: "Label Generator", icon: Receipt },
        { href: `/portal/${uid}/subscription`, label: "Billing", icon: CreditCard },
        { href: `/portal/${uid}/payment-settings`, label: "Payments", icon: DollarSign },
      ],
    },
    {
      label: "Customize",
      items: [
        { href: `/site/${uid}`, label: "Page Styler", icon: Sun },
        { href: `/portal/${uid}/shipments`, label: "Rate Calculators", icon: Calculator },
        { href: `/portal/${uid}/promotional-video`, label: "Quotes & Animations", icon: WandSparkles },
        { href: `/portal/${uid}/custom-statuses`, label: "Tag Generator", icon: Tag },
      ],
    },
    {
      label: "Account",
      items: [
        { href: `/portal/${uid}/support`, label: "Support", icon: HeadphonesIcon },
        { href: `/portal/${uid}/dashboard`, label: "Analytics", icon: Activity },
        { href: `/portal/${uid}/security`, label: "Settings", icon: Settings },
      ],
    },
    {
      label: "Live Chat",
      items: [
        { href: `/portal/${uid}/support`, label: "Chat Inbox", icon: MessageCircle },
      ],
    },
  ];

  const handleLogout = () => { logout(); navigate(`/portal/${uid}/login`); };

  const SiteIcon = getServiceSignIcon(admin.websiteType);

  const initials =
    [admin.firstName, admin.lastName].filter(Boolean).map(n => n[0].toUpperCase()).join("") ||
    admin.username?.substring(0, 2).toUpperCase() ||
    "WA";

  const Sidebar = () => (
    <aside
      className="flex flex-col h-full w-[260px] border-r"
      style={{ background: theme.sidebarBg, borderColor: theme.accentBorder }}
    >
      {/* Site header */}
      <div
        className="px-5 py-5 flex items-center justify-between border-b"
        style={{ borderColor: theme.accentBorder }}
      >
        <div className="flex items-center gap-3">
          {admin.logoUrl
            ? isPackageTracking
              ? <img src={buildLogoUrl(admin.logoUrl) ?? ""} alt={admin.websiteName} className="w-10 h-10 rounded-xl object-contain flex-shrink-0" style={{ background: theme.accentLight }} />
              : <WebsiteLogo src={buildLogoUrl(admin.logoUrl) ?? ""} alt={admin.websiteName} size={40} style={{ background: theme.accentLight }} />
            : <div className="w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0" style={{ background: theme.accentLight, borderColor: theme.accentMid, color: theme.accent }}>
                <SiteIcon className="w-5 h-5" />
              </div>
          }
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{admin.websiteName}</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-semibold mt-0.5 capitalize">
              {admin.websiteType} platform
            </p>
          </div>
        </div>
        <button className="lg:hidden text-slate-500 hover:text-white ml-2 flex-shrink-0" onClick={() => setMobileOpen(false)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {(isPackageTracking ? trackingSidebarSections : [{ label: "Main Menu", items: navItems }]).map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-3 mb-2">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = location === href || location.startsWith(href + "/");
                return (
                  <li key={`${section.label}-${label}`}>
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        active ? "text-white" : "text-slate-400 hover:text-white",
                      )}
                      style={active
                        ? { background: theme.accent }
                        : undefined
                      }
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = theme.accentLight; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = ""; }}
                    >
                      <Icon className={cn("w-[17px] h-[17px] flex-shrink-0", active ? "text-white" : "opacity-60")} />
                      <span className="flex-1">{label}</span>
                      {active && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#fbbf24" }} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: theme.accentBorder }}>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border flex-shrink-0" style={{ borderColor: theme.accentMid }}>
            <AvatarFallback
              className="text-sm font-bold"
              style={{ background: theme.accentLight, color: theme.accent }}
            >
              {isPackageTracking ? "DA" : initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{isPackageTracking ? "DA" : `${admin.firstName} ${admin.lastName}`}</p>
            <p className="text-slate-500 text-xs capitalize truncate">{isPackageTracking ? "Site operator" : admin.role}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0" title="Logout">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100dvh] flex" style={{ background: "#060d1a" }}>
      <PortalNoIndex />
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full"><Sidebar /></div>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-[100dvh] min-w-0">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0"
          style={{ background: theme.headerBg, borderColor: theme.accentBorder }}
        >
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-400 hover:text-white transition-colors" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-white font-semibold text-sm lg:hidden truncate">{admin.websiteName}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {admin.websiteType === "banking" && (
              <label className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs text-slate-400" style={{ borderColor: theme.accentBorder }}>
                <span className="hidden sm:inline">Region</span>
                <select
                  aria-label="Filter banking records by region"
                  data-testid="select-banking-region"
                  value={bankingRegion}
                  onChange={(event) => {
                    const nextRegion = event.target.value as "ALL" | "USA" | "EUROPE";
                    setBankingAdminRegion(nextRegion);
                    void queryClient.invalidateQueries();
                  }}
                  className="bg-transparent font-medium text-slate-100 outline-none"
                >
                  <option value="ALL" className="bg-slate-900">All regions</option>
                  <option value="USA" className="bg-slate-900">USA</option>
                  <option value="EUROPE" className="bg-slate-900">Europe</option>
                </select>
              </label>
            )}
            <button className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all">
              <Sun className="w-5 h-5" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/5 transition-all relative">
              <Bell className="w-5 h-5" />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
                style={{ background: theme.accent, borderColor: theme.headerBg }}
              />
            </button>
            <Avatar className="h-9 w-9 border cursor-pointer" style={{ borderColor: theme.accentMid }}>
              <AvatarFallback
                className="text-white text-sm font-bold"
                style={{ background: theme.accent }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="flex-1 overflow-auto text-white">
          {children}
        </main>
      </div>
    </div>
  );
}
