import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingGetReceipt, bankingListReceipts } from "@/lib/banking-api";
import CustomerBrandLoader from "@/components/customer/customer-brand-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Receipt, Download, Printer, Search, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingAmount, formatBankingTransactionDateTime, getBankingRegionalConfig } from "@/lib/banking-region";
import { transactionStatusLabel } from "@/lib/transaction-status";

interface Props { params: { websiteUid: string } }

const KIND_LABELS: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  transfer: "Transfer",
  investment: "Investment",
  loan: "Loan",
  service_payment: "Service payment",
};

const KIND_COLORS: Record<string, string> = {
  deposit: "bg-green-500/20 text-green-400 border-green-500/30",
  withdrawal: "bg-red-500/20 text-red-400 border-red-500/30",
  transfer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  investment: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  loan: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  service_payment: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

function receiptStatusLabel(status: unknown): string {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (["pending", "processing", "confirming", "pending review"].includes(normalized)) {
    return "Pending — Under Review/network";
  }
  if (["approved", "completed", "paid", "successful"].includes(normalized)) return "Approved";
  if (normalized === "rejected") return "Rejected";
  return transactionStatusLabel(normalized);
}

async function downloadReceiptPdf(id: number, receiptNumber: string, token: string | null) {
  if (!token) throw new Error("Your banking session has expired. Please sign in again.");
  const a = document.createElement("a");
  const response = await fetch(`/api/customer/receipts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "The receipt could not be downloaded.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = `${receiptNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function printReceiptPdf(id: number, token: string | null) {
  if (!token) throw new Error("Your banking session has expired. Please sign in again.");
  const r = await fetch(`/api/customer/receipts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw new Error(body?.error ?? "The receipt could not be opened for printing.");
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (win) { win.onload = () => win.print(); }
}

export default function BankingReceiptsPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const token = localStorage.getItem("danzy_banking_token");

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["banking-receipts"],
    queryFn: bankingListReceipts,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const { data: receiptDetail, isFetching: isFetchingDetail } = useQuery({
    queryKey: ["banking-receipt", expandedId],
    queryFn: () => bankingGetReceipt(expandedId as number),
    enabled: expandedId !== null,
  });

  const filtered = (receipts as any[]).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );

  const handleDownload = async (r: any) => {
    setLoadingId(r.id);
    try { await downloadReceiptPdf(r.id, r.receiptNumber, token); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setTimeout(() => setLoadingId(null), 1500); }
  };

  const handlePrint = async (r: any) => {
    setLoadingId(r.id);
    try { await printReceiptPdf(r.id, token); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoadingId(null); }
  };

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-400" /> My Receipts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Receipts show the current status of your banking transactions
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search receipts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {isLoading ? (
          <CustomerBrandLoader websiteUid={websiteUid} compact label="Loading receipts" />
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl py-16 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No receipts yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Transfer receipts are created when a request is submitted and update as it is reviewed
            </p>
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            <div className="divide-y divide-slate-700/40">
              {filtered.map((r: any) => (
                <div key={r.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-5 h-5 text-blue-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-white font-semibold text-sm font-mono">{r.receiptNumber}</span>
                      <Badge className={`text-xs border ${KIND_COLORS[r.transactionKind] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30"}`}>
                        {KIND_LABELS[r.transactionKind] ?? r.transactionKind}
                      </Badge>
                      <Badge className={`text-xs border ${
                        ["completed", "approved"].includes(String(r.status).toLowerCase())
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : ["rejected", "failed", "cancelled", "reversed"].includes(String(r.status).toLowerCase())
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                      }`}>
                        {receiptStatusLabel(r.status)}
                      </Badge>
                    </div>
                    <p className="text-slate-300 font-semibold">
                      {r.transactionKind === "transfer" && <span className="text-xs text-slate-500 font-normal mr-1">Total debit</span>}
                      {formatBankingAmount(
                        r.transactionKind === "transfer" ? r.totalDebit ?? Number(r.grossAmount ?? r.amount) + Number(r.fee ?? 0) : r.amount,
                        r.currency,
                        regional,
                        r.transactionKind === "transfer" ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined,
                      )}
                    </p>
                    {r.transactionKind === "transfer" ? (
                      <p className="text-xs text-slate-500">
                        Principal {formatBankingAmount(r.grossAmount ?? r.amount, r.currency, regional, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {" · "}Fee {formatBankingAmount(r.fee ?? 0, r.currency, regional, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    ) : (r.fee !== undefined || r.netAmount !== undefined) && (
                      <p className="text-xs text-slate-500">
                        Fee {formatBankingAmount(r.fee ?? 0, r.currency, regional, { maximumFractionDigits: 4 })} · Net {formatBankingAmount(r.netAmount ?? r.amount, r.currency, regional, { maximumFractionDigits: 4 })}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-0.5">
                      <p className="text-slate-500 text-xs">
                         {formatBankingTransactionDateTime(r.issuedAt, regional, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      {r.reference && (
                         <p className="text-slate-500 text-xs font-mono">Tracking: {r.reference}</p>
                      )}
                      {r.paymentMethod && (
                        <p className="text-slate-500 text-xs">via {r.paymentMethod}</p>
                      )}
                      {(r.senderName || r.recipientName) && (
                        <p className="text-slate-500 text-xs truncate">
                          From {r.senderName ?? "—"} to {r.recipientName ?? "—"}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-slate-400 hover:text-white"
                      onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    >
                      {expandedId === r.id ? "Hide details" : "Details"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:text-white hover:border-blue-500 text-xs"
                      disabled={loadingId === r.id}
                      onClick={() => handleDownload(r)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:text-white hover:border-blue-500 text-xs"
                      disabled={loadingId === r.id}
                      onClick={() => handlePrint(r)}
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      Print
                    </Button>
                  </div>
                  {expandedId === r.id && (
                    <div className="w-full rounded-xl border border-slate-700/70 bg-slate-950/50 p-4 text-xs sm:col-span-2">
                      {isFetchingDetail ? (
                        <CustomerBrandLoader websiteUid={websiteUid} compact label="Loading receipt details" />
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div><p className="text-slate-600">Direction</p><p className="mt-1 font-semibold capitalize text-slate-200">{receiptDetail?.direction ?? r.direction ?? "Not provided"}</p></div>
                          {r.transactionKind === "transfer" ? (
                            <>
                              <div><p className="text-slate-600">Principal amount</p><p className="mt-1 font-semibold text-slate-200">{formatBankingAmount(receiptDetail?.grossAmount ?? r.grossAmount ?? r.amount ?? 0, receiptDetail?.currency ?? r.currency, regional, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                              <div><p className="text-slate-600">Transfer fee</p><p className="mt-1 font-semibold text-slate-200">{formatBankingAmount(receiptDetail?.fee ?? r.fee ?? 0, receiptDetail?.currency ?? r.currency, regional, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                              <div><p className="text-slate-600">Total debit amount</p><p className="mt-1 font-semibold text-slate-200">{formatBankingAmount(receiptDetail?.totalDebit ?? r.totalDebit ?? 0, receiptDetail?.currency ?? r.currency, regional, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                            </>
                          ) : (
                            <>
                              <div><p className="text-slate-600">Gross</p><p className="mt-1 font-semibold text-slate-200">{formatBankingAmount(receiptDetail?.grossAmount ?? r.grossAmount ?? r.amount ?? 0, receiptDetail?.currency ?? r.currency, regional, { maximumFractionDigits: 4 })}</p></div>
                              <div><p className="text-slate-600">Fee / net</p><p className="mt-1 text-slate-200">{formatBankingAmount(receiptDetail?.fee ?? r.fee ?? 0, receiptDetail?.currency ?? r.currency, regional, { maximumFractionDigits: 4 })} / {formatBankingAmount(receiptDetail?.netAmount ?? r.netAmount ?? r.amount ?? 0, receiptDetail?.currency ?? r.currency, regional, { maximumFractionDigits: 4 })}</p></div>
                            </>
                          )}
                          <div><p className="text-slate-600">Account</p><p className="mt-1 font-mono text-slate-200">{receiptDetail?.accountNumber ?? r.accountNumber ?? "Not provided"}</p><p className="text-slate-500">{receiptDetail?.accountType ?? r.accountType ?? ""}</p></div>
                          {r.transactionKind === "transfer" && (
                            <>
                              <div><p className="text-slate-600">Beneficiary bank</p><p className="mt-1 text-slate-200">{receiptDetail?.beneficiaryBankName ?? r.beneficiaryBankName ?? "Not provided"}</p></div>
                              {(receiptDetail?.recipientIban ?? r.recipientIban) ? (
                                <div><p className="text-slate-600">Beneficiary IBAN</p><p className="mt-1 font-mono text-slate-200">{receiptDetail?.recipientIban ?? r.recipientIban}</p></div>
                              ) : (
                                <div><p className="text-slate-600">Beneficiary account</p><p className="mt-1 font-mono text-slate-200">{receiptDetail?.recipientAccount ?? r.recipientAccount ?? "Not provided"}</p></div>
                              )}
                              <div><p className="text-slate-600">BIC / SWIFT</p><p className="mt-1 font-mono text-slate-200">{receiptDetail?.swiftBic ?? r.swiftBic ?? "Not provided"}</p></div>
                              <div><p className="text-slate-600">Routing number</p><p className="mt-1 font-mono text-slate-200">{receiptDetail?.routingNumber ?? r.routingNumber ?? "Not provided"}</p></div>
                              <div><p className="text-slate-600">Payment reference</p><p className="mt-1 text-slate-200">{receiptDetail?.paymentReference ?? r.paymentReference ?? "Not provided"}</p></div>
                            </>
                          )}
                          <div><p className="text-slate-600">Reviewer</p><p className="mt-1 text-slate-200">{receiptDetail?.reviewerName ?? r.reviewerName ?? receiptDetail?.reviewedBy ?? r.reviewedBy ?? "Not provided"}</p></div>
                          <div className="sm:col-span-2 lg:col-span-3"><p className="text-slate-600">Rejection details</p><p className="mt-1 text-slate-200">{receiptDetail?.rejectionReason ?? r.rejectionReason ?? "None recorded"}</p></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-slate-600 text-xs text-center">
          Receipts are permanently stored and will never disappear. Contact support if a receipt is missing.
        </p>
      </div>
    </CustomerBankingLayout>
  );
}
