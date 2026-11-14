import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";
import {
  bankingDashboard,
  bankingListTransactions,
  bankingListReceipts,
  bankingListTransfers,
  bankingGenerateTransactionReceipt,
} from "@/lib/banking-api";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingAmount, formatBankingDateTime, getBankingRegionalConfig } from "@/lib/banking-region";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Receipt, Download, Printer, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props { params: { websiteUid: string } }

const LIMIT = 20;

function directionLabel(direction: string | undefined, type: string | undefined) {
  if (direction === "incoming" || type === "credit" || type === "deposit") return "Incoming";
  if (direction === "outgoing" || type === "debit" || type === "withdrawal") return "Outgoing";
  return "Transfer";
}

function directionIcon(direction: string | undefined, type: string | undefined) {
  const label = directionLabel(direction, type);
  return label === "Incoming" ? ArrowDownLeft : label === "Outgoing" ? ArrowUpRight : ArrowLeftRight;
}

function statusClass(status: string | undefined) {
  if (["completed", "approved"].includes(status ?? "")) return "text-emerald-400";
  if (["failed", "rejected"].includes(status ?? "")) return "text-red-400";
  return "text-amber-300";
}

function transactionTitle(item: any) {
  if (item.transactionType === "transfer") {
    const incoming = directionLabel(item.direction, item.transactionType) === "Incoming";
    const party = incoming ? item.sender : item.receiver;
    const name = party?.name ?? (incoming ? item.senderName : item.receiverName);
    if (typeof name === "string" && name.trim()) return `Transfer ${incoming ? "from" : "to"} ${name.trim()}`;
  }
  return item.description || item.reference || "Account transaction";
}

async function downloadReceiptPdf(id: number, receiptNumber: string, token: string | null) {
  if (!token) throw new Error("Your session has expired");
  const response = await fetch(`/api/customer/receipts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Receipt PDF is not available");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${receiptNumber}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function printReceiptPdf(id: number, token: string | null) {
  if (!token) throw new Error("Your session has expired");
  const response = await fetch(`/api/customer/receipts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Receipt PDF is not available");
  const url = URL.createObjectURL(await response.blob());
  const win = window.open(url, "_blank");
  if (win) win.onload = () => win.print();
}

export default function BankingTransactionsPage({ params }: Props) {
  const { websiteUid } = params;
  const base = `/banking/${websiteUid}`;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [page, setPage] = useState(0);
  const [loadingReceipt, setLoadingReceipt] = useState<number | null>(null);
  const token = localStorage.getItem("danzy_banking_token");
  const { customer } = useBankingAuth();
  const regional = useMemo(() => getBankingRegionalConfig(customer), [customer]);
  const money = (value: unknown, currency?: string | null) =>
    formatBankingAmount(value as number | string | null | undefined, currency, regional, { maximumFractionDigits: 4 });

  const { data: dashboard } = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: bankingDashboard,
  });
  const accounts: any[] = dashboard?.accounts ?? [];
  const { data: receipts = [] } = useQuery({
    queryKey: ["banking-receipts"],
    queryFn: bankingListReceipts,
  });
  const { data: transfers = [] } = useQuery({
    queryKey: ["banking-transfers"],
    queryFn: bankingListTransfers,
  });
  const query = {
    accountId: accountId === "all" ? undefined : Number(accountId),
    type: type === "all" ? undefined : type,
    status: status === "all" ? undefined : status,
    limit: LIMIT,
    offset: page * LIMIT,
  };
  const { data: transactions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["banking-transactions", query],
    queryFn: () => bankingListTransactions(query),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const receiptLookup = useMemo(() => {
    const lookup = new Map<string, any>();
    (receipts as any[]).forEach((receipt) => lookup.set(`${receipt.transactionKind}:${receipt.sourceId}`, receipt));
    return lookup;
  }, [receipts]);
  const transferReceipts = useMemo(() => {
    const lookup = new Map<string, any>();
    (transfers as any[]).forEach((transfer) => {
      const receipt = receiptLookup.get(`transfer:${transfer.id}`);
      if (receipt) lookup.set(String(transfer.reference), receipt);
    });
    return lookup;
  }, [receiptLookup, transfers]);

  const visibleTransactions = (transactions as any[]).filter((item) =>
    search.trim()
      ? JSON.stringify(item).toLowerCase().includes(search.trim().toLowerCase())
      : true,
  );
  const hasNext = (transactions as any[]).length === LIMIT;
  const getReceipt = (item: any) => {
    if (item.transactionType === "deposit") return receiptLookup.get(`deposit:${item.id}`);
    if (item.transactionType === "withdrawal") return receiptLookup.get(`withdrawal:${item.id}`);
    if (item.transactionType === "transfer") {
      const transferReceipt = transferReceipts.get(String(item.reference));
      if (transferReceipt) return transferReceipt;
    }
    return (receipts as any[]).find((receipt) => receipt.reference && receipt.reference === item.reference);
  };
  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };
  const receiptAction = async (receipt: any, print: boolean) => {
    setLoadingReceipt(receipt.id);
    try {
      if (print) await printReceiptPdf(receipt.id, token);
      else await downloadReceiptPdf(receipt.id, receipt.receiptNumber, token);
    } catch (error: any) {
      toast({ title: "Receipt unavailable", description: error.message, variant: "destructive" });
    } finally {
      setLoadingReceipt(null);
    }
  };
  const generateReceipt = async (item: any) => {
    setLoadingReceipt(item.id);
    try {
      const receipt = await bankingGenerateTransactionReceipt(item.id);
      await queryClient.invalidateQueries({ queryKey: ["banking-receipts"] });
      await downloadReceiptPdf(receipt.id, receipt.receiptNumber, token);
    } catch (error: any) {
      toast({ title: "Receipt unavailable", description: error.message, variant: "destructive" });
    } finally {
      setLoadingReceipt(null);
    }
  };

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Activity ledger</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-white">
              <FileText className="h-6 w-6 text-blue-400" /> Transaction history
            </h1>
            <p className="mt-1 text-sm text-slate-400">Server-recorded movement across your customer accounts.</p>
          </div>
          <Link href={`${base}/receipts`} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-blue-500 hover:text-white">
            <Receipt className="h-3.5 w-3.5" /> All receipts
          </Link>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-700/70 bg-slate-900/50 p-3 md:grid-cols-[minmax(220px,1fr)_150px_150px_190px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page" className="border-slate-700 bg-slate-800/60 pl-9 text-white placeholder:text-slate-500" />
          </div>
          <select value={type} onChange={(event) => updateFilter(setType, event.target.value)} className="rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm text-slate-200">
            <option value="all">All directions</option>
            <option value="credit">Credits</option>
            <option value="debit">Debits</option>
            <option value="transfer">Transfers</option>
          </select>
          <select value={status} onChange={(event) => updateFilter(setStatus, event.target.value)} className="rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm text-slate-200">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
          <select value={accountId} onChange={(event) => updateFilter(setAccountId, event.target.value)} className="rounded-md border border-slate-700 bg-slate-800/60 px-3 text-sm text-slate-200">
            <option value="all">All accounts</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.accountType} ···{String(account.accountNumber).slice(-4)}</option>)}
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/35">
          {isLoading ? (
            <CustomerBrandLoader websiteUid={websiteUid} compact label="Loading transactions" />
          ) : isError ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-white">Transactions could not be loaded</p>
              <p className="mt-1 text-xs text-slate-500">Your financial records were not changed.</p>
              <Button onClick={() => refetch()} variant="outline" className="mt-4 border-slate-600 text-slate-200">Try again</Button>
            </div>
          ) : visibleTransactions.length === 0 ? (
            <div className="p-14 text-center">
              <FileText className="mx-auto h-9 w-9 text-slate-600" />
              <p className="mt-3 text-sm font-semibold text-slate-300">No transactions match these filters</p>
              <p className="mt-1 text-xs text-slate-500">Try a different account, direction, or status.</p>
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(220px,1.6fr)_110px_120px_140px_44px] gap-4 border-b border-slate-700/60 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 md:grid">
                <span>Transaction</span><span>Direction</span><span>Gross / fee / net</span><span className="text-right">Balance impact</span><span />
              </div>
              <div className="divide-y divide-slate-700/50">
                {visibleTransactions.map((item: any) => {
                  const Icon = directionIcon(item.direction, item.transactionType);
                  const incoming = directionLabel(item.direction, item.transactionType) === "Incoming";
                  const pending = String(item.status ?? "").toLowerCase() === "pending";
                  const receipt = getReceipt(item);
                  return (
                    <div key={item.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-800/35 md:grid-cols-[minmax(220px,1.6fr)_110px_120px_140px_44px] md:items-center md:gap-4">
                      <Link href={`${base}/transactions/${item.id}`} className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${incoming ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-200">{transactionTitle(item)}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500">{item.reference} · {item.createdAt ? formatBankingDateTime(item.createdAt, regional, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable"}</span>
                          <span className={`mt-1 flex items-center gap-1 text-[11px] font-semibold md:hidden ${statusClass(item.status)}`}>
                            {pending && <Pencil aria-label="Pending review" className="h-3 w-3 text-amber-300" />}
                            {pending ? "Pending" : String(item.status ?? "pending").toUpperCase()}
                          </span>
                        </span>
                      </Link>
                      <span className="text-xs font-medium text-slate-400">{directionLabel(item.direction, item.transactionType)}</span>
                      <span className="text-xs leading-5 text-slate-400"><strong className="block text-slate-200">{money(item.grossAmount ?? item.amount, item.currency)}</strong>Fee {money(item.fee, item.currency)}<br />Net {money(item.netAmount ?? item.amount, item.currency)}</span>
                      <span className="text-xs text-slate-500 md:text-right"><strong className={`block ${incoming ? "text-emerald-400" : "text-red-400"}`}>{incoming ? "+" : "−"}{money(item.netAmount ?? item.amount, item.currency)}</strong>{item.balanceAfter != null ? `Balance ${money(item.balanceAfter, item.currency)}` : "Balance pending"}</span>
                      <span className="flex items-center gap-1 md:justify-end">
                        <span className={`hidden items-center gap-1 text-[10px] font-bold md:flex ${statusClass(item.status)}`}>
                          {pending && <Pencil aria-label="Pending review" className="h-3 w-3 text-amber-300" />}
                          {pending ? "PENDING" : String(item.status ?? "pending").toUpperCase()}
                        </span>
                        {receipt ? <span className="flex gap-1">
                          <button aria-label="Download receipt" title="Download receipt" disabled={loadingReceipt === receipt.id} onClick={() => receiptAction(receipt, false)} className="rounded-md p-1.5 text-blue-400 hover:bg-blue-500/15 disabled:opacity-50"><Download className="h-3.5 w-3.5" /></button>
                          <button aria-label="Print receipt" title="Print receipt" disabled={loadingReceipt === receipt.id} onClick={() => receiptAction(receipt, true)} className="rounded-md p-1.5 text-blue-400 hover:bg-blue-500/15 disabled:opacity-50"><Printer className="h-3.5 w-3.5" /></button>
                        </span> : ["pending", "approved", "completed", "rejected", "failed"].includes(String(item.status ?? "").toLowerCase()) && (
                          <button
                            aria-label="Generate receipt"
                            title="Generate receipt"
                            disabled={loadingReceipt === item.id}
                            onClick={() => generateReceipt(item)}
                            className="rounded-md p-1.5 text-blue-400 hover:bg-blue-500/15 disabled:opacity-50"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">Page {page + 1} · {visibleTransactions.length} records shown</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0 || isLoading} onClick={() => setPage((current) => Math.max(0, current - 1))} className="gap-1 border-slate-700 text-slate-300"><ChevronLeft className="h-4 w-4" /> Previous</Button>
            <Button variant="outline" size="sm" disabled={!hasNext || isLoading} onClick={() => setPage((current) => current + 1)} className="gap-1 border-slate-700 text-slate-300">Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>
    </CustomerBankingLayout>
  );
}