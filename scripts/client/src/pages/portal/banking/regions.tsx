import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import { useBankingAdminRegion, setBankingAdminRegion, type BankingAdminRegion } from "@/lib/banking-admin-region";
import { portalGetBankingDashboardForRegion } from "@/lib/portal-api";
import { ArrowRight, Globe, Landmark, RefreshCw, ShieldCheck, Users } from "lucide-react";

const REGIONS: BankingAdminRegion[] = ["ALL", "USA", "EUROPE"];
const REGION_LABELS: Record<BankingAdminRegion, string> = {
  ALL: "All regions",
  USA: "USA",
  EUROPE: "Europe",
};

function formatMoney(currency: string, amount: string | number) {
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

export default function BankingRegionsPage() {
  const currentRegion = useBankingAdminRegion();
  const [, navigate] = useLocation();
  const reports = useQuery({
    queryKey: ["portal-banking-region-overview"],
    queryFn: () => Promise.all(REGIONS.map((region) => portalGetBankingDashboardForRegion(region))),
  });
  const regionData = reports.data ?? [];

  const applyRegion = (region: BankingAdminRegion) => {
    setBankingAdminRegion(region);
    const websiteUid = window.location.pathname.split("/")[2] ?? "";
    navigate(`/portal/${websiteUid}/banking/customers`);
  };

  return (
    <PortalLayout>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-4 border-b border-slate-700/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-300">Banking operations / regional scope</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Regional management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Review live banking totals by region and apply a viewing filter to customer operations.</p>
          </div>
          <div className="rounded-lg border border-slate-700/70 bg-slate-800/35 px-3 py-2 text-xs text-slate-400">
            Active view <span className="ml-1 font-mono text-slate-200">{REGION_LABELS[currentRegion]}</span>
          </div>
        </header>

        <section className="flex items-start gap-3 rounded-xl border border-sky-200/15 bg-sky-200/5 p-4 text-sm text-sky-100/90">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />
          <p>
            Region selection only changes which records are shown. It does not edit customer assignments or account settings.
            Balances stay grouped by their recorded currency; no conversion is applied.
          </p>
        </section>

        {reports.isLoading ? (
          <div aria-label="Loading regional totals" className="grid gap-4 lg:grid-cols-3">
            {REGIONS.map((region) => <div key={region} className="h-72 animate-pulse rounded-2xl border border-slate-700/60 bg-slate-800/30" />)}
          </div>
        ) : reports.isError ? (
          <section role="alert" className="rounded-2xl border border-rose-300/20 bg-rose-300/5 p-7">
            <h2 className="font-medium text-white">Regional totals unavailable</h2>
            <p className="mt-1 text-sm text-slate-400">Live banking totals could not be loaded.</p>
            <button data-testid="button-retry-regions" onClick={() => reports.refetch()} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:bg-slate-700/50">
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </section>
        ) : (
          <section aria-label="Banking totals by region" className="grid gap-4 lg:grid-cols-3">
            {REGIONS.map((region, index) => {
              const data = regionData[index] ?? {};
              const isSelected = currentRegion === region;
              return (
                <article key={region} data-testid={`region-summary-${region}`} className={`rounded-2xl border bg-slate-800/25 p-5 ${isSelected ? "border-teal-200/35 ring-1 ring-teal-200/10" : "border-slate-700/60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{region === "ALL" ? "Consolidated view" : "Banking region"}</p>
                      <h2 className="mt-1 text-xl font-semibold text-white">{REGION_LABELS[region]}</h2>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-200/10 bg-teal-200/5 text-teal-200">
                      {region === "ALL" ? <Globe className="h-5 w-5" /> : <Landmark className="h-5 w-5" />}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-700/50 bg-slate-950/30 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500"><Users className="h-3.5 w-3.5" /> Customers</div>
                      <p className="mt-2 font-mono text-2xl font-semibold text-white">{Number(data.totalCustomers ?? 0).toLocaleString()}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{Number(data.activeCustomers ?? 0).toLocaleString()} active</p>
                    </div>
                    <div className="rounded-xl border border-slate-700/50 bg-slate-950/30 p-3">
                      <div className="flex items-center gap-2 text-xs text-slate-500"><Landmark className="h-3.5 w-3.5" /> Accounts</div>
                      <p className="mt-2 font-mono text-2xl font-semibold text-white">{Number(data.totalAccounts ?? 0).toLocaleString()}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{Number(data.activeAccounts ?? 0).toLocaleString()} active</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-950/30 p-3">
                    <span className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5" /> Pending reviews</span>
                    <span className="font-mono text-sm font-medium text-amber-100">{Number(data.pendingApprovals ?? 0).toLocaleString()}</span>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-medium text-slate-300">Balances by currency</p>
                    {!data.balancesByCurrency?.length ? (
                      <p className="mt-2 text-xs text-slate-500">No balance records for this region.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {data.balancesByCurrency.map((balance: { currency: string; amount: string | number }) => (
                          <div key={balance.currency} className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-mono text-slate-400">{balance.currency}</span>
                            <span className="font-mono text-slate-200">{formatMoney(balance.currency, balance.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    data-testid={`button-view-region-${region}`}
                    onClick={() => applyRegion(region)}
                    className={`mt-5 inline-flex min-h-10 w-full items-center justify-between rounded-lg border px-3 text-xs font-medium transition-colors ${isSelected ? "border-teal-200/20 bg-teal-200/5 text-teal-100" : "border-slate-700 text-slate-200 hover:bg-slate-700/40"}`}
                  >
                    <span>{isSelected ? "Currently selected · view customers" : `View ${REGION_LABELS[region].toLowerCase()} customers`}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </PortalLayout>
  );
}