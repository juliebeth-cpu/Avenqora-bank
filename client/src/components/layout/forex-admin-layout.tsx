import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { usePortalAuth } from "@/lib/portal-auth";
import {
  ArrowDownCircle, ArrowUpCircle, BarChart2, Bell, Bot, BriefcaseBusiness, CreditCard,
  CalendarDays, ChartCandlestick, ChevronRight, CircleDollarSign, ClipboardList,
  Coins, ContactRound, Copy, FileArchive, Fingerprint, GraduationCap, Landmark,
  LayoutDashboard, Link2, LogOut, Mail, Menu, MessageCircle,
  Network, Newspaper, Palette, PanelTop, Pickaxe, Rocket, ScanLine, Settings,
  ShieldCheck, ShoppingBag, Signal, SlidersHorizontal, Ticket, TrendingUp, Users, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { makeTheme } from "@/lib/make-theme";

interface Props { children: React.ReactNode; websiteUid: string; websiteName?: string }
interface NavItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}
interface NavSection { label: string; items: NavItem[] }

export default function ForexAdminLayout({ children, websiteUid, websiteName }: Props) {
  const { admin, logout } = usePortalAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useMemo(() => makeTheme(admin?.primaryColor ?? "#2563eb"), [admin?.primaryColor]);

  if (!admin) return null;

  const base = `/portal/${websiteUid}`;

  const sections: NavSection[] = [
    {
      label: "Dashboard",
      items: [
        { href: `${base}/dashboard`, label: "Overview", icon: LayoutDashboard },
      ],
    },
    {
      label: "User Management",
      items: [
        { href: `${base}/forex/customers`, label: "Users", icon: Users },
        { href: `${base}/forex/kyc`, label: "Verifications (KYC)", icon: Fingerprint },
        { label: "Connected Wallets", icon: Link2, disabled: true },
        { label: "Import", icon: FileArchive, disabled: true },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: `${base}/forex/deposits`, label: "Deposits", icon: ArrowDownCircle },
        { href: `${base}/forex/withdrawals`, label: "Withdrawals", icon: ArrowUpCircle },
        { href: `${base}/payment-settings`, label: "Payment Methods", icon: CircleDollarSign },
        { href: `${base}/forex/crypto-wallets`, label: "Crypto Assets", icon: Wallet },
      ],
    },
    {
      label: "Trading",
      items: [
        { label: "Instruments", icon: ChartCandlestick, disabled: true },
        { href: `${base}/forex/trades`, label: "Trades", icon: TrendingUp },
        { label: "Plans", icon: SlidersHorizontal, disabled: true },
        { label: "Copy Trading", icon: Copy, disabled: true },
        { label: "Signals", icon: Signal, disabled: true },
        { label: "Loans", icon: Landmark, disabled: true },
        { label: "Bots", icon: Bot, disabled: true },
        { label: "Mining", icon: Pickaxe, disabled: true },
        { label: "Real Estate", icon: BriefcaseBusiness, disabled: true },
        { label: "Pre-IPO", icon: Rocket, disabled: true },
        { label: "NFTs", icon: Coins, disabled: true },
        { label: "Cards", icon: CreditCard, disabled: true },
        { label: "Managed Accounts", icon: Network, disabled: true },
      ],
    },
    {
      label: "Engagement",
      items: [
        { label: "Courses", icon: GraduationCap, disabled: true },
        { label: "Membership", icon: ShieldCheck, disabled: true },
        { label: "Referrals", icon: Users, disabled: true },
        { label: "Broadcast", icon: Newspaper, disabled: true },
        { href: `${base}/support`, label: "Chat", icon: MessageCircle },
        { label: "Support tickets", icon: Ticket, disabled: true },
      ],
    },
    {
      label: "CRM",
      items: [
        { label: "Agents", icon: ContactRound, disabled: true },
        { label: "Leads", icon: ScanLine, disabled: true },
        { label: "Tasks", icon: ClipboardList, disabled: true },
        { label: "Calendar", icon: CalendarDays, disabled: true },
      ],
    },
    {
      label: "Configuration",
      items: [
        { href: `${base}/subscription`, label: "Programme", icon: Settings },
        { href: `${base}/email-settings`, label: "Notifications", icon: Bell },
        { label: "Appearance", icon: Palette, disabled: true },
        { label: "Website", icon: PanelTop, disabled: true },
        { label: "Assets", icon: ShoppingBag, disabled: true },
        { label: "Email sending", icon: Mail, disabled: true },
        { href: `${base}/security`, label: "Account security", icon: ShieldCheck },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate(`${base}/login`);
  };

  const initials = [admin.firstName, admin.lastName].filter(Boolean).map(n => n[0].toUpperCase()).join("") || "A";

  const Sidebar = () => (
    <aside className="flex flex-col h-full w-64" style={{ background: "#0b1220", borderColor: theme.accentBorder }}>
      <div className="p-5 border-b" style={{ borderColor: theme.accentBorder }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ background: theme.accentLight, borderColor: theme.accentMid }}>
            <BarChart2 className="w-5 h-5" style={{ color: theme.accent }} />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{websiteName ?? "Forex Admin"}</p>
            <p className="text-slate-500 text-xs">Admin Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, disabled }) => {
                const active = !disabled && !!href && (location === href || location.startsWith(href + "/"));
                const item = (
                    <span
                    title={disabled ? "This feature is not enabled for Forex" : undefined}
                    aria-disabled={disabled || undefined}
                      style={active ? { background: theme.accent, color: "#fff", boxShadow: `0 8px 20px rgba(${theme.accentRgb},0.2)` } : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      disabled
                        ? "cursor-not-allowed text-slate-700"
                        : active
                          ? "border border-transparent"
                          : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
                  </span>
                );
                return (
                  <li key={label}>
                    {disabled || !href ? item : (
                      <Link href={href} onClick={() => setMobileOpen(false)}>
                        {item}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t space-y-2" style={{ borderColor: theme.accentBorder }}>
        <div className="px-3 py-2.5 rounded-lg bg-slate-800/60">
          <p className="text-white text-sm font-medium">{admin.firstName} {admin.lastName}</p>
          <p className="text-slate-500 text-xs">{admin.username}</p>
        </div>
          <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100dvh] bg-[#080f1d] flex">
      <div className="hidden lg:flex lg:flex-shrink-0"><Sidebar /></div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 h-full"><Sidebar /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-h-[100dvh] min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#0b1220", borderColor: theme.accentBorder }}>
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-white font-semibold text-sm">{websiteName ?? "Forex Admin"}</span>
        </header>
        <header className="hidden lg:flex items-center justify-between h-14 px-6 border-b" style={{ background: "#111a2a", borderColor: theme.accentBorder }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: theme.accent, color: "#fff" }}>
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-white text-sm font-semibold truncate">{websiteName ?? "Forex Admin"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-widest" style={{ background: theme.accentLight, color: theme.accent }}>Admin</span>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: theme.accent }}>
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto text-white">{children}</main>
      </div>
    </div>
  );
}
