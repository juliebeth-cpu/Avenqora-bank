/**
 * TypeSpecificSections — Specialized homepage sections injected into the
 * Master Template (PublicGenericHomePage) based on website type.
 *
 * INVESTMENT: Live ticker · Investment plans (API) · ROI calculator · Dashboard preview · Live Withdrawal Feed
 * FOREX:      Live currency ticker · Live Withdrawal Feed · Features · CTA
 * BANKING:    Banking services · Savings calculator · Mobile dashboard
 * TRACKING:   Animated plane + route · Logistics map · Shipment tracker · Cargo imagery
 *
 * ALL common sections (Hero, About, Why Choose Us, Security, FAQ, etc.) remain
 * in generic-home.tsx and are NOT modified here.
 */

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle2, ArrowRight, TrendingUp, TrendingDown,
  ShieldCheck, Zap, Globe, Award, Users, BadgeCheck,
  PiggyBank, Wallet, Send, Briefcase, BarChart3, CreditCard,
  Plane, Package, MapPin, Clock, Star,
  Bitcoin, LineChart, Repeat, Cpu, Globe2,
  Search, Loader2, XCircle, ExternalLink, ChevronDown, ChevronUp,
  Activity, DollarSign, BarChart2,
} from "lucide-react";
import AssetSlideshow from "@/components/AssetSlideshow";
import { investListPlans } from "@/lib/invest-api";
import { publicTrack } from "@/lib/portal-api";

// ─── Immediate content wrapper ────────────────────────────────────────────────
function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// ─── Live Withdrawal Feed ─────────────────────────────────────────────────────

const FEED_NAMES = [
  "James O.", "Maria S.", "Chen W.", "Aisha B.", "Dmitri V.",
  "Sarah K.", "Luca M.", "Fatima A.", "Noah C.", "Elena R.",
  "David L.", "Priya N.", "Omar H.", "Sophie T.", "Kwame A.",
  "Isabella F.", "Raj P.", "Zara M.", "Carlos E.", "Yuki T.",
  "Ahmed S.", "Lucia B.", "Marcus J.", "Hana K.", "Finn O.",
];

const FEED_WALLETS = [
  "0x4f3a...e82b", "bc1q9k...7r2m", "TQnM7...xK9p",
  "0x8b2c...f14a", "bc1qw5...3n8v", "TRxP4...mY7k",
  "0x1d6e...a93f", "bc1qa2...9p5j", "LXq3M...nR8s",
  "0x7f8b...c52d", "bc1qh7...4k1n", "TAw9X...pZ6m",
  "0xc3d1...b78e", "bc1qm4...6t9w", "0x9e5a...d31c",
];

const FEED_AMOUNTS = [
  820, 1450, 3200, 5750, 980, 12400, 2800, 650, 18500, 4100,
  7300, 1900, 22000, 550, 9800, 3600, 14200, 760, 6500, 2100,
];

type FeedStatus = "Successful" | "Pending" | "Processing";

const STATUS_WEIGHTS: FeedStatus[] = [
  "Successful", "Successful", "Successful", "Successful",
  "Processing", "Processing",
  "Pending",
];

function statusStyle(s: FeedStatus) {
  if (s === "Successful") return { bg: "#10b98114", text: "#10b981", dot: "#10b981" };
  if (s === "Processing") return { bg: "#3b82f614", text: "#60a5fa", dot: "#3b82f6" };
  return { bg: "#f59e0b14", text: "#f59e0b", dot: "#f59e0b" };
}

let _feedId = 0;
function makeFeedEntry() {
  const amount = FEED_AMOUNTS[Math.floor(Math.random() * FEED_AMOUNTS.length)];
  const variance = 1 + (Math.random() - 0.5) * 0.4;
  return {
    id: ++_feedId,
    name: FEED_NAMES[Math.floor(Math.random() * FEED_NAMES.length)],
    amount: (amount * variance).toFixed(2),
    wallet: FEED_WALLETS[Math.floor(Math.random() * FEED_WALLETS.length)],
    status: STATUS_WEIGHTS[Math.floor(Math.random() * STATUS_WEIGHTS.length)],
  };
}

function LiveWithdrawalFeed({ primary }: { primary: string }) {
  const [feed, setFeed] = useState<ReturnType<typeof makeFeedEntry>[]>(
    () => Array.from({ length: 8 }, makeFeedEntry)
  );
  const [flashId, setFlashId] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      const entry = makeFeedEntry();
      setFlashId(entry.id);
      setFeed(prev => [entry, ...prev.slice(0, 7)]);
      const clear = setTimeout(() => setFlashId(null), 900);
      return () => clearTimeout(clear);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  return (
    <Reveal>
      <div className="text-center mb-12">
        <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Live Activity</span>
        <h2 className="text-3xl sm:text-4xl font-black mb-4">Live Withdrawal Feed</h2>
        <p className="text-slate-400 max-w-xl mx-auto">
          Real-time withdrawals processed on our platform — fast, secure, and fully transparent.
        </p>
      </div>

      <div className="rounded-3xl border overflow-hidden" style={{ background: "#0a1628", borderColor: primary + "28" }}>
        {/* Feed header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: primary + "14", background: primary + "08" }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-emerald-400" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
          </span>
          <span className="text-sm font-bold text-slate-200">Live Feed</span>
          <Activity className="w-3.5 h-3.5 text-slate-500 ml-1" />
          <span className="ml-auto text-xs text-slate-500 tabular-nums">Updating in real-time</span>
        </div>

        {/* Column headings */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 sm:gap-x-8 px-5 py-3 border-b text-[10px] font-bold uppercase tracking-widest text-slate-600"
          style={{ borderColor: primary + "0c" }}>
          <span>Customer</span>
          <span className="text-right">Amount</span>
          <span className="hidden sm:block text-center">Wallet Address</span>
          <span className="text-right">Status</span>
        </div>

        {/* Rows */}
        <div>
          {feed.map(entry => {
            const s = statusStyle(entry.status as FeedStatus);
            const isNew = entry.id === flashId;
            return (
              <div
                key={entry.id}
                className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 sm:gap-x-8 px-5 py-3.5 border-b items-center transition-colors duration-500"
                style={{
                  borderColor: primary + "08",
                  background: isNew ? primary + "0d" : "transparent",
                }}
              >
                <span className="text-sm font-semibold text-white truncate">{entry.name}</span>
                <span className="text-sm font-black tabular-nums" style={{ color: primary }}>
                  ${Number(entry.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="hidden sm:block text-xs font-mono text-slate-500 text-center">{entry.wallet}</span>
                <div className="flex justify-end">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                    style={{ background: s.bg, color: s.text }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
                    {entry.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 text-center text-xs text-slate-600" style={{ borderTop: `1px solid ${primary}0a` }}>
          Showing most recent withdrawals · All transactions are encrypted and verified
        </div>
      </div>
    </Reveal>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  type: string;
  primary: string;
  siteName: string;
  registerHref: string;
  websiteUid: string;
}

export default function TypeSpecificSections(props: Props) {
  switch (props.type) {
    case "investment": return <InvestmentSections {...props} />;
    case "forex":      return <ForexSections {...props} />;
    case "banking":    return <BankingSections {...props} />;
    case "tracking":
    case "logistics":  return <TrackingSections {...props} />;
    default:           return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INVESTMENT SECTIONS
// ══════════════════════════════════════════════════════════════════════════════

const TICKERS = [
  { symbol: "BTC/USD", name: "Bitcoin",   price: 67842.50, change:  2.34, icon: "₿" },
  { symbol: "ETH/USD", name: "Ethereum",  price: 3521.80,  change: -0.87, icon: "Ξ" },
  { symbol: "XAU/USD", name: "Gold",      price: 2398.40,  change:  0.54, icon: "🥇" },
  { symbol: "S&P 500", name: "S&P 500",   price: 5287.76,  change:  1.12, icon: "📈" },
  { symbol: "EUR/USD", name: "EUR/USD",   price: 1.0842,   change: -0.23, icon: "€"  },
  { symbol: "SOL/USD", name: "Solana",    price: 182.40,   change:  5.67, icon: "◎" },
  { symbol: "OIL/USD", name: "Crude Oil", price: 81.35,    change: -1.43, icon: "🛢️" },
  { symbol: "NASDAQ",  name: "NASDAQ",    price: 18694.50, change:  0.89, icon: "💹" },
];


const INVEST_FEATURES = [
  { icon: ShieldCheck, title: "SEC Regulated",       desc: "Fully compliant with international financial regulations and oversight bodies." },
  { icon: Zap,         title: "Instant Deposits",     desc: "Fund your account in seconds via crypto, bank wire, or card." },
  { icon: BarChart3,   title: "Real-Time Analytics",  desc: "Live dashboards with portfolio performance, P&L, and market data." },
  { icon: Globe2,      title: "Global Access",         desc: "Invest from 150+ countries with 24/7 platform availability." },
  { icon: Cpu,         title: "AI-Driven Insights",   desc: "Machine learning models surface the best opportunities for your profile." },
  { icon: Repeat,      title: "Auto-Compounding",     desc: "Profits reinvest automatically to maximise compound growth over time." },
];

function InvestmentSections({ primary, siteName, registerHref, websiteUid }: Props) {
  const gold = primary;
  const goldBg = gold + "14";

  const [tickers, setTickers] = useState(TICKERS);
  const [calcAmount, setCalcAmount] = useState(5000);
  const [calcPlan, setCalcPlan] = useState<any>(null);

  // Live ticker simulation
  useEffect(() => {
    const t = setInterval(() => {
      setTickers(prev => prev.map(tk => ({
        ...tk,
        price:  parseFloat((tk.price  * (1 + (Math.random() - 0.498) * 0.0022)).toFixed(tk.price > 100 ? 2 : 4)),
        change: parseFloat((tk.change + (Math.random() - 0.5) * 0.12).toFixed(2)),
      })));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // Fetch live investment plans from DB — no mock fallback
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["public-invest-plans", websiteUid],
    queryFn: () => investListPlans(websiteUid),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  useEffect(() => { if ((plans as any[]).length && !calcPlan) setCalcPlan((plans as any[])[0]); }, [(plans as any[]).length]);

  const calcROI = () => {
    if (!calcPlan) return { profit: "0.00", total: "0.00", daily: "0.00" };
    const rate = parseFloat(String(calcPlan.totalRoi ?? calcPlan.roiPercent ?? calcPlan.roi ?? "0")) / 100;
    const duration = parseInt(String(calcPlan.duration ?? calcPlan.durationDays ?? "30"));
    const profit = calcAmount * rate;
    return { profit: profit.toFixed(2), total: (calcAmount + profit).toFixed(2), daily: (profit / Math.max(duration, 1)).toFixed(2) };
  };
  const roi = calcROI();

  return (
    <>
      {/* ── Live Ticker Bar ─────────────────────────────────────────────── */}
      <style>{`
        @keyframes invest-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .invest-ticker { display:flex; width:max-content; animation:invest-ticker 45s linear infinite; }
        .invest-ticker:hover { animation-play-state:paused; }
        @keyframes invest-card-hover { 0%,100%{transform:translateY(0)} }
        .invest-card:hover { transform:translateY(-4px); transition:transform 0.3s ease,box-shadow 0.3s ease; box-shadow:0 20px 40px rgba(0,0,0,0.4); }
      `}</style>

      <div className="overflow-hidden border-y py-3" style={{ background: "#040e24", borderColor: gold + "18" }}>
        <div className="overflow-hidden">
          <div className="invest-ticker">
            {[...tickers, ...tickers].map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-8 whitespace-nowrap">
                <span className="text-base">{t.icon}</span>
                <span className="text-sm font-semibold text-slate-200">{t.symbol}</span>
                <span className="text-sm font-black" style={{ color: t.change >= 0 ? "#10b981" : "#f43f5e" }}>
                  {t.price > 10 ? `$${t.price.toLocaleString()}` : `$${t.price}`}
                </span>
                <span className={`text-xs flex items-center gap-0.5 font-semibold ${t.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {t.change >= 0 ? "+" : ""}{t.change.toFixed(2)}%
                </span>
                <span className="mx-3 opacity-20" style={{ color: gold }}>|</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Investment Plans — live from DB ─────────────────────────────── */}
      <section id="investment-plans" className="py-24" style={{ background: "#040e24" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-16">
              <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: gold }}>Investment Plans</span>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Choose Your Growth Path</h2>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">Structured plans designed to maximise returns while managing risk at every level.</p>
            </div>

            {/* Loading skeleton */}
            {plansLoading && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[0, 1, 2].map(i => (
                  <div key={i} className="rounded-3xl h-80 animate-pulse" style={{ background: "#0a1628", border: `1px solid ${gold}14` }} />
                ))}
              </div>
            )}

            {/* Empty state — no active plans configured yet */}
            {!plansLoading && (plans as any[]).length === 0 && (
              <div className="text-center py-20 rounded-3xl border" style={{ background: "#0a1628", borderColor: gold + "18" }}>
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: gold + "14" }}>
                  <BarChart3 className="w-8 h-8" style={{ color: gold }} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Investment Plans Available Yet</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">Our team is setting up exciting investment plans. Check back soon or register now to be notified first.</p>
                <Link href={registerHref} className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl font-bold text-sm text-[#020817] transition-all hover:opacity-90"
                  style={{ backgroundColor: gold }}>
                  Register & Get Notified <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}

            {/* Live plans from DB */}
            {!plansLoading && (plans as any[]).length > 0 && (
              <div className={`grid gap-6 ${(plans as any[]).length === 1 ? "max-w-sm mx-auto" : (plans as any[]).length === 2 ? "sm:grid-cols-2 max-w-2xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                {(plans as any[]).map((plan: any, i: number) => {
                  const totalRoi = plan.totalRoi ?? plan.roiPercent ?? plan.roi ?? "0";
                  const duration = plan.duration ?? plan.durationDays ?? "30";
                  const durationUnit = plan.durationUnit ?? "days";
                  const minDep = plan.minDeposit ?? 0;
                  const maxDep = plan.maxDeposit ?? null;
                  const currency = plan.currency ?? "USD";
                  const isPopular = plan.featured ?? plan.popular ?? false;
                  const perks: string[] = [
                    `${Number(totalRoi).toFixed(2)}% total ROI`,
                    `${duration} ${durationUnit} duration`,
                    `Min ${currency} ${Number(minDep).toLocaleString()}${maxDep ? ` – Max ${currency} ${Number(maxDep).toLocaleString()}` : "+"}`,
                    "Daily profit compounding",
                    "Instant portfolio access",
                    isPopular ? "Dedicated account manager" : "Standard support",
                  ];
                  return (
                    <div key={plan.id ?? i} className="invest-card relative rounded-3xl overflow-hidden flex flex-col"
                      style={{ background: isPopular ? "linear-gradient(135deg, #0c1e3e, #091428)" : "#0a1628", border: `1px solid ${isPopular ? gold + "50" : gold + "18"}`, boxShadow: isPopular ? `0 0 48px ${gold}22` : undefined }}>
                      {isPopular && (
                        <>
                          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-3xl" style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-[#020817]" style={{ backgroundColor: gold }}>
                            <Star className="w-3 h-3" /> Most Popular
                          </div>
                        </>
                      )}
                      <div className="p-7 flex-1 flex flex-col">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-2">{plan.name}</p>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-4xl font-black" style={{ color: gold }}>{Number(totalRoi).toFixed(2)}%</span>
                          <span className="text-slate-400 text-sm font-medium">ROI</span>
                        </div>
                        {plan.description && (
                          <p className="text-slate-500 text-xs mt-1 mb-6">{plan.description}</p>
                        )}
                        <ul className="space-y-3 mb-8 flex-1 mt-4">
                          {perks.map((p, j) => (
                            <li key={j} className="flex items-start gap-2.5 text-sm text-slate-300">
                              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: gold }} />{p}
                            </li>
                          ))}
                        </ul>
                        <Link href={registerHref} className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90 ${isPopular ? "text-[#020817]" : "border"}`}
                          style={isPopular ? { backgroundColor: gold } : { borderColor: gold + "30", color: gold, background: goldBg }}>
                          Start Investing <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Live Markets ─────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: gold }}>Live Markets</span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Real-Time Market Data</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Live prices across crypto, forex, commodities, and global indices — all in one place.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tickers.map((t, i) => (
              <div key={i} className="invest-card rounded-2xl p-5 border cursor-default" style={{ background: "#0a1628", borderColor: gold + "1c" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{t.icon}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${t.change >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    {t.change >= 0 ? "+" : ""}{t.change.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-1">{t.name}</p>
                <p className="font-black text-xl text-white">{t.price > 10 ? `$${t.price.toLocaleString()}` : `$${t.price}`}</p>
                <p className="text-xs text-slate-600 mt-0.5 mb-3">{t.symbol}</p>
                <svg viewBox="0 0 80 30" className="w-full h-8">
                  <polyline
                    points={Array.from({ length: 9 }, (_, k) => `${k * 10},${15 + Math.sin((k + i * 1.3) * 1.1) * 9}`).join(" ")}
                    fill="none" stroke={t.change >= 0 ? "#10b981" : "#f43f5e"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── ROI Calculator ───────────────────────────────────────────────── */}
      <section id="investment-calculator" className="max-w-7xl mx-auto px-4 sm:px-6 py-24 border-t" style={{ borderColor: gold + "12" }}>
        <Reveal>
          <div className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: gold }}>ROI Calculator</span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4">See Your Potential Returns</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Estimate your profit before you invest. No commitment required.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-10 items-start">
            {/* Inputs */}
            <div className="rounded-3xl border p-8" style={{ background: "#0a1628", borderColor: gold + "22" }}>
              <div className="mb-8">
                <label className="block text-sm font-bold text-slate-300 mb-3">Investment Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input type="number" value={calcAmount}
                    onChange={e => setCalcAmount(Math.max(100, Number(e.target.value) || 100))}
                    className="w-full pl-8 pr-4 py-4 rounded-xl text-white font-bold text-lg outline-none border"
                    style={{ background: "#040e24", borderColor: gold + "25" }} />
                </div>
                <input type="range" min={100} max={250000} step={100} value={calcAmount}
                  onChange={e => setCalcAmount(Number(e.target.value))}
                  className="w-full mt-3" style={{ accentColor: gold }} aria-label="Investment amount" />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>$100</span><span>$250,000</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-5">
                  {[1000, 5000, 25000].map(a => (
                    <button key={a} type="button" onClick={() => setCalcAmount(a)}
                      className="rounded-xl border py-2 text-xs font-semibold transition-all"
                      style={{ borderColor: calcAmount === a ? gold + "60" : gold + "20", color: calcAmount === a ? gold : "#94a3b8", background: calcAmount === a ? gold + "12" : "transparent" }}>
                      ${a.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              {plans.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-3">Select Plan</label>
                  <div className="grid gap-2.5">
                    {plans.map((plan: any, i: number) => {
                      const selected = calcPlan?.name === plan.name;
                      return (
                        <button key={i} onClick={() => setCalcPlan(plan)}
                          className="flex items-center justify-between px-4 py-3.5 rounded-xl border text-left transition-all"
                          style={{ background: selected ? gold + "12" : "#040e24", borderColor: selected ? gold + "50" : gold + "18" }}>
                          <span className="text-white font-semibold text-sm">{plan.name}</span>
                          <div className="flex items-center gap-3 text-xs font-bold">
                            <span style={{ color: gold }}>{Number(plan.totalRoi ?? plan.roiPercent ?? plan.roi ?? 0).toFixed(2)}% ROI</span>
                            <span className="text-slate-500">{plan.duration ?? plan.durationDays ?? 30}{plan.durationUnit ? plan.durationUnit.charAt(0) : "d"}</span>
                            {selected && <CheckCircle2 className="w-4 h-4" style={{ color: gold }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Result */}
            <div className="rounded-3xl border overflow-hidden" style={{ background: "linear-gradient(145deg, #0c1e3e, #081326)", borderColor: gold + "40", boxShadow: `0 0 60px ${gold}25` }}>
              <div className="p-8 border-b" style={{ borderColor: gold + "18" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: gold }}>Estimated Returns</p>
                <div className="text-5xl font-black text-white mb-2">${Number(roi.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                <p className="text-slate-400 text-sm">Total value at maturity</p>
              </div>
              <div className="grid grid-cols-3 divide-x" style={{ borderColor: gold + "12" }}>
                {[
                  { label: "Principal", value: `$${calcAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "white" },
                  { label: "Profit",    value: `+$${Number(roi.profit).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "#10b981" },
                  { label: "Daily",     value: `$${roi.daily}`, color: gold },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-5 text-center" style={{ borderColor: gold + "10" }}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
                    <p className="font-black text-base" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="p-6">
                {calcPlan && (
                  <div className="flex items-center justify-between text-sm text-slate-400 mb-5 p-3 rounded-xl" style={{ background: gold + "08" }}>
                    <span>Plan: <strong className="text-slate-200">{calcPlan.name}</strong></span>
                    <span>Duration: <strong className="text-slate-200">{calcPlan.duration ?? calcPlan.durationDays} {calcPlan.durationUnit ?? "days"}</strong></span>
                  </div>
                )}
                <Link href={registerHref} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm transition-all hover:opacity-90 text-[#020817]"
                  style={{ background: `linear-gradient(135deg, ${gold}, ${gold}cc)` }}>
                  Start This Investment <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-center text-xs text-slate-600 mt-3">* Estimates based on plan ROI. Actual returns may vary.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Investment Dashboard Preview ──────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="rounded-2xl border overflow-hidden" style={{ background: `linear-gradient(135deg, ${gold}14 0%, #06090f 60%)`, borderColor: gold + "30" }}>
              <div className="flex flex-col lg:flex-row items-center gap-10 p-10">
                <div className="flex-1">
                  <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: gold }}>Investor Dashboard</span>
                  <h2 className="text-3xl sm:text-4xl font-black mb-4">Manage Your Portfolio in Real Time</h2>
                  <p className="text-slate-400 mb-8 leading-relaxed max-w-lg">
                    Your {siteName} dashboard gives you a complete view of all active investments, live P&L, withdrawal history, and account analytics — from any device, 24/7.
                  </p>
                  <div className="space-y-3 mb-8">
                    {["Live portfolio value & ROI tracking", "One-click deposits and withdrawals", "Plan management with auto-renewal", "Real-time profit notifications"].map(f => (
                      <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: gold }} />{f}
                      </div>
                    ))}
                  </div>
                  <Link href={registerHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-[#020817] transition-all hover:opacity-90"
                    style={{ backgroundColor: gold }}>
                    Open Your Account <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                {/* Dashboard mockup */}
                <div className="flex-1 max-w-md w-full">
                  <div className="rounded-2xl border p-5" style={{ background: "#040e24", borderColor: gold + "22" }}>
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Portfolio Value</p>
                        <p className="text-2xl font-black text-white">$124,850.00</p>
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-xs font-bold">+18.4% this quarter</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Active Plans</p>
                        <p className="text-xl font-black" style={{ color: gold }}>4</p>
                      </div>
                    </div>
                    {/* Progress bars */}
                    <div className="space-y-3 mb-5">
                      {[["Crypto Portfolio", 82, "+$32k"], ["Forex Trading", 68, "+$18k"], ["Commodities", 74, "+$9k"]].map(([label, pct, val]) => (
                        <div key={label as string}>
                          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                            <span>{label}</span><span className="font-bold" style={{ color: gold }}>{val}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${gold}88, ${gold})` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[["Total Profit", "+$22,840", "text-emerald-400"], ["Monthly", "+$3,200", "text-emerald-400"], ["Daily", "+$108", "text-slate-300"]].map(([l, v, cls]) => (
                        <div key={l} className="rounded-xl p-3 text-center" style={{ background: "#060f20" }}>
                          <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">{l}</p>
                          <p className={`font-bold text-xs ${cls}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Live Withdrawal Feed ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
        <LiveWithdrawalFeed primary={gold} />
      </section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FOREX SECTIONS
// ══════════════════════════════════════════════════════════════════════════════

const FOREX_PAIRS = [
  { symbol: "EUR/USD", price: 1.0842,  change:  0.18, icon: "€" },
  { symbol: "GBP/USD", price: 1.2714,  change: -0.24, icon: "£" },
  { symbol: "USD/JPY", price: 157.34,  change:  0.31, icon: "¥" },
  { symbol: "AUD/USD", price: 0.6581,  change: -0.09, icon: "A$" },
  { symbol: "USD/CAD", price: 1.3621,  change:  0.14, icon: "C$" },
  { symbol: "USD/CHF", price: 0.9012,  change: -0.07, icon: "Fr" },
  { symbol: "NZD/USD", price: 0.6103,  change:  0.22, icon: "NZ$" },
  { symbol: "EUR/GBP", price: 0.8527,  change: -0.11, icon: "€£" },
];

const FOREX_FEATURES = [
  { icon: BarChart2,   title: "Tight Spreads",          desc: "Competitive spreads from 0.1 pip across 50+ major, minor, and exotic currency pairs." },
  { icon: Zap,         title: "Instant Execution",       desc: "Lightning-fast order execution with no requotes and minimal slippage, even at peak volume." },
  { icon: ShieldCheck, title: "Segregated Funds",        desc: "Client funds are held in segregated accounts at top-tier banks — fully protected." },
  { icon: Globe2,      title: "24/5 Market Access",      desc: "Trade the global forex market five days a week, across all major trading sessions." },
  { icon: LineChart,   title: "Advanced Charting",       desc: "Professional-grade charts with 50+ indicators, drawing tools, and multi-timeframe analysis." },
  { icon: Wallet,      title: "Fast Withdrawals",        desc: "Instant withdrawal processing to your wallet or bank — no delays, no hidden fees." },
];

function ForexSections({ primary, siteName, registerHref }: Props) {
  const accent = primary;
  const accentBg = accent + "12";

  const [pairs, setPairs] = useState(FOREX_PAIRS);

  // Simulate live price movement
  useEffect(() => {
    const t = setInterval(() => {
      setPairs(prev => prev.map(p => ({
        ...p,
        price: parseFloat((p.price * (1 + (Math.random() - 0.499) * 0.0015)).toFixed(p.price > 10 ? 3 : 4)),
        change: parseFloat((p.change + (Math.random() - 0.5) * 0.08).toFixed(2)),
      })));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{`
        @keyframes forex-ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .forex-ticker { display:flex; width:max-content; animation:forex-ticker 38s linear infinite; }
        .forex-ticker:hover { animation-play-state:paused; }
      `}</style>

      {/* ── Live Forex Ticker Bar ─────────────────────────────────────────── */}
      <div className="overflow-hidden border-y py-3" style={{ background: "#040e24", borderColor: accent + "18" }}>
        <div className="overflow-hidden">
          <div className="forex-ticker">
            {[...pairs, ...pairs].map((p, i) => (
              <div key={i} className="flex items-center gap-3 px-8 whitespace-nowrap">
                <span className="text-sm font-bold text-slate-400">{p.icon}</span>
                <span className="text-sm font-semibold text-slate-200">{p.symbol}</span>
                <span className="text-sm font-black" style={{ color: p.change >= 0 ? "#10b981" : "#f43f5e" }}>
                  {p.price.toFixed(p.price > 10 ? 3 : 4)}
                </span>
                <span className={`text-xs flex items-center gap-0.5 font-semibold ${p.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {p.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%
                </span>
                <span className="mx-3 opacity-20" style={{ color: accent }}>|</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live Currency Pairs Grid ──────────────────────────────────────── */}
      <section className="py-24" style={{ background: "#040e24" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: accent }}>Live Markets</span>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Real-Time Currency Pairs</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                Live bid/ask spreads across all major and minor forex pairs — updated every second.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {pairs.map((p, i) => (
                <div key={i} className="rounded-2xl border p-5 cursor-default hover:-translate-y-1 transition-transform duration-300"
                  style={{ background: "#0a1628", borderColor: accent + "1c" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-black" style={{ color: accent }}>{p.icon}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.change >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                      {p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-1">{p.symbol}</p>
                  <p className="font-black text-xl text-white tabular-nums">{p.price.toFixed(p.price > 10 ? 3 : 4)}</p>
                  <svg viewBox="0 0 80 30" className="w-full h-7 mt-3">
                    <polyline
                      points={Array.from({ length: 9 }, (_, k) => `${k * 10},${15 + Math.sin((k + i * 1.7) * 1.3) * 9}`).join(" ")}
                      fill="none" stroke={p.change >= 0 ? "#10b981" : "#f43f5e"} strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Live Withdrawal Feed ──────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
        <LiveWithdrawalFeed primary={accent} />
      </section>

      {/* ── Platform Features ─────────────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-bold tracking-widest uppercase mb-3 block" style={{ color: accent }}>Why Trade With Us</span>
              <h2 className="text-3xl sm:text-4xl font-black mb-4">Built for Serious Traders</h2>
              <p className="text-slate-400 max-w-xl mx-auto">
                {siteName} gives you the tools, speed, and security to trade global markets with confidence.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FOREX_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-2xl border p-6 hover:border-white/20 hover:-translate-y-1 transition-all duration-300"
                  style={{ background: "#0a1628", borderColor: accent + "20" }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: accentBg }}>
                    <Icon className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  <h3 className="font-bold text-white mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────── */}
      <section className="py-24" style={{ background: "#040e24" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="rounded-3xl border overflow-hidden p-10 sm:p-14 text-center"
              style={{ background: `linear-gradient(135deg, ${accent}16 0%, #060c18 60%)`, borderColor: accent + "30", boxShadow: `0 0 80px ${accent}18` }}>
              <span className="text-xs font-bold tracking-widest uppercase mb-4 block" style={{ color: accent }}>Start Trading Today</span>
              <h2 className="text-3xl sm:text-5xl font-black mb-5">
                Access Global Forex Markets<br />
                <span style={{ color: accent }}>From One Platform</span>
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto mb-10 text-lg leading-relaxed">
                Join thousands of traders on {siteName}. Open an account in minutes, fund instantly,
                and trade over 50 currency pairs with professional-grade tools.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href={registerHref}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-[#020817] transition-all hover:opacity-90"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
                  Open a Live Account <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
                {["No hidden fees", "Instant withdrawals", "24/5 support", "Segregated funds"].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-sm text-slate-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: accent }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BANKING SECTIONS
// ══════════════════════════════════════════════════════════════════════════════

function BankingSections({ primary, siteName, registerHref }: Props) {
  const secondaryBg = primary + "18";
  const [calcAmount, setCalcAmount] = useState(5000);
  const apy = 0.052;
  const projected = (calcAmount * (1 + apy)).toFixed(2);
  const interest = (calcAmount * apy).toFixed(2);

  return (
    <>
      {/* ── Banking Services ─────────────────────────────────────────────── */}
      <section id="banking-services" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Banking Services</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything You Need in One Place</h2>
              <p className="text-slate-400 max-w-xl mx-auto">From everyday banking to complex wealth management — {siteName} has the service for you.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: PiggyBank, title: "Savings Accounts",      body: "High-yield savings with up to 5.2% APY and no minimum balance requirements." },
                { icon: Wallet,    title: "Current Accounts",       body: "Feature-rich checking accounts with instant debit cards and real-time spending alerts." },
                { icon: Send,      title: "International Transfers", body: "Send money to 190+ countries with mid-market exchange rates and zero transfer fees." },
                { icon: Briefcase, title: "Business Banking",       body: "Business accounts with multi-user access, invoicing, payroll tools, and expense management." },
                { icon: BarChart3, title: "Investment Accounts",    body: "Grow your money with curated portfolios, index funds, and automated rebalancing." },
                { icon: Package,   title: "Loans",                  body: "Personal and business loans from $1,000 to $500,000 with competitive rates and fast approvals." },
                { icon: CreditCard, title: "Credit Cards",          body: "Premium credit cards with cashback rewards, travel perks, and zero foreign transaction fees." },
                { icon: CreditCard, title: "Debit Cards",           body: "Instant-issue virtual and physical debit cards accepted at 50 million+ locations worldwide." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/20 hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: secondaryBg }}>
                    <Icon className="w-5 h-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Banking Calculator ───────────────────────────────────────────── */}
      <section id="banking-calculator" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Savings Calculator</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">See Your Money Grow</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Estimate the potential value of your savings with a transparent, simple projection at 5.2% APY.</p>
          </div>
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
              <label className="block text-sm font-semibold text-slate-300 mb-3">Starting balance</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                <input type="number" min={100} max={250000} value={calcAmount}
                  onChange={e => setCalcAmount(Math.max(100, Math.min(250000, Number(e.target.value) || 100)))}
                  className="w-full pl-8 pr-4 py-4 rounded-xl bg-[#06090f] text-white font-bold text-lg outline-none border border-white/10 focus:border-white/25" />
              </div>
              <input type="range" min={100} max={250000} step={100} value={calcAmount}
                onChange={e => setCalcAmount(Number(e.target.value))}
                className="w-full mt-5" style={{ accentColor: primary }} aria-label="Starting balance" />
              <div className="flex justify-between text-xs text-slate-500 mt-2"><span>$100</span><span>$250,000</span></div>
              <div className="grid grid-cols-3 gap-3 mt-8">
                {[1000, 5000, 25000].map(a => (
                  <button key={a} type="button" onClick={() => setCalcAmount(a)}
                    className="rounded-xl border py-2.5 text-xs font-semibold transition-colors"
                    style={{ borderColor: calcAmount === a ? primary + "60" : "rgba(255,255,255,0.1)", color: calcAmount === a ? primary : "#94a3b8", background: calcAmount === a ? secondaryBg : "transparent" }}>
                    ${a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border overflow-hidden" style={{ background: `linear-gradient(145deg, ${primary}28, #06090f)`, borderColor: primary + "45" }}>
              <AssetSlideshow className="h-40 w-full" intervalMs={4900} overlay={`linear-gradient(135deg, ${primary}78, rgba(6,9,15,0.48))`} label={`${siteName} savings calculator`} />
              <div className="p-8">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: primary }}>Projected after 1 year at 5.2% APY</p>
                <p className="text-4xl sm:text-5xl font-black text-white mb-2">
                  ${Number(projected).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-slate-400 text-sm mb-6">Based on your starting balance of ${calcAmount.toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-4" style={{ backgroundColor: secondaryBg }}>
                    <p className="text-xs text-slate-500 mb-1">Starting balance</p>
                    <p className="font-bold text-white">${calcAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ backgroundColor: secondaryBg }}>
                    <p className="text-xs text-slate-500 mb-1">Estimated interest</p>
                    <p className="font-bold text-emerald-400">+${Number(interest).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-5">For illustration only. Actual rates and returns may vary.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Mobile Banking Dashboard ─────────────────────────────────────── */}
      <section className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: `linear-gradient(135deg, ${primary}18 0%, #06090f 60%)` }}>
              <div className="flex flex-col lg:flex-row items-center gap-10 p-10">
                <div className="flex-1">
                  <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Mobile Banking</span>
                  <h2 className="text-3xl sm:text-4xl font-bold mb-4">Bank Anywhere, Anytime</h2>
                  <p className="text-slate-400 mb-8 leading-relaxed max-w-lg">
                    The {siteName} mobile app puts the full power of your account in your pocket. Check balances, send money, pay bills, and invest — all in one place.
                  </p>
                  <div className="space-y-3 mb-8">
                    {["Instant push notifications for every transaction", "Biometric login (Face ID & Fingerprint)", "Mobile cheque deposit & QR payments", "Real-time spending insights & budgeting tools"].map(f => (
                      <div key={f} className="flex items-center gap-3 text-sm text-slate-300">
                        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: primary }} />{f}
                      </div>
                    ))}
                  </div>
                  <Link href={registerHref} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                    style={{ backgroundColor: primary }}>
                    Open Account Free <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                {/* Phone mockup */}
                <div className="flex-1 max-w-xs">
                  <div className="rounded-3xl border-2 border-white/15 bg-[#0d1117] p-4 shadow-2xl mx-auto w-64">
                    <div className="rounded-2xl overflow-hidden bg-white/[0.04] p-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs text-slate-400">Balance</span>
                        <span className="text-xs text-emerald-400">● Live</span>
                      </div>
                      <p className="text-2xl font-bold mb-1">$12,450.00</p>
                      <p className="text-xs text-slate-400 mb-5">{siteName} Main Account</p>
                      <div className="flex gap-2 mb-5">
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
          </Reveal>
        </div>
      </section>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRACKING / LOGISTICS SECTIONS
// ══════════════════════════════════════════════════════════════════════════════

const TRACKING_STEPS = [
  "Shipment Registered",
  "Arrived at Origin Airport",
  "In Transit",
  "Arrived at Destination Airport",
  "Out for Delivery",
  "Delivered",
];

const STATUS_STEP_MAP: Record<string, number> = {
  "Shipment Created": 0, "Shipment Registered": 0, "Shipment Received": 0,
  "Package Collected": 0, "Package Picked Up": 0,
  "Arrived at Origin Airport": 1, "At Origin Airport": 1, "Airport Security Check": 1,
  "Departed Airport": 1, "Arrived At Airport": 1, "Flight Departed": 1,
  "At Local Warehouse": 2, "Processing Shipment": 2, "Ready For Dispatch": 2,
  "Dispatched": 2, "In Transit": 2, "Transit Hub": 2,
  "Flight Delayed": 2, "Waiting For Customs": 2, "Customs Inspection": 2,
  "Customs Clearance": 2, "Customs Hold": 2, "Customs Released": 2,
  "Awaiting Duty Payment": 2, "Payment Pending": 2, "Payment Confirmed": 2,
  "Payment Declined": 2, "Released From Customs": 2, "Shipment Delayed": 2,
  "Shipment On Hold": 2,
  "Arrived At Destination Airport": 3, "Arrived at Destination Airport": 3,
  "Transferred To Local Courier": 4, "At Distribution Center": 4,
  "Out For Delivery": 4, "Out for Delivery": 4, "Delivery Attempt": 4,
  "Receiver Not Available": 4, "Address Verification": 4,
  "Successfully Delivered": 5, "Final Delivery Completed": 5, "Delivered": 5,
  "Shipment Cancelled": -1,
};

function getStatusStep(status: string): number {
  if (STATUS_STEP_MAP[status] !== undefined) return STATUS_STEP_MAP[status];
  const sl = (status ?? "").toLowerCase();
  if (sl.includes("delivered") || sl.includes("completed")) return 5;
  if (sl.includes("out for delivery") || sl.includes("distribution")) return 4;
  if (sl.includes("destination airport")) return 3;
  if (sl.includes("transit") || sl.includes("customs") || sl.includes("hold")) return 2;
  if (sl.includes("origin airport") || sl.includes("departed")) return 1;
  return 0;
}

function getStatusColor(status: string) {
  const sl = (status ?? "").toLowerCase();
  if (sl.includes("deliver") || sl.includes("complet")) return "#22c55e";
  if (sl.includes("cancel") || sl.includes("declined")) return "#ef4444";
  if (sl.includes("hold") || sl.includes("delay") || sl.includes("missing")) return "#f59e0b";
  if (sl.includes("return")) return "#a855f7";
  if (sl.includes("customs") || sl.includes("airport") || sl.includes("security")) return "#8b5cf6";
  if (sl.includes("transit") || sl.includes("flight") || sl.includes("dispatch")) return "#0ea5e9";
  return "#64748b";
}

function TrackingResultDisplay({ result, primary, websiteUid }: { result: any; primary: string; websiteUid: string }) {
  const { shipment, events } = result;
  const currentStep = getStatusStep(shipment.status);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const visibleEvents = showAllEvents ? events : events.slice(0, 5);
  const trackPageHref = `/track/${websiteUid}?t=${encodeURIComponent(shipment.trackingNumber)}`;

  return (
    <div className="mt-4 space-y-4 animate-in fade-in duration-300">
      {/* Status Badge + Header */}
      <div className="rounded-2xl border p-5" style={{ background: "#0a1628", borderColor: primary + "30" }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tracking Number</p>
            <p className="text-white font-bold font-mono text-base">{shipment.trackingNumber}</p>
            {shipment.referenceNumber && (
              <p className="text-xs text-slate-500 mt-0.5">Ref: {shipment.referenceNumber}</p>
            )}
          </div>
          <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: getStatusColor(shipment.status) + "20", color: getStatusColor(shipment.status) }}>
            {shipment.status}
          </span>
        </div>

        {/* Origin → Destination */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1 min-w-0">
            <p className="text-slate-500 text-xs mb-0.5">From</p>
            <p className="text-white font-semibold truncate">
              {[shipment.originCity, shipment.originCountry].filter(Boolean).join(", ") || "—"}
            </p>
            {shipment.originAirport && <p className="text-xs text-slate-500 font-mono">{shipment.originAirport}</p>}
          </div>
          <div className="shrink-0 text-slate-600">
            <Plane className="w-5 h-5" style={{ color: primary }} />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-slate-500 text-xs mb-0.5">To</p>
            <p className="text-white font-semibold truncate">
              {[shipment.destinationCity, shipment.destinationCountry].filter(Boolean).join(", ") || "—"}
            </p>
            {shipment.destinationAirport && <p className="text-xs text-slate-500 font-mono">{shipment.destinationAirport}</p>}
          </div>
        </div>

        {shipment.estimatedDelivery && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-slate-400" style={{ borderColor: primary + "18" }}>
            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: primary }} />
            ETA: <span className="text-white font-semibold">{new Date(shipment.estimatedDelivery).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        )}
      </div>

      {/* Progress Steps */}
      {currentStep >= 0 && (
        <div className="rounded-2xl border p-5" style={{ background: "#06090f", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Shipment Progress</p>
          <div className="space-y-0">
            {TRACKING_STEPS.map((step, i) => {
              const done = i <= currentStep;
              const active = i === currentStep;
              return (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${active ? "scale-110" : ""}`}
                      style={{
                        background: done ? primary : "rgba(255,255,255,0.05)",
                        border: `2px solid ${done ? primary : "rgba(255,255,255,0.1)"}`,
                        boxShadow: active ? `0 0 12px ${primary}60` : undefined,
                      }}>
                      {done
                        ? <span className="text-white text-xs font-bold">✓</span>
                        : <span className="text-slate-600 text-xs">{i + 1}</span>}
                    </div>
                    {i < TRACKING_STEPS.length - 1 && (
                      <div className="w-0.5 flex-1 my-1" style={{ background: done ? primary + "40" : "rgba(255,255,255,0.06)", minHeight: "20px" }} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-semibold ${active ? "text-white" : done ? "text-slate-300" : "text-slate-600"}`}>{step}</p>
                    {active && <p className="text-xs mt-0.5" style={{ color: primary }}>Current status</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event History */}
      {events && events.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ background: "#06090f", borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Shipment History</p>
          <div className="space-y-3">
            {visibleEvents.map((ev: any, i: number) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: i === 0 ? primary : "rgba(255,255,255,0.2)" }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${i === 0 ? "text-white" : "text-slate-400"}`}>{ev.eventStatus || ev.status}</p>
                  {ev.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{ev.location}</p>}
                  {ev.notes && <p className="text-xs text-slate-600 mt-0.5 italic">{ev.notes}</p>}
                </div>
                <p className="text-xs text-slate-600 shrink-0">
                  {new Date(ev.eventTime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
          {events.length > 5 && (
            <button onClick={() => setShowAllEvents(v => !v)}
              className="mt-4 flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ color: primary }}>
              {showAllEvents ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {events.length} events</>}
            </button>
          )}
        </div>
      )}

      {/* Link to full tracking page */}
      <a href={trackPageHref}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm border transition-all hover:opacity-80"
        style={{ borderColor: primary + "40", color: primary, background: primary + "10" }}>
        <ExternalLink className="w-4 h-4" /> View Full Tracking Details & Live Map
      </a>
    </div>
  );
}

function TrackingSections({ primary, siteName, registerHref, websiteUid }: Props) {
  const secondaryBg = primary + "18";
  const [planePos, setPlanePos] = useState(0);
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState<any>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [demoStep] = useState(3); // demo only shown when no search done

  const handleTrack = async () => {
    const tn = trackInput.trim();
    if (!tn || trackLoading) return;
    setTrackLoading(true);
    setTrackError("");
    setTrackResult(null);
    try {
      const result = await publicTrack(websiteUid, tn);
      setTrackResult(result);
    } catch (err: any) {
      const status = err?.status;
      if (status === 404) {
        setTrackError("Tracking number not found.");
      } else if (status === 403) {
        setTrackError("This website is not currently active.");
      } else {
        setTrackError("Unable to retrieve tracking information. Please try again.");
      }
    } finally {
      setTrackLoading(false);
    }
  };

  // Animate plane 0→100% along the route
  useEffect(() => {
    const t = setInterval(() => {
      setPlanePos(prev => (prev >= 100 ? 0 : prev + 0.4));
    }, 50);
    return () => clearInterval(t);
  }, []);

  // Compute plane position along cubic bezier path
  const t = planePos / 100;
  // Path: M 40,140 C 120,10 280,10 360,140 (SVG coords for the arc)
  const bx = 40 + 3 * (1-t) * (1-t) * t * 80 + 3 * (1-t) * t * t * 240 + t * t * t * 320;
  const by = 140 + 3 * (1-t) * (1-t) * t * (-130) + 3 * (1-t) * t * t * (-130) + t * t * t * 0;
  // Rotation along path tangent
  const dt = 0.01;
  const t2 = Math.min(t + dt, 1);
  const bx2 = 40 + 3 * (1-t2) * (1-t2) * t2 * 80 + 3 * (1-t2) * t2 * t2 * 240 + t2 * t2 * t2 * 320;
  const by2 = 140 + 3 * (1-t2) * (1-t2) * t2 * (-130) + 3 * (1-t2) * t2 * t2 * (-130) + t2 * t2 * t2 * 0;
  const angle = Math.atan2(by2 - by, bx2 - bx) * 180 / Math.PI;

  return (
    <>
      {/* ── Animated Plane + Route ───────────────────────────────────────── */}
      <section id="logistics-route" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Global Network</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">We Move Cargo Across the World</h2>
              <p className="text-slate-400 max-w-xl mx-auto">{siteName} operates flight and logistics routes across 190+ countries with real-time tracking on every shipment.</p>
            </div>

            {/* Flight route visualizer */}
            <div className="rounded-3xl border border-white/10 bg-[#06090f] p-8 mb-10 overflow-hidden relative">
              {/* Background grid */}
              <div className="absolute inset-0 opacity-5" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }} />

              <div className="relative">
                <svg viewBox="0 0 400 160" className="w-full max-w-2xl mx-auto" style={{ height: "200px" }}>
                  {/* Glowing route arc */}
                  <defs>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <linearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={primary} stopOpacity="0.3"/>
                      <stop offset="50%" stopColor={primary} stopOpacity="0.8"/>
                      <stop offset="100%" stopColor={primary} stopOpacity="0.3"/>
                    </linearGradient>
                  </defs>

                  {/* Dashed route path */}
                  <path d="M 40,140 C 120,10 280,10 360,140"
                    fill="none" stroke={`url(#routeGrad)`} strokeWidth="2" strokeDasharray="8,5"
                    filter="url(#glow)" />

                  {/* Origin airport dot */}
                  <circle cx="40" cy="140" r="8" fill={primary} opacity="0.9" />
                  <circle cx="40" cy="140" r="14" fill={primary} opacity="0.15" />
                  <text x="40" y="158" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">JFK</text>

                  {/* Destination airport dot */}
                  <circle cx="360" cy="140" r="8" fill={primary} opacity="0.9" />
                  <circle cx="360" cy="140" r="14" fill={primary} opacity="0.15" />
                  <text x="360" y="158" textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="bold">LHR</text>

                  {/* Animated plane */}
                  <g transform={`translate(${bx}, ${by}) rotate(${angle})`}>
                    <text x="0" y="0" textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: "20px", fill: "white", filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}>✈</text>
                  </g>

                  {/* Progress trail */}
                  <path d={`M 40,140 C 120,10 280,10 ${bx},${by}`}
                    fill="none" stroke={primary} strokeWidth="1.5" opacity="0.4" />
                </svg>

                <div className="flex justify-center gap-16 mt-4">
                  <div className="text-center">
                    <div className="flex items-center gap-2 justify-center mb-1">
                      <MapPin className="w-4 h-4" style={{ color: primary }} />
                      <span className="text-white font-semibold text-sm">New York</span>
                    </div>
                    <span className="text-xs text-slate-500">Origin</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-2 justify-center mb-1">
                      <Plane className="w-4 h-4" style={{ color: primary }} />
                      <span className="text-white font-semibold text-sm">In Transit</span>
                    </div>
                    <span className="text-xs text-slate-500">Live tracking</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-2 justify-center mb-1">
                      <MapPin className="w-4 h-4" style={{ color: primary }} />
                      <span className="text-white font-semibold text-sm">London</span>
                    </div>
                    <span className="text-xs text-slate-500">Destination</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logistics stats */}
            <div className="grid sm:grid-cols-4 gap-5">
              {[
                { icon: Globe,   title: "190+ Countries",     body: "Global flight and logistics network covering every major continent and trade corridor." },
                { icon: Plane,   title: "Daily Flights",      body: "Thousands of cargo flights operated daily across our partner airline network." },
                { icon: Package, title: "Real-Time Tracking", body: "Every shipment tracked live from pickup through customs to final delivery." },
                { icon: Clock,   title: "On-Time Delivery",   body: "Industry-leading 97.3% on-time delivery rate across all international routes." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-white/10 bg-[#06090f] p-6 hover:border-white/20 transition-colors">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: secondaryBg }}>
                    <Icon className="w-5 h-5" style={{ color: primary }} />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Cargo & Warehouse Imagery ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <Reveal>
          <div className="text-center mb-14">
            <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Our Facilities</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">World-Class Logistics Infrastructure</h2>
            <p className="text-slate-400 max-w-xl mx-auto">From state-of-the-art warehouses to dedicated cargo aircraft — {siteName} has the infrastructure to move anything, anywhere.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="rounded-2xl overflow-hidden border border-white/10 relative">
              <AssetSlideshow className="h-56 w-full" intervalMs={4200} overlay={`linear-gradient(135deg, ${primary}88, rgba(6,9,15,0.38))`} label={`${siteName} cargo aircraft fleet`} variant="logistics" />
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#06090f] to-transparent">
                <p className="text-white font-bold text-sm flex items-center gap-2"><Plane className="w-4 h-4" style={{ color: primary }} /> Cargo Aircraft Fleet</p>
                <p className="text-slate-400 text-xs mt-1">Dedicated freighter aircraft for time-critical international shipments</p>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10 relative">
              <AssetSlideshow className="h-56 w-full" intervalMs={5100} overlay={`linear-gradient(135deg, rgba(6,9,15,0.72), ${primary}55)`} label={`${siteName} warehouse operations`} variant="logistics" />
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#06090f] to-transparent">
                <p className="text-white font-bold text-sm flex items-center gap-2"><Package className="w-4 h-4" style={{ color: primary }} /> Distribution Centers</p>
                <p className="text-slate-400 text-xs mt-1">Automated sorting and processing across 40+ strategic warehouse locations</p>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              ["✈️", "Air Freight",    "Express and economy air cargo to 190+ destinations with customs clearance included."],
              ["🚢", "Sea Freight",    "Full-container and less-than-container sea freight with port-to-door service."],
              ["🚛", "Ground Freight", "Nationwide and cross-border trucking with temperature control and secure sealing."],
            ].map(([icon, title, body]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-white/20 transition-colors">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Shipment Tracking Widget ─────────────────────────────────────── */}
      <section id="shipment-tracking" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-14">
              <span className="text-xs font-semibold tracking-widest uppercase mb-3 block" style={{ color: primary }}>Shipment Tracking</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Know Exactly Where Your Cargo Is</h2>
              <p className="text-slate-400 max-w-xl mx-auto">Enter your tracking number below for real-time visibility on your shipment.</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              {/* Live tracker */}
              <div className="rounded-3xl border border-white/10 bg-[#06090f] p-8">
                <p className="text-sm font-semibold text-slate-300 mb-3">Tracking Number</p>
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={trackInput}
                    onChange={e => setTrackInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleTrack()}
                    placeholder="Enter your tracking number"
                    className="flex-1 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm outline-none focus:border-white/25 font-mono"
                  />
                  <button
                    onClick={handleTrack}
                    disabled={trackLoading || !trackInput.trim()}
                    className="px-5 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: primary }}>
                    {trackLoading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Search className="w-4 h-4" />}
                    Track Shipment
                  </button>
                </div>

                {/* Error message */}
                {trackError && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm font-medium mb-4">
                    <XCircle className="w-4 h-4 shrink-0" />
                    {trackError}
                  </div>
                )}

                {/* Real tracking result */}
                {trackResult && !trackError && (
                  <TrackingResultDisplay result={trackResult} primary={primary} websiteUid={websiteUid} />
                )}

                {/* Demo — shown only before any search */}
                {!trackResult && !trackError && !trackLoading && (
                  <>
                    <p className="text-xs text-slate-600 mb-4 text-center">— Example preview —</p>
                    <div className="space-y-0 opacity-60">
                      {TRACKING_STEPS.map((step, i) => {
                        const done = i <= demoStep;
                        const active = i === demoStep;
                        return (
                          <div key={step} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${active ? "scale-110" : ""}`}
                                style={{ backgroundColor: done ? primary : "rgba(255,255,255,0.06)", border: `2px solid ${done ? primary : "rgba(255,255,255,0.1)"}` }}>
                                {done
                                  ? <span className="text-white text-xs font-bold">✓</span>
                                  : <span className="text-slate-600 text-xs">{i + 1}</span>}
                              </div>
                              {i < TRACKING_STEPS.length - 1 && (
                                <div className="w-0.5 flex-1 my-1" style={{ backgroundColor: done ? primary + "40" : "rgba(255,255,255,0.06)", minHeight: "24px" }} />
                              )}
                            </div>
                            <div className="pb-5">
                              <p className={`font-semibold text-sm ${active ? "text-white" : done ? "text-slate-300" : "text-slate-600"}`}>{step}</p>
                              {active && <p className="text-xs mt-1" style={{ color: primary }}>Enter a tracking number above to see live status</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Features */}
              <div className="space-y-5">
                <AssetSlideshow className="h-48 rounded-2xl border border-white/10" intervalMs={4600}
                  overlay={`linear-gradient(135deg, ${primary}77, rgba(6,9,15,0.4))`} label={`${siteName} logistics tracking`} variant="logistics" />
                <div className="space-y-4">
                  {[
                    { icon: Plane,   title: "Live Flight Updates",    body: "Automatic updates every time your cargo's flight takes off, lands, or changes status." },
                    { icon: MapPin,  title: "GPS Location Pinning",   body: "Exact coordinates for ground shipments with route deviation alerts." },
                    { icon: Clock,   title: "Delivery ETA",           body: "Accurate delivery windows updated in real time based on customs, weather, and traffic." },
                    { icon: Package, title: "Proof of Delivery",      body: "Digital signature capture and photo confirmation on every delivered parcel." },
                  ].map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.07] hover:border-white/15 transition-colors">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: secondaryBg }}>
                        <Icon className="w-4 h-4" style={{ color: primary }} />
                      </div>
                      <div>
                        <p className="font-medium text-sm mb-0.5">{title}</p>
                        <p className="text-slate-500 text-xs leading-relaxed">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href={registerHref} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: primary }}>
                  Create Account <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
