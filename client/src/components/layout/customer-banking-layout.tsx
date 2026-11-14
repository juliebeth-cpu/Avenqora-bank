import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useBankingAuth } from "@/lib/banking-auth";
import WebsiteLogo from "@/components/website-logo";
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight,
  FileText, CreditCard, Bell, User, Shield, LogOut, Menu, MessageSquare,
  ChevronRight, Building2, Users, Landmark, FileBarChart, Settings, Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { makeTheme } from "@/lib/make-theme";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";
import { useCustomerLocalization } from "@/lib/customer-localization";
import { getBankingRegionalConfig } from "@/lib/banking-region";
import { useQuery } from "@tanstack/react-query";
import { publicInfo } from "@/lib/portal-api";
import { useWebsiteTheme } from "@/lib/website-theme";

interface Props {
  children: React.ReactNode;
  websiteUid: string;
  websiteName?: string;
  appearance?: "dark" | "banking";
}

export default function CustomerBankingLayout({ children, websiteUid, websiteName, appearance = "dark" }: Props) {
  const { customer, logout } = useBankingAuth();
  const { mode } = useWebsiteTheme();
  const { t } = useCustomerLocalization();
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const brandQuery = useQuery({
    queryKey: ["website-theme", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });
  const brand = brandQuery.data as { name?: string; logoUrl?: string | null; primaryColor?: string | null } | undefined;
  const bankName = String(websiteName ?? brand?.name ?? "").trim();
  const brandLogo = brand?.logoUrl || customer?.logoUrl;

  const theme = useMemo(
    () => makeTheme(brand?.primaryColor ?? customer?.primaryColor ?? "#2563eb"),
    [brand?.primaryColor, customer?.primaryColor],
  );
  const regional = useMemo(() => getBankingRegionalConfig(customer), [customer]);

  if (!customer) return <CustomerBrandLoader websiteUid={websiteUid} fullScreen label="Loading customer portal" />;

  const base = `/banking/${websiteUid}`;

  const navItems = [
    { href: `${base}/dashboard`,     label: regional.primaryNavLabel, icon: LayoutDashboard },
    { href: `${base}/deposit`,       label: t("Deposit"),       icon: ArrowDownCircle },
    { href: `${base}/withdraw`,      label: t("Withdraw"),      icon: ArrowUpCircle },
    { href: `${base}/transfer`,      label: t("Transfer"),      icon: ArrowLeftRight },
    { href: `${base}/transactions`,  label: regional.activityNavLabel, icon: FileText },
    { href: `${base}/beneficiaries`, label: t("Beneficiaries"), icon: Users },
    { href: `${base}/loans`,         label: t("Loans"),         icon: Landmark },
    { href: `${base}/cards`,         label: t("Bank Cards"),    icon: CreditCard },
    { href: `${base}/credit-score`,  label: "Credit Score",     icon: CreditCard },
    ...(regional.region === "EUROPE"
      ? [{ href: `${base}/messages`, label: "Customer Service", icon: MessageSquare }]
      : []),
    { href: `${base}/receipts`,      label: t("Receipts"),      icon: Receipt },
    { href: `${base}/statements`,    label: t("Statements"),    icon: FileBarChart },
    { href: `${base}/kyc`,           label: t("Verification"),  icon: Shield },
    { href: `${base}/notifications`, label: t("Notifications"), icon: Bell },
    { href: `${base}/profile`,       label: t("Profile"),       icon: User },
    { href: `${base}/settings`,      label: t("Settings"),      icon: Settings },
  ];

  const bottomNavItems = [
    { href: `${base}/dashboard`, label: "Accounts", icon: LayoutDashboard },
    { href: `${base}/transactions`, label: "Payments", icon: ArrowLeftRight },
    { href: `${base}/credit-score`, label: "Credit Score", icon: CreditCard },
    { href: `${base}/loans`, label: "Plan", icon: Landmark },
  ];

  const handleLogout = () => {
    logout();
    navigate(`${base}/login`);
  };

  return (
    <div
      className="customer-banking-shell min-h-[100dvh]"
      data-mode={mode}
      style={{ "--bank-primary": theme.accent } as React.CSSProperties}
    >
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: mode === "light" ? "#ffffff" : "#182630",
          borderColor: mode === "light" ? "#e1e7eb" : "#31414b",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href={`${base}/dashboard`}
            className="flex min-w-0 items-center gap-3"
            aria-label={bankName || t("Dashboard")}
            data-testid="link-banking-brand-home"
          >
            {brandLogo ? (
              <WebsiteLogo src={brandLogo} alt={bankName} size={36} />
            ) : (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  color: "#ffffff",
                  background: theme.accent,
                }}
              >
                <Building2 className="h-5 w-5" />
              </span>
            )}
            {bankName && <span className="min-w-0">
              <span
                className="block truncate text-sm font-semibold text-[var(--bank-text)]"
                data-testid="text-banking-brand"
              >
                {bankName}
              </span>
            </span>}
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`${base}/profile`}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                "text-[var(--bank-muted)] hover:bg-[var(--bank-surface-soft)]",
              )}
              aria-label={t("Profile")}
              data-testid="link-banking-profile"
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-[calc(100dvh-132px)] p-4 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-28 text-[var(--bank-text)]">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t"
        style={{
          background: mode === "light" ? "#ffffff" : "#182630",
          borderColor: mode === "light" ? "#e1e7eb" : "#31414b",
          height: "calc(68px + env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
        aria-label="Banking navigation"
      >
        <div className="mx-auto flex h-full max-w-2xl items-stretch justify-around px-2">
          {bottomNavItems.map(({ href, label, icon: Icon }) => {
            if (!href) return (
              <span
                key={label}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[var(--bank-muted)] opacity-45"
                aria-disabled="true"
                title="Not available"
                data-testid="nav-bottom-credit-score-disabled"
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none">{label}</span>
              </span>
            );
            const active = location === href || location.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors",
                  "text-[var(--bank-muted)]",
                  active && "text-[var(--bank-text)]",
                )}
                aria-current={active ? "page" : undefined}
                data-testid={`link-bottom-nav-${href.split("/").at(-1)}`}
              >
                <Icon className="h-5 w-5" style={{ color: active ? theme.accent : undefined }} />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none">{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-colors",
              "text-[var(--bank-muted)] hover:bg-[var(--bank-surface-soft)]",
              menuOpen && "text-[var(--bank-text)]",
            )}
            aria-expanded={menuOpen}
            aria-controls="banking-more-menu"
            data-testid="button-banking-more-menu"
          >
            <Menu className="h-5 w-5" style={{ color: menuOpen ? theme.accent : undefined }} />
            <span className="text-[10px] font-semibold leading-none">Menu</span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50" data-testid="overlay-banking-menu">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35"
            aria-label={t("Close menu")}
            onClick={() => setMenuOpen(false)}
          />
          <section
            id="banking-more-menu"
            className={cn(
              "absolute bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 right-3 mx-auto max-h-[70dvh] max-w-xl overflow-y-auto rounded-2xl border p-4 shadow-2xl",
              "border-[var(--bank-line)] bg-[var(--bank-surface)] text-[var(--bank-text)]",
            )}
            aria-label="More banking features"
          >
            <div className="mb-3 border-b border-[var(--bank-line)] pb-3">
              <p className="font-semibold">{customer.firstName} {customer.lastName}</p>
              <p className="mt-0.5 text-xs text-[var(--bank-muted)]">{customer.username}</p>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = location === href || location.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
                      "hover:bg-[var(--bank-surface-soft)]",
                      active && "bg-[var(--bank-surface-soft)]",
                    )}
                    aria-current={active ? "page" : undefined}
                    data-testid={`link-menu-${href.split("/").at(-1)}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {active && <ChevronRight className="h-4 w-4 shrink-0" />}
                  </Link>
                );
              })}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                "mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl border-t px-3 pt-3 text-sm font-medium",
                "border-[var(--bank-line)] text-rose-700 dark:text-rose-300",
              )}
              data-testid="button-banking-logout"
            >
              <LogOut className="h-4 w-4" /> {t("Logout")}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
