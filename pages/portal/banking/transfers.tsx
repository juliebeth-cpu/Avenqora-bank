import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import {
  portalListBankingCustomerActions,
  portalListTransfers,
  portalReviewBankingCustomerAction,
  portalReviewTransfer,
} from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Search, Clock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { format } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Pending Review",  cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  approved:  { label: "Successful",      cls: "bg-green-500/20  text-green-400  border-green-500/30"  },
  completed: { label: "Successful",      cls: "bg-green-500/20  text-green-400  border-green-500/30"  },
  rejected:  { label: "Rejected",        cls: "bg-red-500/20    text-red-400    border-red-500/30"    },
  cancelled: { label: "Cancelled",       cls: "bg-slate-500/20  text-slate-400  border-slate-500/30"  },
  refunded:  { label: "Refunded",        cls: "bg-slate-500/20  text-slate-400  border-slate-500/30"  },
};

const FIELD_LABELS: Record<string, string> = {
  recipientAccountName: "Recipient Account Name",
  recipientBankName:    "Recipient Bank Name",
  accountNumber:        "Account Number",
  recipientCountry:     "Recipient Country",
  iban:                 "IBAN",
  swiftBic:             "SWIFT / BIC Code",
  description:          "Description",
  // legacy keys kept for backward compat
  beneficiaryName:      "Beneficiary Name",
  beneficiaryAccount:   "Account Number / IBAN",
  beneficiaryBank:      "Bank Name",
  beneficiaryAddress:   "Address / SWIFT",
  billerName:           "Biller Name",
  billAccountReference: "Bill Account / Reference",
  note:                 "Note",
  walletAddress:        "Wallet Address",
  network:              "Network",
};

const BANKING_ACTION_LABELS: Record<string, string> = {
  bill_payment: "Bill payment",
  zelle: "Zelle",
  sending_order: "Sending order",
};

export default function BankingTransfersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const transfersQuery = useQuery({
    queryKey: ["portal-transfers"],
    queryFn: portalListTransfers,
    refetchInterval: 30_000,
  });
  const bankingActionsQuery = useQuery({
    queryKey: ["portal-banking-customer-actions"],
    queryFn: portalListBankingCustomerActions,
    refetchInterval: 30_000,
  });
  const transfers = transfersQuery.data ?? [];
  const bankingActions = (bankingActionsQuery.data ?? [])
    .filter((item: any) => Object.hasOwn(BANKING_ACTION_LABELS, item.actionType))
    .map((item: any) => ({ ...item, sourceType: "banking_customer_action" }));
  const reviewRows = [
    ...transfers.map((item: any) => ({ ...item, sourceType: "transfer" })),
    ...bankingActions,
  ];
  const isLoading = transfersQuery.isLoading || bankingActionsQuery.isLoading;
  const isBankingAction = (item: any) => item?.sourceType === "banking_customer_action";
  const isBillPayment = (item: any) => isBankingAction(item) && item.actionType === "bill_payment";
  const isInternalLedgerAction = (item: any) => isBankingAction(item) && ["zelle", "sending_order"].includes(item.actionType);
  const bankingActionLabel = (item: any) => BANKING_ACTION_LABELS[item?.actionType] ?? "Banking request";
  const statusBadge = (item: any) => {
    if (isInternalLedgerAction(item) && item.status === "approved") {
      return { ...STATUS_BADGE.approved, label: "Approved (internal)" };
    }
    return STATUS_BADGE[item?.status] ?? { label: item?.status ?? "Unknown", cls: "bg-slate-500/20 text-slate-400 border-slate-500/30" };
  };

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!selected || !action) throw new Error("Choose a request and review action");
      const isBankingRequest = isBankingAction(selected);
      const status = action === "approve" ? "approved" : "rejected";
      const notes = status === "rejected" ? rejectionReason.trim() : undefined;
      if (status === "rejected" && !notes) throw new Error("Rejection reason is required");
      if (isBankingRequest) {
        return portalReviewBankingCustomerAction(selected.id, status, notes);
      }
      if (status === "approved") {
        return portalReviewTransfer(selected.id, "approved", undefined);
      }
      return portalReviewTransfer(selected.id, "rejected", notes);
    },
    onSuccess: async () => {
      const isBankingRequest = isBankingAction(selected);
      const requestLabel = bankingActionLabel(selected);
      toast({
        title: isBankingRequest
          ? (action === "approve"
            ? `${requestLabel} approved${isInternalLedgerAction(selected) ? " (internal)" : ""}`
            : `${requestLabel} declined`)
          : (action === "approve" ? "Transfer approved — marked Successful" : "Transfer rejected"),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["portal-transfers"] }),
        qc.invalidateQueries({ queryKey: ["portal-banking-customer-actions"] }),
      ]);
      closeDialog();
    },
    onError: async (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["portal-transfers"] }),
        qc.invalidateQueries({ queryKey: ["portal-banking-customer-actions"] }),
      ]);
    },
  });

  function closeDialog() {
    setSelected(null);
    setAction(null);
    setRejectionReason("");
  }

  function openReview(t: any) {
    setSelected(t);
    setAction(null);
    setRejectionReason("");
  }

  const isPending = (t: any) => t.status === "pending";
  const pending = reviewRows.filter((t: any) => isPending(t));
  const filtered = reviewRows.filter((t: any) =>
    `${t.customerName ?? ""} ${t.reference ?? ""} ${t.status} ${t.transferType ?? ""} ${t.actionType ?? ""} ${t.details?.billerName ?? ""} ${t.details?.billAccountReference ?? ""} ${t.details?.recipientAccountName ?? ""} ${t.details?.beneficiaryName ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-purple-400" /> Transfers
            </h1>
            <p className="text-slate-400 text-sm mt-1">{reviewRows.length} total · {pending.length} pending review</p>
          </div>
          {pending.length > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-medium">{pending.length} awaiting review</span>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by customer, reference or status..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
        </div>

        {/* Table */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Recipient</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Fee / Net</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10} className="px-4 py-3">
                        <div className="h-4 bg-slate-700/40 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                  {transfersQuery.isError && (
                    <tr><td colSpan={10} className="px-4 py-3 text-center text-red-300">Transfers could not be loaded.</td></tr>
                  )}
                  {bankingActionsQuery.isError && (
                    <tr><td colSpan={10} className="px-4 py-3 text-center text-red-300">Banking action requests could not be loaded.</td></tr>
                  )}
                  {!transfersQuery.isError && !bankingActionsQuery.isError && filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-slate-500">No transfers or banking requests found</td>
                  </tr>
                  ) : filtered.map((t: any) => {
                  const isAction = isBankingAction(t);
                  const isBill = isBillPayment(t);
                  const badge = statusBadge(t);
                  const bd = isAction ? (t.details ?? {}) : (t.beneficiaryDetails ?? {});
                  const recipientName = isBill
                    ? bd.billerName || bd.billAccountReference || "—"
                    : isAction
                      ? bd.recipientAccountName || bd.beneficiaryName || bd.walletAddress || "—"
                    : t.receiver?.name || bd.recipientAccountName || bd.beneficiaryName || "—";
                  return (
                    <tr key={`${t.sourceType}:${t.id}`} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{t.reference}</td>
                      <td className="px-4 py-3 text-slate-300">
                        <div>{t.sender?.name ?? t.customerName ?? "—"}</div>
                        <div className="text-slate-500 text-xs">{t.sender?.customerId ?? t.customerId ? `Customer #${t.sender?.customerId ?? t.customerId}` : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{t.bankingRegion === "EUROPE" ? "Europe" : t.bankingRegion ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-300">{recipientName}</td>
                      <td className="px-4 py-3 text-white font-semibold">
                        {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t.currency}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isAction ? "—" : (
                          <>
                            <div className="text-amber-300">{Number(t.fee ?? 0).toFixed(4)} {t.currency}</div>
                            <div className="text-green-300">{Number(t.netAmount ?? t.amount).toFixed(4)} net</div>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{isAction ? bankingActionLabel(t) : t.transferType?.replace("_", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {format(new Date(t.createdAt), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openReview(t)}
                          className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors">
                          {isPending(t) ? "Review" : "View"} <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                  })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review / View Dialog */}
      <Dialog open={!!selected} onOpenChange={closeDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-purple-400" />
              {isBankingAction(selected)
                ? `${bankingActionLabel(selected)} Request`
                : "Transfer Details"}
            </DialogTitle>
          </DialogHeader>

          {selected && (() => {
            const isAction = isBankingAction(selected);
            const isBill = isBillPayment(selected);
            const bd = isAction ? (selected.details ?? {}) : (selected.beneficiaryDetails ?? {});
            const badge = statusBadge(selected);
            const canReview = selected.status === "pending";
            const infoRows = isBill
              ? [
                  ["Reference", selected.reference],
                  ["Customer Name", selected.customerName ?? "—"],
                  ["From Account", selected.accountLabel ?? "—"],
                  ["Biller", bd.billerName ?? "—"],
                  ["Bill Account / Reference", bd.billAccountReference ?? "—"],
                  ["Note", bd.note ?? "—"],
                  ["Banking Region", selected.bankingRegion ?? "—"],
                  ["Amount", `${Number(selected.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selected.currency}`],
                  ["Due Date", selected.dueAt ? format(new Date(selected.dueAt), "PP") : "—"],
                  ["Date & Time", format(new Date(selected.createdAt), "PPpp")],
                ]
              : isAction
                ? [
                    ["Reference", selected.reference],
                    ["Customer Name", selected.customerName ?? "—"],
                    ["From Account", selected.accountLabel ?? `Account #${selected.accountId}`],
                    ["Request Type", bankingActionLabel(selected)],
                    ["Banking Region", selected.bankingRegion ?? "—"],
                    ["Amount", `${Number(selected.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selected.currency}`],
                    ["Due Date", selected.dueAt ? format(new Date(selected.dueAt), "PP") : "—"],
                    ["Date & Time", format(new Date(selected.createdAt), "PPpp")],
                  ]
              : [
                  ["Reference",     selected.reference],
                  ["Customer Name", selected.customerName ?? "—"],
                  ["Sender", [selected.sender?.name ?? selected.customerName, selected.sender?.customerId ? `Customer #${selected.sender.customerId}` : null].filter(Boolean).join(" · ")],
                  ["Sender Account", selected.sender?.accountNumber ?? selected.fromAccountNumber ?? `Account #${selected.fromAccountId}`],
                  ["Sender Website / Bank", selected.sender?.websiteName ?? "—"],
                  ["Receiver", [selected.receiver?.name, selected.receiver?.customerId ? `Customer #${selected.receiver.customerId}` : null].filter(Boolean).join(" · ") || "—"],
                  ["Receiver Account / Wallet", selected.receiver?.accountNumber ?? selected.receiver?.walletId ?? "—"],
                  ["Receiver Website / Bank", selected.receiver?.websiteName ?? "—"],
                  ["Amount", `${Number(selected.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${selected.currency}`],
                  ["Transaction Fee", `${Number(selected.fee ?? 0).toFixed(4)} ${selected.currency}`],
                  ["Net Amount", `${Number(selected.netAmount ?? selected.amount).toFixed(4)} ${selected.currency}`],
                  ["Transfer Type", selected.transferType?.replace("_", " ")],
                  ["Date & Time", format(new Date(selected.createdAt), "PPpp")],
                ];

            return (
              <div className="space-y-5">
                {/* Status banner */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${badge.cls}`}>
                  {selected.status === "pending" ? <Clock className="w-4 h-4" /> :
                    selected.status === "rejected" ? <XCircle className="w-4 h-4" /> :
                    <CheckCircle2 className="w-4 h-4" />}
                  {badge.label}
                </div>

                {/* Core info */}
                <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-slate-700/30 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {isBill ? "Bill Payment Details" : isAction ? `${bankingActionLabel(selected)} Details` : "Transfer Info"}
                  </div>
                  <div className="divide-y divide-slate-700/40">
                    {infoRows.map(([label, value]) => (
                      <div key={label} className="flex justify-between items-start px-4 py-2.5 gap-4">
                        <span className="text-slate-400 text-sm shrink-0">{label}</span>
                        <span className="text-white text-sm text-right font-mono break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recipient details */}
                {Object.keys(bd).length > 0 && (
                  <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-slate-700/30 text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {isBill ? "Bill Details" : "Recipient Details"}
                    </div>
                    <div className="divide-y divide-slate-700/40">
                      {Object.entries(bd).map(([k, v]) => {
                        const label = FIELD_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").trim();
                        return (
                          <div key={k} className="flex justify-between items-start px-4 py-2.5 gap-4">
                            <span className="text-slate-400 text-sm shrink-0">{label}</span>
                            <span className="text-white text-sm text-right break-all">{String(v)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rejection reason (if already rejected) */}
                {selected.status === "rejected" && selected.adminNotes && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <p className="text-xs text-red-400 font-medium mb-1 uppercase tracking-wider">Rejection Reason</p>
                    <p className="text-red-300 text-sm">{selected.adminNotes}</p>
                  </div>
                )}

                {/* Approval info (if already reviewed) */}
                {(selected.status === "approved" || selected.status === "completed") && selected.reviewedAt && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <p className="text-xs text-green-400 font-medium mb-1 uppercase tracking-wider">
                      {isInternalLedgerAction(selected) ? "Approved internally" : "Approved"}
                    </p>
                    <p className="text-green-300 text-sm">{format(new Date(selected.reviewedAt), "PPpp")}</p>
                    {isInternalLedgerAction(selected) && (
                      <p className="mt-2 text-xs text-green-200/80">Recorded in the internal ledger only. No external payment was sent.</p>
                    )}
                  </div>
                )}

                {/* Action area — only for pending transfers */}
                {canReview && (
                  <div className="space-y-3 pt-1">
                    <p className="text-slate-400 text-sm font-medium">Administrator Action</p>

                    {/* Choose action buttons */}
                    {action === null && (
                      <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => setAction("approve")}
                          className="bg-green-600 hover:bg-green-700 text-white h-11 font-semibold">
                          <CheckCircle2 className="w-4 h-4 mr-2" /> {isBill ? "Approve Bill Payment" : isAction ? `Approve ${bankingActionLabel(selected)}` : "Approve Transfer"}
                        </Button>
                        <Button onClick={() => setAction("reject")} variant="outline"
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-11 font-semibold">
                          <XCircle className="w-4 h-4 mr-2" /> {isBill ? "Decline Bill Payment" : isAction ? `Decline ${bankingActionLabel(selected)}` : "Reject Transfer"}
                        </Button>
                      </div>
                    )}

                    {/* Approve confirmation */}
                    {action === "approve" && (
                      <div className="space-y-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                        <p className="text-green-300 text-sm font-medium">
                          Approve this {isBill ? "bill payment request" : isAction ? `${bankingActionLabel(selected).toLowerCase()} request` : "transfer"} of <strong>{Number(selected.amount).toFixed(2)} {selected.currency}</strong>?
                        </p>
                        {isInternalLedgerAction(selected) ? (
                          <p className="text-green-400/80 text-xs">
                            This updates the customer's internal ledger only. No external payment will be sent.
                          </p>
                        ) : !isBill && !isAction ? (
                          <p className="text-green-400/80 text-xs">
                            The customer's balance will be debited and the transfer will be marked as Successful.
                          </p>
                        ) : null}
                        <div className="flex gap-2">
                          <Button onClick={() => reviewMutation.mutate()}
                            disabled={reviewMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white flex-1">
                            {reviewMutation.isPending ? "Processing..." : "Confirm Approval"}
                          </Button>
                          <Button onClick={() => setAction(null)} variant="outline"
                            className="border-slate-600 text-slate-300">
                            Back
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Reject — requires reason */}
                    {action === "reject" && (
                      <div className="space-y-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                        <p className="text-red-300 text-sm font-medium">Rejection reason <span className="text-red-400">*</span></p>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder={`Enter the reason for declining this ${isBill ? "bill payment request" : isAction ? `${bankingActionLabel(selected).toLowerCase()} request` : "transfer"}. This will be shown to the customer.`}
                          rows={3}
                          className="bg-slate-800 border-slate-600 text-white resize-none placeholder:text-slate-500"
                        />
                        {rejectionReason.trim() === "" && (
                          <p className="text-red-400 text-xs">A reason is required to decline this request.</p>
                        )}
                        <div className="flex gap-2">
                          <Button onClick={() => reviewMutation.mutate()}
                            disabled={reviewMutation.isPending || rejectionReason.trim() === ""}
                            className="bg-red-600 hover:bg-red-700 text-white flex-1">
                            {reviewMutation.isPending ? "Processing..." : "Confirm Rejection"}
                          </Button>
                          <Button onClick={() => setAction(null)} variant="outline"
                            className="border-slate-600 text-slate-300">
                            Back
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
