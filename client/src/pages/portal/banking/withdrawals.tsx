import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { portalListWithdrawals, portalReviewWithdrawal } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpCircle, Search } from "lucide-react";
import { format } from "date-fns";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  hold: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export default function BankingWithdrawalsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("approved");
  const [notes, setNotes] = useState("");

  const { data: withdrawals = [], isLoading } = useQuery({ queryKey: ["portal-withdrawals"], queryFn: portalListWithdrawals });

  const reviewMutation = useMutation({
    mutationFn: () => portalReviewWithdrawal(selected.id, newStatus, notes || undefined),
    onSuccess: () => {
      toast({ title: "Withdrawal updated" });
      qc.invalidateQueries({ queryKey: ["portal-withdrawals"] });
      setSelected(null); setNotes("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = withdrawals.filter((w: any) =>
    `${w.customerName ?? ""} ${w.reference}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6 text-red-400" /> Withdrawals
          </h1>
          <p className="text-slate-400 text-sm mt-1">{withdrawals.length} total withdrawals</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
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
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Destination</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Date</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Review</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-3"><div className="h-4 bg-slate-700/40 rounded animate-pulse" /></td></tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-500">No withdrawals found</td></tr>
                ) : filtered.map((w: any) => (
                  <tr key={w.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{w.reference}</td>
                    <td className="px-4 py-3 text-slate-300">{w.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{w.bankingRegion === "EUROPE" ? "Europe" : w.bankingRegion ?? "—"}</td>
                    <td className="px-4 py-3 text-white font-semibold">{Number(w.amount).toFixed(2)} {w.currency}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-amber-300">{Number(w.fee ?? 0).toFixed(4)} {w.currency}</div>
                      <div className="text-green-300">{Number(w.netAmount ?? w.amount).toFixed(4)} net</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{w.destinationType?.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[w.status] ?? ""}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(w.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-right">
                      {!["approved", "rejected", "cancelled"].includes(w.status) && (
                        <button onClick={() => { setSelected(w); setNewStatus("approved"); }}
                          className="text-xs px-3 py-1 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors">
                          Review
                        </button>
                      )}
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
          <DialogHeader><DialogTitle>Review Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Ref: {selected?.reference} · {selected?.customerName}</p>
            <div className="text-white font-semibold text-lg space-y-1">
              <p>Gross: {selected ? `${Number(selected.amount).toFixed(2)} ${selected.currency}` : ""}</p>
              <p className="text-amber-300 text-sm">Fee: {selected ? `${Number(selected.fee ?? 0).toFixed(4)} ${selected.currency}` : ""}</p>
              <p className="text-green-300 text-sm">Net delivered: {selected ? `${Number(selected.netAmount ?? selected.amount).toFixed(4)} ${selected.currency}` : ""}</p>
            </div>
            {selected && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs border border-slate-700 space-y-1">
                <p className="text-slate-500 font-medium">Transaction Parties</p>
                <p className="text-slate-300">Sender: {selected.sender?.name ?? selected.customerName ?? "—"}{selected.sender?.accountNumber ? ` · ${selected.sender.accountNumber}` : ""}</p>
                <p className="text-slate-300">Receiver: {selected.receiver?.name ?? "Not provided"}{selected.receiver?.accountNumber ?? selected.receiver?.walletId ? ` · ${selected.receiver?.accountNumber ?? selected.receiver?.walletId}` : ""}</p>
              </div>
            )}
            {selected?.destinationDetails && Object.keys(selected.destinationDetails).length > 0 && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs border border-slate-700">
                <p className="text-slate-500 mb-1 font-medium">Destination Details:</p>
                {Object.entries(selected.destinationDetails).map(([k, v]) => (
                  <p key={k} className="text-slate-300"><span className="text-slate-500">{k}:</span> {String(v)}</p>
                ))}
              </div>
            )}
            <div>
              <label className="text-sm text-slate-400 block mb-1">Decision</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="approved">Approve</SelectItem>
                  <SelectItem value="rejected">Reject</SelectItem>
                  <SelectItem value="hold">Hold</SelectItem>
                  <SelectItem value="cancelled">Cancel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Admin notes..."
                rows={2} className="bg-slate-800 border-slate-700 text-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
