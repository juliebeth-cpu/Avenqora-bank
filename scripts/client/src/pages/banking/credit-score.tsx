import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { Button } from "@/components/ui/button";
import { useBankingAuth } from "@/lib/banking-auth";
import { bankingGetCreditScore } from "@/lib/banking-api";
import { publicInfo } from "@/lib/portal-api";
import { formatBankingDateTime, getBankingRegionalConfig } from "@/lib/banking-region";
import { AlertCircle, ArrowLeft, Gauge, Minus, Plus, ShieldCheck } from "lucide-react";

interface Props { params: { websiteUid: string } }

export default function BankingCreditScorePage({ params }: Props) {
  const { websiteUid } = params;
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const websiteQuery = useQuery({
    queryKey: ["website-theme", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });
  const scoreQuery = useQuery({
    queryKey: ["banking-credit-score"],
    queryFn: bankingGetCreditScore,
  });
  const score = Number(scoreQuery.data?.score ?? 165);
  const baseline = Number(scoreQuery.data?.baseline ?? 165);
  const progress = Math.max(0, Math.min(100, ((score - 165) / 685) * 100));
  const events = scoreQuery.data?.history ?? [];
  const bankName = String((websiteQuery.data as { name?: string } | undefined)?.name ?? "").trim();

  return (
    <CustomerBankingLayout websiteUid={websiteUid} appearance="banking">
      <div className="mx-auto max-w-3xl space-y-6" data-testid="banking-credit-score">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="bank-title flex items-center gap-2 text-2xl font-semibold">
              <Gauge className="bank-accent h-6 w-6" /> Your credit score
            </h1>
            <p className="bank-muted mt-1 text-sm">
              {bankName
                ? `Your internal payment-history score for ${bankName}.`
                : "Your internal payment-history score."}
            </p>
          </div>
          <Button variant="outline" asChild className="rounded-xl">
            <Link href={`/banking/${websiteUid}/dashboard`}><ArrowLeft className="mr-2 h-4 w-4" /> Banking overview</Link>
          </Button>
        </header>

        {scoreQuery.isError ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
            <AlertCircle className="mr-2 inline h-4 w-4" />
            Could not load your score. Please refresh and try again.
          </div>
        ) : (
          <section className="bank-surface rounded-3xl border p-6 sm:p-8" aria-label="Current credit score">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="bank-muted text-sm">Current score</p>
                <p className="bank-title mt-1 text-5xl font-bold tracking-tight">{scoreQuery.isLoading ? "—" : score}</p>
                <p className="bank-muted mt-2 text-sm">Range 165–850 · Starting score {baseline}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bank-surface-soft)] p-3">
                <ShieldCheck className="bank-accent h-7 w-7" />
              </div>
            </div>
            <div className="mt-6">
              <div className="h-3 overflow-hidden rounded-full bg-[var(--bank-surface-soft)]" role="progressbar" aria-valuemin={165} aria-valuemax={850} aria-valuenow={score}>
                <div className="h-full rounded-full bg-[var(--bank-accent)] transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="bank-muted mt-2 flex justify-between text-xs"><span>165</span><span>850</span></div>
            </div>
          </section>
        )}

        <section className="space-y-3" aria-labelledby="credit-history-title">
          <div className="flex items-center justify-between">
            <h2 id="credit-history-title" className="bank-title text-base font-semibold">Credit score history</h2>
            <span className="bank-muted text-xs">Most recent 30 events</span>
          </div>
          {scoreQuery.isLoading ? (
            <div className="bank-surface rounded-2xl border p-6 text-center bank-muted text-sm">Loading score history…</div>
          ) : events.length === 0 ? (
            <div className="bank-surface rounded-2xl border p-6 text-center">
              <Gauge className="bank-muted mx-auto h-6 w-6" />
              <p className="bank-muted mt-2 text-sm">Score adjustments will appear here as eligible payment requests settle.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event: any) => {
                const delta = Number(event.pointsDelta ?? 0);
                return (
                  <article key={event.id} className="bank-surface flex items-start justify-between gap-4 rounded-2xl border p-4">
                    <div className="min-w-0">
                      <p className="bank-title text-sm font-medium">{delta > 0 ? "Successful transaction" : event.description || event.eventType.replaceAll("_", " ")}</p>
                      <p className="bank-muted mt-1 text-xs">{formatBankingDateTime(event.createdAt, regional)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`flex items-center justify-end gap-1 text-sm font-semibold ${delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : "bank-muted"}`}>
                        {delta > 0 ? <Plus className="h-3.5 w-3.5" /> : delta < 0 ? <Minus className="h-3.5 w-3.5" /> : null}
                        {delta > 0 ? `+${delta}` : delta}
                      </p>
                      <p className="bank-muted mt-1 text-xs">{event.scoreBefore} → {event.scoreAfter}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </CustomerBankingLayout>
  );
}
