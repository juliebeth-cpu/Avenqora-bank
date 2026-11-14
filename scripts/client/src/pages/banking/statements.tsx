import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";
import { bankingDashboard, bankingDownloadStatementCsv, bankingGetStatement } from "@/lib/banking-api";
import { Button } from "@/components/ui/button";
import { FileBarChart, Download, Calendar, ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { format, startOfMonth } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingAmount, formatBankingDate, formatBankingDateTime, getBankingRegionalConfig } from "@/lib/banking-region";

interface Props { params: { websiteUid: string } }

function dateValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function accountLabel(account: any) {
  return `${account.accountType ?? "Account"} ···${String(account.accountNumber ?? "").slice(-4)}`;
}

export default function BankingStatementsPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const money = (value: unknown, currency?: string | null) =>
    formatBankingAmount(value as number | string | null | undefined, currency, regional, { maximumFractionDigits: 4 });
  const [selectedAccount, setSelectedAccount] = useState("");
  const [from, setFrom] = useState(dateValue(startOfMonth(new Date())));
  const [to, setTo] = useState(dateValue(new Date()));
  const [downloading, setDownloading] = useState(false);
  const { data: dashboard } = useQuery({ queryKey: ["banking-dashboard"], queryFn: bankingDashboard });
  const accounts: any[] = dashboard?.accounts ?? [];

  useEffect(() => {
    if (!selectedAccount && accounts[0]?.id) setSelectedAccount(String(accounts[0].id));
  }, [accounts, selectedAccount]);

  const statementQuery = useMemo(
    () => ({ accountId: Number(selectedAccount), from, to }),
    [selectedAccount, from, to],
  );
  const { data: statement, isLoading, isError, refetch } = useQuery({
    queryKey: ["banking-statement", statementQuery],
    queryFn: () => bankingGetStatement(statementQuery),
    enabled: Boolean(selectedAccount),
  });
  const account = statement?.account ?? accounts.find((item) => String(item.id) === selectedAccount);
  const currency = statement?.account?.currency ?? account?.currency ?? "USD";
  const rows: any[] = statement?.transactions ?? [];

  const setPeriod = (value: string) => {
    const now = new Date();
    if (value === "current") {
      setFrom(dateValue(startOfMonth(now)));
      setTo(dateValue(now));
      return;
    }
    const month = new Date(now.getFullYear(), now.getMonth() - Number(value), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    setFrom(dateValue(month));
    setTo(dateValue(end));
  };

  const handleDownload = async () => {
    if (!selectedAccount) return;
    setDownloading(true);
    try {
      const blob = await bankingDownloadStatementCsv(statementQuery);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `statement-${account?.accountNumber ?? selectedAccount}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({ title: "Statement unavailable", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Server-generated record</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white"><FileBarChart className="h-6 w-6 text-blue-400" /> Statements</h1>
            <p className="mt-1 text-sm text-slate-400">Balances and totals are supplied by your banking ledger.</p>
          </div>
          <Button onClick={handleDownload} disabled={!selectedAccount || downloading || isLoading} className="gap-2 bg-blue-600 text-white hover:bg-blue-700"><Download className="h-4 w-4" />{downloading ? "Preparing CSV" : "Download CSV"}</Button>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/50 p-4 md:grid-cols-[1fr_180px_180px_180px]">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500"><span>Account</span><select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)} className="h-10 rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm font-normal text-slate-200"><option value="">Select an account</option>{accounts.map((item) => <option key={item.id} value={item.id}>{accountLabel(item)}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500"><span>Period preset</span><select defaultValue="current" onChange={(event) => setPeriod(event.target.value)} className="h-10 rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm font-normal text-slate-200"><option value="current">This month</option><option value="1">Previous month</option><option value="2">Two months ago</option></select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500"><span>From</span><span className="relative"><Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-full rounded-md border border-slate-700 bg-slate-800/60 pl-9 pr-2 text-sm font-normal text-slate-200" /></span></label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500"><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm font-normal text-slate-200" /></label>
        </div>

        {isLoading ? <CustomerBrandLoader websiteUid={websiteUid} compact label="Generating statement" /> : isError ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-12 text-center"><p className="text-sm font-semibold text-white">Statement could not be generated</p><p className="mt-1 text-xs text-slate-500">Choose another account or try again.</p><Button onClick={() => refetch()} variant="outline" className="mt-4 gap-2 border-slate-600 text-slate-200"><RefreshCw className="h-3.5 w-3.5" /> Try again</Button></div>
        ) : !selectedAccount ? (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-14 text-center"><FileBarChart className="mx-auto h-9 w-9 text-slate-600" /><p className="mt-3 text-sm font-semibold text-slate-300">Select an account to view its statement</p></div>
        ) : statement ? (
          <>
            <section className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-700/60 pb-5">
                <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Account statement</p><h2 className="mt-1 text-lg font-bold capitalize text-white">{account?.accountType ?? "Account"} ···{String(account?.accountNumber ?? "").slice(-4)}</h2><p className="mt-1 text-xs text-slate-500">Currency {currency} · {from} through {to}</p></div>
                <div className="text-left sm:text-right"><p className="text-xs text-slate-500">Period</p><p className="text-sm font-semibold text-slate-200">{statement.period?.from ? formatBankingDate(statement.period.from, regional) : from} – {statement.period?.to ? formatBankingDate(statement.period.to, regional) : to}</p></div>
              </div>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div><dt className="text-xs text-slate-500">Opening balance</dt><dd className="mt-1 font-semibold text-slate-100">{money(statement.openingBalance, currency)}</dd></div>
                <div><dt className="text-xs text-slate-500">Credits</dt><dd className="mt-1 font-semibold text-emerald-400">+{money(statement.credits, currency)}</dd></div>
                <div><dt className="text-xs text-slate-500">Debits</dt><dd className="mt-1 font-semibold text-red-400">−{money(statement.debits, currency)}</dd></div>
                <div><dt className="text-xs text-slate-500">Fees</dt><dd className="mt-1 font-semibold text-amber-300">{money(statement.fees, currency)}</dd></div>
                <div><dt className="text-xs text-slate-500">Closing balance</dt><dd className="mt-1 font-semibold text-slate-100">{money(statement.closingBalance ?? statement.resultingBalance, currency)}</dd></div>
                <div><dt className="text-xs text-slate-500">Resulting balance</dt><dd className="mt-1 font-semibold text-slate-100">{money(statement.resultingBalance ?? statement.closingBalance, currency)}</dd></div>
              </dl>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/35">
              <div className="flex items-center justify-between border-b border-slate-700/60 px-5 py-4"><div><h2 className="text-sm font-semibold text-white">Statement activity</h2><p className="mt-1 text-xs text-slate-500">{statement.transactionCount ?? rows.length} ledger entries</p></div><span className="text-xs text-slate-500">{account?.accountType} · {currency}</span></div>
              {rows.length === 0 ? <div className="p-14 text-center"><p className="text-sm font-semibold text-slate-300">No activity in this period</p><p className="mt-1 text-xs text-slate-500">The server returned an empty statement.</p></div> : <div className="divide-y divide-slate-700/50">{rows.map((row) => { const incoming = row.direction === "incoming"; const rowCurrency = row.currency ?? currency; return <div key={row.id} className="grid gap-3 px-5 py-4 md:grid-cols-[170px_minmax(180px,1fr)_115px_115px_130px] md:items-center"><div className="flex items-center gap-2 text-xs text-slate-500">{incoming ? <ArrowDownLeft className="h-4 w-4 text-emerald-400" /> : <ArrowUpRight className="h-4 w-4 text-red-400" />}{row.createdAt ? formatBankingDateTime(row.createdAt, regional, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable"}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{row.description || row.reference || "Account transaction"}</p><p className="mt-1 truncate font-mono text-[11px] text-slate-500">{row.reference} · {String(row.status ?? "").toUpperCase()}</p></div><div className="text-xs text-slate-400"><span className="block text-[10px] uppercase text-slate-600">Gross</span>{money(row.grossAmount ?? row.amount, rowCurrency)}</div><div className="text-xs text-slate-400"><span className="block text-[10px] uppercase text-slate-600">Fee / net</span>{money(row.fee, rowCurrency)} / {money(row.netAmount ?? row.amount, rowCurrency)}</div><div className="text-left text-xs md:text-right"><span className="block text-[10px] uppercase text-slate-600">Balance after</span><strong className="text-slate-200">{money(row.balanceAfter, rowCurrency)}</strong></div></div>; })}</div>}
            </section>
          </>
        ) : null}
      </div>
    </CustomerBankingLayout>
  );
}