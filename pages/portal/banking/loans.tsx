import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PortalLayout from "@/components/layout/portal-layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { portalListLoans, portalReviewLoan } from "@/lib/portal-api";
import {
  Landmark, CheckCircle, XCircle, Clock, TrendingUp, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { color: string; icon: any; bg: string }> = {
  pending: { color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/30", icon: Clock },
  active: { color: "text-green-400", bg: "bg-green-400/10 border-green-400/30", icon: TrendingUp },
  approved: { color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30", icon: CheckCircle },
  rejected: { color: "text-red-400", bg: "bg-red-400/10 border-red-400/30", icon: XCircle },
  completed: { color: "text-slate-400", bg: "bg-slate-400/10 border-slate-400/30", icon: CheckCircle },
  defaulted: { color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30", icon: AlertCircle },
};

export default function AdminLoansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<number, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["portal-loans"],
    queryFn: portalListLoans,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      portalReviewLoan(id, { status, adminNotes: notes }),
    onSuccess: (_, vars) => {
      toast({ title: `Loan ${vars.status === "approved" ? "approved" : "rejected"}` });
      qc.invalidateQueries({ queryKey: ["portal-loans"] });
      setExpanded(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = (loans as any[]).filter((l: any) =>
    statusFilter === "all" || l.status === statusFilter
  );

  const summary = {
    total: (loans as any[]).length,
    pending: (loans as any[]).filter((l: any) => l.status === "pending").length,
    active: (loans as any[]).filter((l: any) => l.status === "active").length,
    totalAmount: (loans as any[]).reduce((s, l: any) => s + Number(l.principalAmount), 0),
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Landmark className="w-6 h-6 text-blue-400" /> Loan Management
          </h1>
          <p className="text-slate-400 text-sm mt-1">Review and manage customer loan applications</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Applications", value: summary.total, color: "text-white" },
            { label: "Pending Review", value: summary.pending, color: "text-yellow-400" },
            { label: "Active Loans", value: summary.active, color: "text-green-400" },
            { label: "Total Principal", value: `$${summary.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, color: "text-blue-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
              <p className="text-slate-400 text-xs">{label}</p>
              <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          {["all", "pending", "active", "approved", "rejected", "completed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>

        {/* Loans list */}
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-slate-800/60 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-10 text-center">
            <Landmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No loans found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((loan: any) => {
              const cfg = statusConfig[loan.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              const isOpen = expanded === loan.id;
              return (
                <div key={loan.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/20 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : loan.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {loan.status}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-medium capitalize">
                          {loan.loanType.replace("_", " ")} · {loan.currency} {Number(loan.principalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {loan.customerName ?? `Customer #${loan.customerId}`} · {loan.termMonths}mo · {format(new Date(loan.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-slate-700/40 space-y-3 pt-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        {[
                          { label: "Principal", value: `${loan.currency} ${Number(loan.principalAmount).toFixed(2)}` },
                          { label: "Interest Rate", value: `${loan.interestRate}% p.a.` },
                          { label: "Monthly Payment", value: loan.monthlyPayment ? `${loan.currency} ${Number(loan.monthlyPayment).toFixed(2)}` : "—" },
                          { label: "Total Repayable", value: loan.totalRepayable ? `${loan.currency} ${Number(loan.totalRepayable).toFixed(2)}` : "—" },
                          { label: "Reference", value: loan.reference },
                          { label: "Purpose", value: loan.purpose ?? "—" },
                          { label: "Collateral", value: loan.collateral ?? "—" },
                          { label: "Term", value: `${loan.termMonths} months` },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-slate-500 text-xs">{label}</p>
                            <p className="text-slate-300 font-medium text-sm mt-0.5">{value}</p>
                          </div>
                        ))}
                      </div>
                      {loan.status === "pending" && (
                        <div className="space-y-2 pt-1">
                          <textarea
                            value={adminNotes[loan.id] ?? ""}
                            onChange={(e) => setAdminNotes({ ...adminNotes, [loan.id]: e.target.value })}
                            placeholder="Admin notes (optional)"
                            rows={2}
                            className="w-full bg-slate-900/80 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => reviewMutation.mutate({ id: loan.id, status: "approved", notes: adminNotes[loan.id] })}
                              disabled={reviewMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => reviewMutation.mutate({ id: loan.id, status: "rejected", notes: adminNotes[loan.id] })}
                              disabled={reviewMutation.isPending}
                              variant="outline"
                              className="border-red-500/50 text-red-400 hover:bg-red-500/10 gap-1"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
