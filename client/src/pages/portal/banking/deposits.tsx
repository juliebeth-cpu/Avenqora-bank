import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { portalListDeposits, portalReviewDeposit } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownCircle, Search, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { buildReceiptUrl } from "@/lib/receipt-url";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  confirming: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  expired: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function BankingDepositsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("approved");
  const [notes, setNotes] = useState("");

  const { data: deposits = [], isLoading } = useQuery({
    queryKey: ["portal-deposits"],
    queryFn: async () => {
      const rows = await portalListDeposits();
      return (Array.isArray(rows) ? rows : []).map((row: any) => ({
        ...row,
        createdAt: row.createdAt ?? row.created_at ?? null,
      }));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => portalReviewDeposit(selected.id, newStatus, notes || undefined),
    onSuccess: () => {
      toast({ title: "Deposit updated" });
      qc.invalidateQueries({ queryKey: ["portal-deposits"] });
      setSelected(null);
      setNotes("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = deposits.filter((d: any) =>
    `${d.customerName ?? ""} ${d.reference}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ArrowDownCircle className="w-6 h-6 text-green-400" /> Deposits
            </h1>
            <p className="text-slate-400 text-sm mt-1">{deposits.length} total deposits</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by customer or reference..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Fee / Net</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Method</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-700/30">
                    <td colSpan={9} className="px-4 py-3"><div className="h-4 bg-slate-700/40 rounded animate-pulse" /></td>
                  </tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-500">No deposits found</td></tr>
                ) : filtered.map((d: any) => (
                  <tr key={d.id} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{d.reference}</td>
                    <td className="px-4 py-3 text-slate-300">{d.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{d.bankingRegion === "EUROPE" ? "Europe" : d.bankingRegion ?? "—"}</td>
                    <td className="px-4 py-3 text-white font-semibold">{Number(d.amount).toFixed(2)} {d.currency}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-amber-300">{Number(d.fee ?? 0).toFixed(4)} {d.currency}</div>
                      <div className="text-green-300">{Number(d.netAmount ?? d.amount).toFixed(4)} net</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{d.method.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{d.createdAt && !Number.isNaN(new Date(d.createdAt).getTime())
                      ? format(new Date(d.createdAt), "MMM d, yyyy HH:mm")
                      : "Date unavailable"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {d.receiptUrl && (
                          <a href={buildReceiptUrl(d.receiptUrl)!} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors" title="View receipt">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {d.status !== "approved" && d.status !== "rejected" && d.status !== "expired" && (
                          <>
                            <button onClick={() => { setSelected(d); setNewStatus("approved"); }}
                              className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors" title="Approve">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button onClick={() => { setSelected(d); setNewStatus("rejected"); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Reject">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>{newStatus === "approved" ? "Approve" : "Reject"} Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">Ref: {selected?.reference} — {selected?.customerName}</p>
             <div className="text-white font-semibold space-y-1">
               <p>Gross: {selected ? `${Number(selected.amount).toFixed(2)} ${selected.currency}` : ""}</p>
               <p className="text-amber-300 text-sm">Fee: {selected ? `${Number(selected.fee ?? 0).toFixed(4)} ${selected.currency}` : ""}</p>
               <p className="text-green-300 text-sm">Net credited: {selected ? `${Number(selected.netAmount ?? selected.amount).toFixed(4)} ${selected.currency}` : ""}</p>
             </div>
             {selected && (
               <div className="bg-slate-800 rounded-lg p-3 text-xs border border-slate-700 space-y-1">
                 <p className="text-slate-500 font-medium">Transaction Parties</p>
                 <p className="text-slate-300">Sender: {selected.sender?.name ?? "Not provided"}{selected.sender?.accountNumber ? ` · ${selected.sender.accountNumber}` : ""}</p>
                 <p className="text-slate-300">Receiver: {selected.receiver?.name ?? selected.customerName ?? "—"}{selected.receiver?.accountNumber ? ` · ${selected.receiver.accountNumber}` : ""}</p>
               </div>
             )}
            {selected?.receivingBankAccountSnapshot && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs border border-slate-700 space-y-1">
                <p className="text-slate-500 font-medium">Receiving Bank Account at Submission</p>
                <p className="text-slate-300">{selected.receivingBankAccountSnapshot.displayName} · {selected.receivingBankAccountSnapshot.bankName}</p>
                <p className="text-slate-300">Account holder: {selected.receivingBankAccountSnapshot.accountName}</p>
                <p className="text-slate-300">Account number: {selected.receivingBankAccountSnapshot.accountNumber}</p>
                {selected.receivingBankAccountSnapshot.routingNumber && <p className="text-slate-300">Routing number: {selected.receivingBankAccountSnapshot.routingNumber}</p>}
                {selected.receivingBankAccountSnapshot.iban && <p className="text-slate-300">IBAN: {selected.receivingBankAccountSnapshot.iban}</p>}
                {selected.receivingBankAccountSnapshot.swiftBic && <p className="text-slate-300">SWIFT / BIC: {selected.receivingBankAccountSnapshot.swiftBic}</p>}
              </div>
            )}
            {selected?.paymentInstructions && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300 border border-slate-700">
                <p className="text-slate-500 mb-1">Payment instructions provided:</p>
                <p className="whitespace-pre-wrap">{selected.paymentInstructions}</p>
              </div>
            )}
            <div>
              <label className="text-sm text-slate-400 block mb-1">Admin Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..." rows={3}
                className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}
              className={newStatus === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
              Confirm {newStatus === "approved" ? "Approval" : "Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
