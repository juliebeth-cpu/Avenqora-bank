import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import { useBankingAdminRegion } from "@/lib/banking-admin-region";
import { portalGetAnalytics } from "@/lib/portal-api";
import {
  Activity, ArrowDownCircle, ArrowLeftRight, ArrowRight, ArrowUpCircle,
  Landmark, RefreshCw, Users, Wallet,
} from "lucide-react";
import { format } from "date-fns";

const formatValue = (value: unknown) => Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, "MMM d · HH:mm");
};

export default function BankingAnalyticsPage() {
  const region = useBankingAdminRegion();
  const query = useQuery({ queryKey: ["portal-banking-analytics", region], queryFn: portalGetAnalytics });
  const overview = query.data?.overview ?? {};
  const transactions: any[] = query.data?.recentTransactions ?? [];
  const customers: any[] = query.data?.recentCustomers ?? [];
  const metrics = [
    { label: "Customers", value: Number(overview.totalCustomers ?? 0).toLocaleString(), detail: `${Number(overview.activeCustomers ?? 0).toLocaleString()} active`, icon: Users },
    { label: "Deposits", value: formatValue(overview.totalDepositAmount), detail: `${Number(overview.totalDeposits ?? 0).toLocaleString()} recorded · ${Number(overview.pendingDeposits ?? 0).toLocaleString()} pending`, icon: ArrowDownCircle },
    { label: "Withdrawals", value: formatValue(overview.totalWithdrawalAmount), detail: `${Number(overview.totalWithdrawals ?? 0).toLocaleString()} recorded · ${Number(overview.pendingWithdrawals ?? 0).toLocaleString()} pending`, icon: ArrowUpCircle },
    { label: "Transfers", value: formatValue(overview.totalTransferAmount), detail: `${Number(overview.totalTransfers ?? 0).toLocaleString()} recorded · ${Number(overview.pendingTransfers ?? 0).toLocaleString()} pending`, icon: ArrowLeftRight },
    { label: "Account balances", value: formatValue(overview.totalAccountBalance), detail: "Reported aggregate balance", icon: Wallet },
    { label: "Loans", value: Number(overview.totalLoans ?? 0).toLocaleString(), detail: `${Number(overview.activeLoans ?? 0).toLocaleString()} active`, icon: Landmark },
  ];
  const base = `/portal/${window.location.pathname.split("/")[2] ?? ""}/banking`;

  return <PortalLayout><div className="mx-auto max-w-[1450px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-4 border-b border-slate-700/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Banking operations / reporting</p><h1 className="text-2xl font-semibold text-white sm:text-3xl">Regional performance</h1><p className="mt-2 text-sm text-slate-400">Current operational analytics for the selected banking region.</p></div>
      <div className="rounded-lg border border-slate-700/70 bg-slate-800/35 px-3 py-2 text-xs text-slate-400">Selected region <span className="ml-1 font-mono text-slate-200">{region}</span></div>
    </header>

    {query.isLoading ? <div aria-label="Loading regional analytics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-32 animate-pulse rounded-2xl border border-slate-700/60 bg-slate-800/35" />)}</div>
      : query.isError ? <section role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7"><h2 className="font-medium text-white">Regional analytics unavailable</h2><p className="mt-1 text-sm text-slate-400">We couldn't load the current report for {region}.</p><button data-testid="button-retry-analytics" onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-700/50"><RefreshCw className="h-4 w-4" /> Retry report</button></section>
      : <>
        <section aria-label="Regional banking metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map(({ label, value, detail, icon: Icon }) => <article key={label} data-testid={`analytics-metric-${label.toLowerCase().replaceAll(" ", "-")}`} className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-slate-400">{label}</p><p className="mt-3 font-mono text-2xl font-semibold text-white">{value}</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200/10 bg-teal-200/5 text-teal-200"><Icon className="h-5 w-5" /></span></div><p className="mt-3 text-xs text-slate-500">{detail}</p></article>)}
        </section>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/25">
            <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4"><div><h2 className="font-semibold text-white">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">Latest records included in current analytics</p></div><Link href={`${base}/transactions`} data-testid="link-analytics-transactions" className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200">Ledger <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            {!transactions.length ? <div className="px-5 py-12 text-center"><Activity className="mx-auto mb-3 h-7 w-7 text-slate-600" /><p className="text-sm text-slate-300">No recent transaction data</p><p className="mt-1 text-xs text-slate-500">Transactions will appear as activity is recorded.</p></div> : <div className="divide-y divide-slate-700/40">{transactions.slice(0, 8).map((tx: any) => <div key={tx.id} data-testid={`analytics-transaction-${tx.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="min-w-0"><p className="truncate text-sm text-slate-200">{tx.description || tx.transactionType || "Transaction"}</p><p className="mt-1 text-[11px] text-slate-500">{dateLabel(tx.createdAt)} · {tx.customerName || "Customer"}</p></div><div className="shrink-0 text-right"><p className="font-mono text-sm text-white">{tx.currency ? `${tx.currency} ` : ""}{formatValue(tx.amount)}</p><p className="mt-1 text-[11px] capitalize text-slate-500">{String(tx.status ?? "unknown").replaceAll("_", " ")}</p></div></div>)}</div>}
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/25">
            <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4"><div><h2 className="font-semibold text-white">Recently registered customers</h2><p className="mt-1 text-xs text-slate-500">Customer activity returned by the analytics report</p></div><Link href={`${base}/customers`} data-testid="link-analytics-customers" className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200">Customers <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            {!customers.length ? <div className="px-5 py-12 text-center"><Users className="mx-auto mb-3 h-7 w-7 text-slate-600" /><p className="text-sm text-slate-300">No recent customer data</p><p className="mt-1 text-xs text-slate-500">New registrations will appear in this report.</p></div> : <div className="divide-y divide-slate-700/40">{customers.slice(0, 8).map((customer: any) => <div key={customer.id} data-testid={`analytics-customer-${customer.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-200/15 bg-teal-200/5 text-xs font-semibold text-teal-100">{String(customer.name ?? "?").trim().charAt(0).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm text-slate-200">{customer.name || "Customer name unavailable"}</p><p className="truncate text-xs text-slate-500">{customer.email || "Email not provided"}</p></div></div><div className="shrink-0 text-right"><span className="rounded-full border border-slate-600 bg-slate-700/40 px-2 py-1 text-[10px] capitalize text-slate-300">{String(customer.status ?? "unknown").replaceAll("_", " ")}</span><p className="mt-2 text-[11px] text-slate-500">{customer.createdAt ? dateLabel(customer.createdAt) : "—"}</p></div></div>)}</div>}
          </section>
        </div>
        <section className="flex flex-col justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-800/20 p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold text-slate-200">Regional report source</h2><p className="mt-1 text-xs text-slate-500">Values shown are returned by live banking analytics; no cross-currency conversion is applied.</p></div><Link href={`${base}/dashboard`} data-testid="link-analytics-dashboard" className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-slate-700 px-4 text-xs text-slate-200 hover:bg-slate-700/40 sm:self-auto">Operations overview <ArrowRight className="h-4 w-4" /></Link></section>
      </>}
  </div></PortalLayout>;
}