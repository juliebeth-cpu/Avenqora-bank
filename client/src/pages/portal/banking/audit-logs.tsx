import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { useBankingAdminRegion } from "@/lib/banking-admin-region";
import { portalListBankingAuditLogs } from "@/lib/portal-api";
import { ChevronDown, ClipboardList, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : format(date, "MMM d, yyyy · HH:mm:ss");
};

export default function BankingAuditLogsPage() {
  const region = useBankingAdminRegion();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = useQuery({ queryKey: ["portal-banking-audit-logs", region], queryFn: portalListBankingAuditLogs });
  const logs: any[] = query.data ?? [];
  const statuses = useMemo(() => [...new Set(logs.map((item) => String(item.status ?? "").toLowerCase()).filter(Boolean))].sort(), [logs]);
  const filtered = logs.filter((item) => `${item.actor ?? ""} ${item.action ?? ""} ${item.resourceType ?? ""} ${item.resourceId ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()) && (status === "all" || String(item.status ?? "").toLowerCase() === status));

  return <PortalLayout><div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-col gap-4 border-b border-slate-700/60 pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Banking operations / controls</p><h1 className="text-2xl font-semibold text-white sm:text-3xl">Audit log</h1><p className="mt-2 text-sm text-slate-400">A time-ordered record of banking administration events.</p></div><div className="rounded-lg border border-slate-700/70 bg-slate-800/35 px-3 py-2 text-xs text-slate-400">Region <span className="ml-1 font-mono text-slate-200">{region}</span><span className="mx-2 text-slate-600">/</span>{query.isLoading ? "Loading" : `${filtered.length.toLocaleString()} events`}</div></header>
    <section aria-label="Audit log filters" className="grid gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/25 p-4 md:grid-cols-[minmax(240px,1fr)_220px]">
      <label className="relative block"><span className="sr-only">Search audit events</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input data-testid="input-audit-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action or resource" className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900/50 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-300/50" /></label>
      <label className="relative"><span className="sr-only">Filter audit events by status</span><select data-testid="select-audit-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 w-full appearance-none rounded-lg border border-slate-700 bg-slate-900/50 px-3 pr-9 text-sm capitalize text-slate-200 outline-none focus:border-teal-300/50"><option value="all">All event statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /></label>
    </section>
    {query.isLoading ? <div aria-label="Loading audit events" className="space-y-3">{[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl border border-slate-700/50 bg-slate-800/30" />)}</div>
      : query.isError ? <section role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-8 text-center"><h2 className="font-medium text-white">Audit log unavailable</h2><p className="mt-1 text-sm text-slate-400">We couldn't retrieve events for this region.</p><button data-testid="button-retry-audit" onClick={() => query.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-700/50"><RefreshCw className="h-4 w-4" /> Try again</button></section>
      : filtered.length === 0 ? <section data-testid="empty-audit-logs" className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/15 px-5 py-14 text-center"><ClipboardList className="mx-auto mb-3 h-8 w-8 text-slate-600" /><h2 className="text-sm font-semibold text-slate-200">{logs.length ? "No matching events" : "No audit events recorded"}</h2><p className="mt-1 text-sm text-slate-500">{logs.length ? "Try changing the search or status filter." : "Administrative activity will be recorded here when it occurs."}</p></section>
      : <section className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/20"><div className="divide-y divide-slate-700/40">{filtered.map((event) => <article key={event.id} data-testid={`audit-event-${event.id}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(150px,.8fr)_minmax(150px,1fr)_minmax(180px,1.4fr)_minmax(100px,.6fr)] sm:items-center sm:px-5"><div><p className="text-sm font-medium text-slate-200">{event.actor || "System"}</p><p className="mt-1 text-[11px] text-slate-500">{formatDate(event.createdAt)}</p></div><div><p className="text-sm capitalize text-slate-200">{String(event.action ?? "Action unavailable").replaceAll("_", " ")}</p><p className="mt-1 text-[11px] capitalize text-slate-500">{String(event.resourceType ?? "Resource").replaceAll("_", " ")}</p></div><div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-slate-500">Resource ID</p><p className="mt-1 break-all font-mono text-xs text-slate-300">{event.resourceId ?? "—"}</p></div><div className="sm:text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] capitalize ${String(event.status).toLowerCase() === "success" || String(event.status).toLowerCase() === "completed" ? "border-teal-300/20 bg-teal-300/10 text-teal-200" : String(event.status).toLowerCase().includes("fail") ? "border-rose-300/20 bg-rose-300/10 text-rose-200" : "border-slate-600 bg-slate-700/40 text-slate-300"}`}>{String(event.status ?? "recorded").replaceAll("_", " ")}</span></div></article>)}</div></section>}
  </div></PortalLayout>;
}