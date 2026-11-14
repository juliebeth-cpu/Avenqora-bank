import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";
import { bankingGenerateTransactionReceipt, bankingGetTransaction } from "@/lib/banking-api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, FileText, ShieldCheck, WalletCards } from "lucide-react";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingAmount, formatBankingTransactionDateTime, getBankingRegionalConfig } from "@/lib/banking-region";
import { transactionStatusLabel } from "@/lib/transaction-status";
import { useToast } from "@/hooks/use-toast";

interface Props { params: { websiteUid: string; id: string } }

function fieldLabel(value: unknown) {
  return value === null || value === undefined || value === "" ? "Not provided" : String(value);
}

export default function BankingTransactionDetailPage({ params }: Props) {
  const { websiteUid, id } = params;
  const [, navigate] = useLocation();
  const base = `/banking/${websiteUid}`;
  const [generatingReceipt, setGeneratingReceipt] = useState(false);
  const { toast } = useToast();
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const money = (value: unknown, currency?: string | null) =>
    formatBankingAmount(value as number | string | null | undefined, currency, regional, { maximumFractionDigits: 4 });
  const { data: transaction, isLoading, isError, refetch } = useQuery({
    queryKey: ["banking-transaction", id],
    queryFn: () => bankingGetTransaction(id),
  });
  const handleReceipt = async () => {
    setGeneratingReceipt(true);
    try {
      await bankingGenerateTransactionReceipt(id);
      navigate(`${base}/receipts`);
    } catch (error: any) {
      toast({ title: "Receipt unavailable", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingReceipt(false);
    }
  };

  if (isLoading) {
    return <CustomerBankingLayout websiteUid={websiteUid}><CustomerBrandLoader websiteUid={websiteUid} label="Loading transaction" /></CustomerBankingLayout>;
  }
  if (isError || !transaction) {
    return (
      <CustomerBankingLayout websiteUid={websiteUid}>
        <div className="mx-auto max-w-xl py-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-600" />
          <h1 className="mt-4 text-lg font-semibold text-white">Transaction unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">This transaction may not belong to your account or is no longer available.</p>
          <div className="mt-5 flex justify-center gap-2"><Button variant="outline" onClick={() => refetch()} className="border-slate-600 text-slate-200">Try again</Button><Button onClick={() => navigate(`${base}/transactions`)} className="bg-blue-600 text-white">Back to history</Button></div>
        </div>
      </CustomerBankingLayout>
    );
  }

  const incoming = transaction.direction === "incoming" || transaction.transactionType === "credit" || transaction.transactionType === "deposit";
  const successful = ["approved", "completed", "paid", "successful"].includes(String(transaction.status ?? "").toLowerCase());
  const transferDebit = transaction.transactionType === "transfer" && !incoming;
  const totalDebit = Number(transaction.totalDebit ?? (Number(transaction.grossAmount ?? transaction.amount) + Number(transaction.fee ?? 0)));
  const transactionDate = successful ? transaction.completedAt ?? transaction.createdAt : transaction.createdAt;
  const Icon = incoming ? ArrowDownLeft : transaction.direction === "outgoing" || transaction.transactionType === "debit" || transaction.transactionType === "withdrawal" ? ArrowUpRight : ArrowLeftRight;
  const direction = incoming ? "Incoming" : transaction.direction === "outgoing" ? "Outgoing" : "Transfer";
  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" onClick={() => navigate(`${base}/transactions`)} className="gap-2 px-0 text-slate-400 hover:bg-transparent hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to transaction history</Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={`mt-1 flex h-12 w-12 items-center justify-center rounded-2xl ${incoming ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}><Icon className="h-6 w-6" /></span>
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Transaction detail</p><h1 className="mt-1 text-2xl font-bold text-white">{transaction.description || direction}</h1><p className="mt-1 font-mono text-xs text-slate-500">{fieldLabel(transaction.reference)}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border border-current/20 px-3 py-1 text-xs font-bold ${successful ? "text-emerald-400" : transactionStatusLabel(transaction.status) === "Pending" ? "text-slate-400" : "text-red-400"}`}>{transactionStatusLabel(transaction.status)}</span>
            <Button size="sm" variant="outline" disabled={generatingReceipt} onClick={handleReceipt} className="gap-1.5 border-slate-600 text-slate-200 hover:border-blue-500 hover:text-white">
              <FileText className="h-3.5 w-3.5" /> {generatingReceipt ? "Preparing receipt…" : "Generate / view receipt"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/45 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{direction} amount</p>
          <p className={`mt-2 text-3xl font-bold ${incoming ? "text-emerald-400" : "text-red-400"}`}>{incoming ? "+" : "−"}{money(transferDebit ? totalDebit : transaction.netAmount ?? transaction.amount, transaction.currency)}</p>
          <p className="mt-2 text-xs text-slate-500">{transactionDate ? formatBankingTransactionDateTime(transactionDate, regional, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Date unavailable"}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><WalletCards className="h-4 w-4 text-blue-400" /> Financial details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Gross</dt><dd className="text-slate-200">{money(transaction.grossAmount ?? transaction.amount, transaction.currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Fee</dt><dd className="text-slate-200">{money(transaction.fee, transaction.currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Net</dt><dd className="text-slate-200">{money(transaction.netAmount ?? transaction.amount, transaction.currency)}</dd></div>
              {transferDebit && <div className="flex justify-between gap-4"><dt className="text-slate-500">Total debit</dt><dd className="font-semibold text-slate-100">{money(totalDebit, transaction.currency)}</dd></div>}
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Direction</dt><dd className="text-slate-200">{direction}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Payment method</dt><dd className="text-right text-slate-200">{fieldLabel(transaction.paymentMethod)}</dd></div>
            </dl>
          </section>
          <section className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-5">
            <h2 className="text-sm font-semibold text-white">Account and balance impact</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Account</dt><dd className="text-right text-slate-200">{fieldLabel(transaction.accountType)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Number</dt><dd className="font-mono text-right text-slate-200">{fieldLabel(transaction.accountNumber)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Currency</dt><dd className="text-slate-200">{fieldLabel(transaction.currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Before</dt><dd className="text-slate-200">{transaction.balanceBefore == null ? "Not provided" : money(transaction.balanceBefore, transaction.currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">After</dt><dd className="font-semibold text-slate-100">{transaction.balanceAfter == null ? "Not provided" : money(transaction.balanceAfter, transaction.currency)}</dd></div>
            </dl>
          </section>
        </div>
        <section className="rounded-2xl border border-slate-700/70 bg-slate-900/35 p-5">
          <h2 className="text-sm font-semibold text-white">Record information</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Description</dt><dd className="mt-1 text-slate-200">{fieldLabel(transaction.description)}</dd></div>
            <div><dt className="text-xs text-slate-500">Transaction type</dt><dd className="mt-1 capitalize text-slate-200">{fieldLabel(transaction.transactionType)}</dd></div>
              <div><dt className="text-xs text-slate-500">Completed</dt><dd className="mt-1 text-slate-200">{successful && transaction.completedAt ? formatBankingTransactionDateTime(transaction.completedAt, regional, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not completed"}</dd></div>
            <div><dt className="text-xs text-slate-500">Last updated</dt><dd className="mt-1 text-slate-200">{transaction.updatedAt ? formatBankingTransactionDateTime(transaction.updatedAt, regional, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Not provided"}</dd></div>
          </dl>
        </section>
      </div>
    </CustomerBankingLayout>
  );
}