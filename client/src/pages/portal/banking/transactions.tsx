import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import { useBankingAdminRegion } from "@/lib/banking-admin-region";
import { portalListBankingTransactions } from "@/lib/portal-api";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, RefreshCw, Search, Wallet } from "lucide-react";
import { formatBankingAdminDateTime } from "@/lib/banking-region";

const dateLabel = (value: string) => {
  return formatBankingAdminDateTime(value);
};
const statusStyles: Record<string, string> = {
  completed: "border-teal-300/20 bg-teal-300/10 text-teal-200",
  approved: "border-teal-300/20 bg-teal-300/10 text-teal-200",
  pending: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  processing: "border-sky-300/20 bg-sky-300/10 text-sky-200",
  failed: "border-rose-300/20 bg-rose-300/10 text-rose-200",
  rejected: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

export default function BankingTransactionsPage() {
  const region = useBankingAdminRegion();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const query = useQuery({ queryKey: ["portal-banking-transactions", region], queryFn: portalListBankingTransactions });
  const items: any[] = query.data ?? [];
  const types = useMemo(() => [...new Set(items.map((item) => String(item.transactionType ?? "").toLowerCase()).filter(Boolean))].sort(), [items]);
  const statuses = useMemo(() => [...new Set(items.map((item) => String(item.status ?? "").toLowerCase()).filter(Boolean))].sort(), [items]);
  const filtered = items.filter((tx) => {
    const haystack = `${tx.transactionId ?? ""} ${tx.customerName ?? ""} ${tx.accountNumber ?? ""} ${tx.reference ?? ""} ${tx.description ?? ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase()) &&
      (type === "all" || String(tx.transactionType ?? "").toLowerCase() === type) &&
      (status === "all" || String(tx.status ?? "").toLowerCase() === status);
  });
  const base = `/portal/${window.location.pathname.split("/")[2] ?? ""}/banking`;
  const typeIcon = (value: string) => value.includes("deposit") || value.includes("credit") ? ArrowDownLeft : value.includes("withdraw") || value.includes("debit") ? ArrowUpRight : ArrowLeftRight;

  return <PortalLayout>
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-slate-700/60 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Banking operations / ledger</p><h1 className="text-2xl font-semibold text-white sm:text-3xl">Transactions</h1><p className="mt-2 text-sm text-slate-400">A searchable record of posted and in-flight customer activity.</p></div><div className="rounded-lg border border-slate-700/70 bg-slate-800/35 px-3 py-2 text-xs text-slate-400"><span className="font-mono text-slate-200">{region}</span><span className="mx-2 text-slate-600">/</span>{query.isLoading ? "Loading records" : `${filtered.length.toLocaleString()} of ${items.length.toLocaleString()} records`}</div></header>
      <section aria-label="Transaction filters" className="grid gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/25 p-4 md:grid-cols-[minmax(240px,1fr)_190px_190px]">
        <label className="relative block"><span className="sr-only">Search transactions</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input data-testid="input-transaction-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, reference or account" className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-300/50" /></label>
        <label className="relative"><span className="sr-only">Filter by transaction type</span><select data-testid="select-transaction-type" value={type} onChange={(event) => setType(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900/50 px-3 pr-9 text-sm capitalize text-slate-200 outline-none focus:border-teal-300/50"><option value="all">All transaction types</option>{types.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></label>
        <label className="relative"><span className="sr-only">Filter by status</span><select data-testid="select-transaction-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900/50 px-3 pr-9 text-sm capitalize text-slate-200 outline-none focus:border-teal-300/50"><option value="all">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></label>
      </section>
      {query.isLoading ? <div aria-label="Loading transactions" className="space-y-3">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-[76px] animate-pulse rounded-xl border border-slate-700/50 bg-slate-800/30" />)}</div>
        : query.isError ? <section role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-8 text-center"><p className="font-medium text-white">Transactions could not be loaded</p><p className="mt-1 text-sm text-slate-400">Check your connection and try again.</p><button data-testid="button-retry-transactions" onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-700/50"><RefreshCw className="h-4 w-4" /> Retry</button></section>
        : filtered.length === 0 ? <section data-testid="empty-transactions" className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/15 px-5 py-14 text-center"><Wallet className="mx-auto mb-3 h-8 w-8 text-slate-600" /><h2 className="text-sm font-semibold text-slate-200">{items.length ? "No matching transactions" : "No transactions yet"}</h2><p className="mt-1 text-sm text-slate-500">{items.length ? "Adjust the search or filters to see more activity." : "Regional transaction activity will appear here once recorded."}</p></section>
        : <section className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/20">
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700/60 bg-slate-800/45 text-[11px] uppercase tracking-wide text-slate-500"><th className="px-5 py-3 font-medium">Transaction</th><th className="px-5 py-3 font-medium">Customer / account</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 text-right font-medium">Amount</th><th className="px-5 py-3 font-medium">Region</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Created</th></tr></thead><tbody>{filtered.map((tx) => { const Icon = typeIcon(String(tx.transactionType ?? "").toLowerCase()); return <tr key={tx.id} data-testid={`row-transaction-${tx.id}`} className="border-b border-slate-700/35 last:border-0 hover:bg-slate-700/15"><td className="px-5 py-4"><p className="font-mono text-xs text-slate-200">{tx.transactionId || tx.reference || `TX-${tx.id}`}</p><p className="mt-1 max-w-[220px] truncate text-xs text-slate-500">{tx.description || "—"}</p></td><td className="px-5 py-4"><p className="text-slate-200">{tx.customerName || "—"}</p><p className="mt-1 font-mono text-[11px] text-slate-500">{tx.accountNumber || "Account unavailable"}</p></td><td className="px-5 py-4"><span className="inline-flex items-center gap-2 capitalize text-slate-300"><Icon className="h-4 w-4 text-slate-500" />{String(tx.transactionType ?? "other").replaceAll("_", " ")}</span></td><td className="px-5 py-4 text-right font-mono text-slate-100">{tx.currency} {Number(tx.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td className="px-5 py-4 text-xs text-slate-400">{tx.region || "—"}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] capitalize ${statusStyles[String(tx.status ?? "").toLowerCase()] ?? "border-slate-600 bg-slate-700/40 text-slate-300"}`}>{String(tx.status ?? "unknown").replaceAll("_", " ")}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">{dateLabel(tx.createdAt)}</td></tr>; })}</tbody></table></div>
          <div className="divide-y divide-slate-700/40 md:hidden">{filtered.map((tx) => { const Icon = typeIcon(String(tx.transactionType ?? "").toLowerCase()); return <article key={tx.id} data-testid={`transaction-card-${tx.id}`} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-xs text-slate-200">{tx.transactionId || tx.reference || `TX-${tx.id}`}</p><p className="mt-1 truncate text-sm text-slate-300">{tx.customerName || "Customer unavailable"}</p></div><p className="whitespace-nowrap font-mono text-sm text-white">{tx.currency} {Number(tx.amount ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5 capitalize"><Icon className="h-3.5 w-3.5" />{String(tx.transactionType ?? "other").replaceAll("_", " ")} · {tx.accountNumber || "No account"}</span><span className={`rounded-full border px-2 py-0.5 capitalize ${statusStyles[String(tx.status ?? "").toLowerCase()] ?? "border-slate-600 text-slate-300"}`}>{String(tx.status ?? "unknown").replaceAll("_", " ")}</span></div><p className="text-[11px] text-slate-500">{tx.region || "Region unavailable"} · {dateLabel(tx.createdAt)}</p></article>; })}</div>
        </section>}
       <div className="flex justify-end"><Link href={`/portal/${window.location.pathname.split("/")[2] ?? ""}/banking/dashboard`} data-testid="link-return-dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"><ArrowLeftRight className="h-4 w-4" /> Operations overview</Link></div>
    </div>
  </PortalLayout>;
}