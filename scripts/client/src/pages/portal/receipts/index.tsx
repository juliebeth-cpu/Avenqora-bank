import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { usePortalAuth } from "@/lib/portal-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Download, Search, Trash2, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const BASE = "/api";

function getPortalToken() { return localStorage.getItem("danzy_portal_token"); }
function portalHeaders(): HeadersInit {
  const t = getPortalToken();
  return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...portalHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error ?? "Request failed"), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const portalListReceipts = () => req<any[]>("/website/receipts");
const portalDeleteReceipt = (id: number) => req<void>(`/website/receipts/${id}`, { method: "DELETE" });

const KIND_LABELS: Record<string, string> = {
  deposit: "Deposit", withdrawal: "Withdrawal", transfer: "Transfer",
  investment: "Investment", loan: "Loan",
};
const KIND_COLORS: Record<string, string> = {
  deposit: "bg-green-500/20 text-green-400 border-green-500/30",
  withdrawal: "bg-red-500/20 text-red-400 border-red-500/30",
  transfer: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  investment: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  loan: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

function downloadAdminReceiptPdf(id: number, receiptNumber: string) {
  const token = getPortalToken();
  if (!token) return;
  fetch(`/api/website/receipts/${id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${receiptNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    });
}

export default function PortalReceiptsPage() {
  const { admin } = usePortalAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["portal-receipts"],
    queryFn: portalListReceipts,
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => portalDeleteReceipt(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-receipts"] });
      setDeleteTarget(null);
      toast({ title: "Receipt deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = (receipts as any[]).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-400" /> Receipts Management
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              View and manage all customer transaction receipts — only administrators can delete receipts
            </p>
          </div>
          <div className="text-slate-400 text-sm bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2">
            {filtered.length} receipt{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by customer, receipt number, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl py-16 text-center">
            <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 font-medium">No receipts found</p>
            <p className="text-slate-500 text-sm mt-1">Receipts appear here after transactions are approved</p>
          </div>
        ) : (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.8fr_auto] gap-3 px-5 py-3 border-b border-slate-700/60 text-xs text-slate-500 uppercase tracking-wide">
              <span>Customer</span>
              <span>Receipt No.</span>
              <span>Type</span>
              <span>Amount</span>
              <span>Date</span>
              <span>Actions</span>
            </div>

            <div className="divide-y divide-slate-700/40">
              {filtered.map((r: any) => (
                <div key={r.id} className="px-5 py-3.5 flex flex-col md:grid md:grid-cols-[1fr_1.2fr_0.8fr_0.8fr_0.8fr_auto] gap-2 md:gap-3 md:items-center">
                  <div>
                    <p className="text-white text-sm font-medium">{r.customerName}</p>
                    {r.reference && <p className="text-slate-500 text-xs font-mono">{r.reference}</p>}
                  </div>
                  <p className="text-slate-300 text-sm font-mono">{r.receiptNumber}</p>
                  <Badge className={`text-xs border w-fit ${KIND_COLORS[r.transactionKind] ?? "bg-slate-500/20 text-slate-400"}`}>
                    {KIND_LABELS[r.transactionKind] ?? r.transactionKind}
                  </Badge>
                  <div>
                    <p className="text-white text-sm font-semibold">
                      {r.currency} {Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <Badge className={`text-xs border ${r.status === "approved" || r.status === "completed" || r.status === "matured" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="text-slate-400 text-xs">{format(new Date(r.issuedAt), "MMM d, yyyy HH:mm")}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => downloadAdminReceiptPdf(r.id, r.receiptNumber)}
                      className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(r)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                      title="Delete receipt"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" /> Delete Receipt
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-300 text-sm">
              Are you sure you want to delete receipt <span className="font-mono text-white">{deleteTarget?.receiptNumber}</span>?
            </p>
            <p className="text-slate-400 text-xs">
              This will remove the receipt from the customer's view. The underlying transaction record remains intact.
            </p>
            {deleteTarget && (
              <div className="bg-slate-800 rounded-lg p-3 text-sm space-y-1">
                <p className="text-slate-300"><span className="text-slate-500">Customer:</span> {deleteTarget.customerName}</p>
                <p className="text-slate-300"><span className="text-slate-500">Amount:</span> {deleteTarget.currency} {Number(deleteTarget.amount).toFixed(2)}</p>
                <p className="text-slate-300"><span className="text-slate-500">Type:</span> {KIND_LABELS[deleteTarget.transactionKind] ?? deleteTarget.transactionKind}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              onClick={() => deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete Receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
