import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import { useBankingAdminRegion } from "@/lib/banking-admin-region";
import { portalGetBankingDashboard } from "@/lib/portal-api";
import {
  ArrowDownCircle, ArrowLeftRight, ArrowRight, ArrowUpCircle, CreditCard,
  Fingerprint, Landmark, RefreshCw, ShieldCheck, UserRoundCheck,
} from "lucide-react";

export default function BankingApprovalsPage() {
  const region = useBankingAdminRegion();
  const query = useQuery({ queryKey: ["portal-banking-dashboard", region], queryFn: portalGetBankingDashboard });
  const data = query.data;
  const base = `/portal/${window.location.pathname.split("/")[2] ?? ""}/banking`;
  const queue = [
    { name: "Customer registrations", key: "pendingCustomers", destination: "customers", icon: UserRoundCheck, note: "Review new customer access" },
    { name: "Deposits", key: "pendingDeposits", destination: "deposits", icon: ArrowDownCircle, note: "Verify incoming funds" },
    { name: "Withdrawals", key: "pendingWithdrawals", destination: "withdrawals", icon: ArrowUpCircle, note: "Review outgoing funds" },
    { name: "Transfers", key: "pendingTransfers", destination: "transfers", icon: ArrowLeftRight, note: "Review account transfers" },
    { name: "Cards", key: "pendingCards", destination: "cards", icon: CreditCard, note: "Review card requests" },
    { name: "KYC", key: "pendingKyc", destination: "kyc", icon: Fingerprint, note: "Review identity documents" },
    { name: "Loans", key: "pendingLoans", destination: "loans", icon: Landmark, note: "Review loan applications" },
  ];

  return <PortalLayout><div className="mx-auto max-w-[1320px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="border-b border-slate-700/60 pb-6"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Banking operations / work management</p><h1 className="text-2xl font-semibold text-white sm:text-3xl">Review queue</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">A regional snapshot of work waiting for a decision. Open a service queue to review and action individual items.</p></header>
    {query.isLoading ? <div aria-label="Loading approval counts" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} className="h-28 animate-pulse rounded-xl border border-slate-700/60 bg-slate-800/30" />)}</div>
      : query.isError ? <section role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7"><h2 className="font-medium text-white">Review counts unavailable</h2><p className="mt-1 text-sm text-slate-400">Live queue totals could not be loaded for {region}.</p><button data-testid="button-retry-approvals" onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-700/50"><RefreshCw className="h-4 w-4" /> Retry</button></section>
      : <>
        <section className="flex flex-col justify-between gap-5 rounded-2xl border border-amber-200/15 bg-[linear-gradient(115deg,rgba(164,112,29,.13),rgba(15,27,43,.38)_62%)] p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-100/15 bg-amber-200/10 text-amber-100"><ShieldCheck className="h-6 w-6" /></div><div><p className="text-sm text-slate-300">Open review items</p><p data-testid="text-pending-total" className="mt-1 font-mono text-3xl font-semibold text-white">{Number(data?.pendingApprovals ?? 0).toLocaleString()}</p></div></div>
          <div className="max-w-sm text-sm leading-6 text-slate-400">Pending totals reflect the active region <span className="font-mono text-slate-200">{data?.region ?? region}</span>. Actions are completed inside each service review screen.</div>
        </section>
        <section aria-label="Pending items by service" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {queue.map(({ name, key, destination, icon: Icon, note }) => {
            const count = Number(data?.[key] ?? 0);
            return <article key={key} data-testid={`approval-queue-${key}`} className="flex min-h-[156px] flex-col justify-between rounded-xl border border-slate-700/60 bg-slate-800/25 p-5">
              <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/60 text-teal-200"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-slate-100">{name}</h2><p className="mt-1 text-xs text-slate-500">{note}</p></div></div><span className={`font-mono text-xl ${count > 0 ? "text-amber-100" : "text-slate-500"}`}>{count.toLocaleString()}</span></div>
              <Link href={`${base}/${destination}`} data-testid={`link-review-${destination}`} className={`mt-5 inline-flex min-h-10 items-center justify-between rounded-lg border px-3 text-xs font-medium transition-colors ${count ? "border-amber-200/20 bg-amber-200/5 text-amber-100 hover:bg-amber-200/10" : "border-slate-700 text-slate-300 hover:bg-slate-700/40"}`}><span>{count ? "Open review queue" : "View service queue"}</span><ArrowRight className="h-4 w-4" /></Link>
            </article>;
          })}
        </section>
        <section className="flex flex-col justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-800/20 p-5 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold text-slate-200">Transaction review</h2><p className="mt-1 text-xs text-slate-500">{Number(data?.pendingTransactions ?? 0).toLocaleString()} pending transactions in the current region.</p></div><Link href={`${base}/transactions`} data-testid="link-pending-transactions" className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-slate-700 px-4 text-xs font-medium text-slate-200 hover:bg-slate-700/40 sm:self-auto">Inspect transactions <ArrowRight className="h-4 w-4" /></Link></section>
      </>}
  </div></PortalLayout>;
}