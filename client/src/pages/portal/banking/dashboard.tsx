import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import { useBankingAdminRegion } from "@/lib/banking-admin-region";
import { portalGetBankingDashboard, portalListBankingTransactions } from "@/lib/portal-api";
import {
  Activity, ArrowDownCircle, ArrowLeftRight, ArrowRight, ArrowUpCircle,
  CreditCard, Fingerprint, Landmark, RefreshCw, ShieldCheck, Users,
} from "lucide-react";
import { formatBankingAdminDate, formatBankingAdminDateTime } from "@/lib/banking-region";

const money = (value: unknown, currency = "USD") =>
  `${currency} ${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const safeDate = (value: string) => {
  return formatBankingAdminDateTime(value);
};

export default function BankingDashboardPage() {
  const region = useBankingAdminRegion();
  const dashboard = useQuery({
    queryKey: ["portal-banking-dashboard", region],
    queryFn: portalGetBankingDashboard,
  });
  const transactions = useQuery({
    queryKey: ["portal-banking-transactions", region],
    queryFn: portalListBankingTransactions,
  });
  const data = dashboard.data;
  const base = `/portal/${window.location.pathname.split("/")[2] ?? ""}/banking`;
  const stats = [
    { label: "Customers", value: Number(data?.totalCustomers ?? 0).toLocaleString(), detail: `${Number(data?.activeCustomers ?? 0).toLocaleString()} active`, icon: Users, tint: "text-sky-300 bg-sky-400/10 border-sky-300/15" },
    { label: "Accounts", value: Number(data?.totalAccounts ?? 0).toLocaleString(), detail: `${Number(data?.activeAccounts ?? 0).toLocaleString()} active`, icon: Landmark, tint: "text-teal-300 bg-teal-400/10 border-teal-300/15" },
    { label: "Today's transactions", value: Number(data?.todayTransactions ?? 0).toLocaleString(), detail: "Activity recorded today", icon: Activity, tint: "text-amber-200 bg-amber-300/10 border-amber-200/15" },
    { label: "Awaiting review", value: Number(data?.pendingApprovals ?? 0).toLocaleString(), detail: `${Number(data?.pendingTransactions ?? 0).toLocaleString()} transactions`, icon: ShieldCheck, tint: "text-rose-200 bg-rose-300/10 border-rose-200/15" },
  ];
  const work = [
    { label: "Customer registrations", count: data?.pendingCustomers, href: `${base}/customers`, icon: Users },
    { label: "Deposits", count: data?.pendingDeposits, href: `${base}/deposits`, icon: ArrowDownCircle },
    { label: "Withdrawals", count: data?.pendingWithdrawals, href: `${base}/withdrawals`, icon: ArrowUpCircle },
    { label: "Transfers", count: data?.pendingTransfers, href: `${base}/transfers`, icon: ArrowLeftRight },
    { label: "Cards", count: data?.pendingCards, href: `${base}/cards`, icon: CreditCard },
    { label: "KYC reviews", count: data?.pendingKyc, href: `${base}/kyc`, icon: Fingerprint },
    { label: "Loan requests", count: data?.pendingLoans, href: `${base}/loans`, icon: Landmark },
  ];

  return (
    <PortalLayout>
      <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-4 border-b border-slate-700/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Banking operations / overview</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Good morning, operations</h1>
            <p className="mt-2 text-sm text-slate-400">A live view of customer, account and review activity.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-teal-300" />
            Region: <span className="font-mono text-slate-200">{data?.region ?? region}</span>
            <span className="ml-2 border-l border-slate-700 pl-3">{formatBankingAdminDate(new Date(), { weekday: "long", month: "short", day: "numeric" })}</span>
          </div>
        </header>

        {dashboard.isLoading ? (
          <div aria-label="Loading banking overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-700/60 bg-slate-800/40" />)}
          </div>
        ) : dashboard.isError ? (
          <section role="alert" className="flex flex-col gap-4 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-semibold text-white">Banking overview unavailable</h2><p className="mt-1 text-sm text-slate-400">We couldn't load this region's live operations data.</p></div>
            <button data-testid="button-retry-dashboard" onClick={() => dashboard.refetch()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-700/50"><RefreshCw className="h-4 w-4" /> Try again</button>
          </section>
        ) : (
          <>
            <section aria-label="Banking performance" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map(({ label, value, detail, icon: Icon, tint }) => (
                <article key={label} data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`} className="rounded-2xl border border-slate-700/60 bg-slate-800/35 p-5">
                  <div className="flex items-start justify-between">
                    <div><p className="text-sm text-slate-400">{label}</p><p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-white">{value}</p></div>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${tint}`}><Icon className="h-5 w-5" /></span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{detail}</p>
                </article>
              ))}
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
              <section className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/25">
                <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4">
                  <div><h2 className="font-semibold text-white">Latest transactions</h2><p className="mt-1 text-xs text-slate-500">Most recent activity in this region</p></div>
                  <Link href={`${base}/transactions`} data-testid="link-all-transactions" className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:text-teal-200">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
                </div>
                {transactions.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-slate-700/30" />)}</div>
                  : transactions.isError ? <div className="p-6 text-sm text-rose-200" role="alert">Recent activity could not be loaded.</div>
                  : !transactions.data?.length ? <div className="px-5 py-12 text-center"><Activity className="mx-auto mb-3 h-7 w-7 text-slate-600" /><p className="text-sm font-medium text-slate-300">No transactions recorded</p><p className="mt-1 text-xs text-slate-500">New regional activity will appear here.</p></div>
                  : <div className="divide-y divide-slate-700/40">
                    {transactions.data.slice(0, 6).map((tx: any) => (
                      <div key={tx.id} data-testid={`transaction-preview-${tx.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                        <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{tx.customerName || tx.description || tx.transactionType}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-500">{tx.transactionId || tx.reference || `Account ${tx.accountNumber ?? "—"}`} · {safeDate(tx.createdAt)}</p></div>
                        <div className="text-right"><p className="font-mono text-sm text-white">{money(tx.amount, tx.currency)}</p><p className="mt-1 text-[11px] capitalize text-slate-500">{String(tx.status ?? "unknown").replaceAll("_", " ")}</p></div>
                      </div>
                    ))}
                  </div>}
              </section>

              <section className="rounded-2xl border border-slate-700/60 bg-slate-800/25">
                <div className="border-b border-slate-700/60 px-5 py-4"><h2 className="font-semibold text-white">Balances by currency</h2><p className="mt-1 text-xs text-slate-500">Account balance totals as reported</p></div>
                {!data?.balancesByCurrency?.length ? <div className="px-5 py-12 text-center text-sm text-slate-500">No balance data for this region.</div> :
                  <div className="divide-y divide-slate-700/40">
                    {data.balancesByCurrency.map((balance: any) => <div key={balance.currency} data-testid={`balance-${balance.currency}`} className="flex items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 font-mono text-xs text-teal-200">{balance.currency}</span><span className="text-sm text-slate-300">{balance.currency} ledger</span></div><span className="font-mono text-sm font-medium text-white">{money(balance.amount, balance.currency)}</span></div>)}
                  </div>}
              </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
              <section className="rounded-2xl border border-slate-700/60 bg-slate-800/25">
                <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4"><div><h2 className="font-semibold text-white">Review queue</h2><p className="mt-1 text-xs text-slate-500">Pending work by service</p></div><Link href={`${base}/approvals`} data-testid="link-approvals" className="inline-flex items-center gap-1 text-xs font-medium text-teal-300 hover:text-teal-200">Open queue <ArrowRight className="h-3.5 w-3.5" /></Link></div>
                <div className="grid gap-px bg-slate-700/40 sm:grid-cols-2">
                  {work.map(({ label, count, href, icon: Icon }) => <Link key={label} href={href} data-testid={`link-pending-${label.toLowerCase().replaceAll(" ", "-")}`} className="flex items-center justify-between gap-3 bg-[#101b2b] px-5 py-4 transition-colors hover:bg-slate-800"><span className="flex items-center gap-3 text-sm text-slate-300"><Icon className="h-4 w-4 text-slate-500" />{label}</span><span className={`font-mono text-sm ${(count ?? 0) > 0 ? "text-amber-200" : "text-slate-500"}`}>{Number(count ?? 0).toLocaleString()}</span></Link>)}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-700/60 bg-slate-800/25">
                <div className="border-b border-slate-700/60 px-5 py-4"><h2 className="font-semibold text-white">Customer distribution</h2><p className="mt-1 text-xs text-slate-500">Registered customers by region</p></div>
                {!data?.customersByRegion?.length ? <div className="px-5 py-12 text-center text-sm text-slate-500">No regional customer data.</div> :
                  <div className="space-y-4 p-5">{data.customersByRegion.map((item: any) => {
                    const max = Math.max(...data.customersByRegion.map((entry: any) => Number(entry.count ?? 0)), 1);
                    return <div key={item.region} data-testid={`region-count-${item.region}`}><div className="mb-2 flex justify-between text-xs"><span className="text-slate-300">{item.region}</span><span className="font-mono text-slate-400">{Number(item.count ?? 0).toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-700/70"><div className="h-full rounded-full bg-teal-300/80" style={{ width: `${Math.max(2, Number(item.count ?? 0) / max * 100)}%` }} /></div></div>;
                  })}</div>}
              </section>
            </div>
          </>
        )}
      </div>
    </PortalLayout>
  );
}