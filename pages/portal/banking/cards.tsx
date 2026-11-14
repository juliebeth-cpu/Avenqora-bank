import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { portalListCards, portalReviewCard } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Search, CheckCircle, XCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useBankingAdminRegion } from "@/lib/banking-admin-region";
import { portalDeleteCard } from "@/lib/portal-api";

const statusColor: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  declined: "bg-red-500/20 text-red-400 border-red-500/30",
};

export default function BankingCardsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [action, setAction] = useState<"approved" | "declined">("approved");
  const [declineReason, setDeclineReason] = useState("");
  const region = useBankingAdminRegion();

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["portal-cards", region],
    queryFn: portalListCards,
    refetchInterval: 15_000,
  });

  const reviewMutation = useMutation({
    mutationFn: () => portalReviewCard(selected.id, action, action === "declined" ? declineReason.trim() : undefined),
    onSuccess: () => {
      toast({ title: "Card updated" });
      qc.invalidateQueries({ queryKey: ["portal-cards"] });
      qc.invalidateQueries({ queryKey: ["portal-banking-dashboard"] });
      setSelected(null); setDeclineReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!deleteTarget) throw new Error("Select a card to delete");
      return portalDeleteCard(deleteTarget.id);
    },
    onSuccess: () => {
      toast({ title: "Card deleted" });
      qc.invalidateQueries({ queryKey: ["portal-cards"] });
      qc.invalidateQueries({ queryKey: ["portal-banking-dashboard"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const filtered = cards.filter((c: any) =>
    `${c.customerName ?? ""} ${c.cardHolderName} ${c.lastFourDigits}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-400" /> Bank Cards
          </h1>
          <p className="text-slate-400 text-sm mt-1">{cards.length} card submissions</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search by customer or card holder..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500" />
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Customer</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Region</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Card Holder</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Card</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Expiry</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium">Submitted</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-4 bg-slate-700/40 rounded animate-pulse" /></td></tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-slate-500">No card submissions</td></tr>
                ) : filtered.map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-slate-300">{c.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{c.bankingRegion === "EUROPE" ? "Europe" : c.bankingRegion ?? "—"}</td>
                    <td className="px-4 py-3 text-white">{c.cardHolderName}</td>
                    <td className="px-4 py-3 text-slate-300 font-mono">
                      {c.cardBrand} •••• {c.lastFourDigits}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{c.expiryMonth}/{c.expiryYear}</td>
                    <td className="px-4 py-3">
                      <span data-testid={`status-card-${c.id}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor[c.status] ?? ""}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{format(new Date(c.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {c.status === "pending" && (
                          <>
                          <button onClick={() => { setSelected(c); setAction("approved"); }}
                            disabled={reviewMutation.isPending}
                            data-testid={`button-approve-card-${c.id}`}
                            className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-50" title="Approve" aria-label={`Approve card ending in ${c.lastFourDigits}`}>
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => { setSelected(c); setAction("declined"); }}
                            disabled={reviewMutation.isPending}
                            data-testid={`button-decline-card-${c.id}`}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50" title="Decline" aria-label={`Decline card ending in ${c.lastFourDigits}`}>
                            <XCircle className="w-4 h-4" />
                          </button>
                          </>
                        )}
                      {c.status === "declined" && c.declineReason && (
                        <span className="text-xs text-red-400" title={c.declineReason}>Reason set</span>
                      )}
                        <button onClick={() => setDeleteTarget(c)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-card-${c.id}`}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete card" aria-label={`Delete card ending in ${c.lastFourDigits}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
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
            <DialogTitle>{action === "approved" ? "Approve" : "Decline"} Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">{selected?.cardHolderName} — {selected?.cardBrand} •••• {selected?.lastFourDigits}</p>
            {action === "declined" && (
              <div>
                <label className="text-sm text-slate-400 block mb-1">Decline Reason (required)</label>
                <Textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Enter the reason for declining this card..." rows={3}
                  className="bg-slate-800 border-slate-700 text-white resize-none" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button data-testid={`button-confirm-card-${action}`} onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending || (action === "declined" && !declineReason.trim())}
              className={action === "approved" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
              {reviewMutation.isPending ? (action === "approved" ? "Approving…" : "Declining…") : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => {
        if (!open && !deleteMutation.isPending) setDeleteTarget(null);
      }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle>Delete linked card?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">
            This removes {deleteTarget?.cardBrand} ending in {deleteTarget?.lastFourDigits} from this customer’s linked-card list. The action is recorded in the admin audit log.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button data-testid="button-confirm-delete-card" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? "Deleting…" : "Delete card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
