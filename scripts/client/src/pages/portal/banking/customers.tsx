import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import { portalListCustomers, portalUpdateCustomerStatus } from "@/lib/portal-api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { usePortalAuth } from "@/lib/portal-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Search, Pencil, CheckCircle, XCircle, Clock,
  CreditCard, ShieldCheck, ShieldX, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const customerStatusColor: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  pending_approval: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  suspended: "bg-red-500/20 text-red-400 border-red-500/30",
  frozen: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  rejected: "bg-red-700/20 text-red-300 border-red-700/30",
};

const accountStatusColor: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  frozen: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  inactive: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const kycColor: Record<string, string> = {
  approved: "bg-green-500/20 text-green-400 border-green-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  not_submitted: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  more_info_requested: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

type FilterTab = "all" | "pending" | "active" | "other";

export default function BankingCustomersPage() {
  const [, setLocation] = useLocation();
  const { admin } = usePortalAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  // Decline dialog state
  const [declining, setDeclining] = useState<{ id: number; name: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["portal-customers"],
    queryFn: portalListCustomers,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => portalUpdateCustomerStatus(id, "active"),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["portal-customers"] });
      toast({ title: "Customer approved", description: "Account activated and default account created." });
    },
    onError: (e: any) => toast({ title: "Approval failed", description: e.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      portalUpdateCustomerStatus(id, "rejected", reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-customers"] });
      setDeclining(null);
      setDeclineReason("");
      toast({ title: "Registration declined", description: "The customer has been notified." });
    },
    onError: (e: any) => toast({ title: "Decline failed", description: e.message, variant: "destructive" }),
  });

  const websiteUid = admin?.websiteUid ?? "";

  const pendingCount = customers.filter((c: any) => c.status === "pending_approval").length;

  const filtered = customers
    .filter((c: any) => {
      if (tab === "pending") return c.status === "pending_approval";
      if (tab === "active") return c.status === "active";
      if (tab === "other") return !["pending_approval", "active"].includes(c.status);
      return true;
    })
    .filter((c: any) =>
      `${c.firstName} ${c.lastName} ${c.email} ${c.username} ${c.account?.accountNumber ?? ""}`.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" /> Customer Management
            </h1>
            <p className="text-slate-400 text-sm mt-1">{customers.length} registered customers</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-medium">{pendingCount} pending approval</span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-slate-800/40 border border-slate-700/60 rounded-xl p-1 w-fit">
          {([
            { key: "all", label: "All" },
            { key: "pending", label: `Pending Review${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "active", label: "Active" },
            { key: "other", label: "Other" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/60"
              } ${key === "pending" && pendingCount > 0 && tab !== "pending" ? "text-yellow-400" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, username or account number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Table */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 bg-slate-800/60">
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Full Name</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Username</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Email</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Region</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Account No.</th>
                  <th className="text-right px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Balance</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">KYC</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Acct Status</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Registered</th>
                  <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Last Login</th>
                  <th className="text-center px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-700/30">
                      <td colSpan={12} className="px-4 py-3">
                        <div className="h-4 bg-slate-700/40 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      {search ? "No customers match your search." : tab === "pending" ? "No pending registrations." : "No customers yet."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c: any) => {
                    const isPending = c.status === "pending_approval";
                    const isApproving = approveMutation.isPending && approveMutation.variables === c.id;
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-slate-700/30 transition-colors ${isPending ? "bg-yellow-500/5 hover:bg-yellow-500/10" : "hover:bg-slate-700/20"}`}
                      >
                        {/* Full Name */}
                        <td className="px-4 py-3">
                          <span className="text-white font-medium whitespace-nowrap">
                            {c.firstName} {c.lastName}
                          </span>
                        </td>

                        {/* Username */}
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">@{c.username}</td>

                        {/* Email */}
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{c.email}</td>

                        {/* Banking Region */}
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                          {c.bankingRegion === "EUROPE" ? "Europe" : c.bankingRegion ?? "—"}
                        </td>

                        {/* Account Number */}
                        <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                          {c.account ? (
                            <span className="flex items-center gap-1 text-slate-300">
                              <CreditCard className="w-3 h-3 text-slate-500" />
                              {c.account.accountNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">No account</span>
                          )}
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {c.account ? (
                            <span className="text-white font-medium">
                              {c.account.currency} {Number(c.account.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* KYC Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${kycColor[c.kycStatus] ?? "bg-slate-700 text-slate-300"}`}>
                            {c.kycStatus === "approved" && <ShieldCheck className="w-3 h-3 mr-1" />}
                            {c.kycStatus === "rejected" && <ShieldX className="w-3 h-3 mr-1" />}
                            {c.kycStatus.replace("_", " ")}
                          </span>
                        </td>

                        {/* Customer Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${customerStatusColor[c.status] ?? "bg-slate-700 text-slate-300"}`}>
                            {c.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        {/* Account Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {c.account ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${accountStatusColor[c.account.status] ?? "bg-slate-700 text-slate-300"}`}>
                              {c.account.status}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>

                        {/* Registration Date */}
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {format(new Date(c.createdAt), "MMM d, yyyy")}
                        </td>

                        {/* Last Login */}
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {c.lastLogin ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(c.lastLogin), "MMM d HH:mm")}
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">Never</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {isPending ? (
                              <>
                                {/* Approve */}
                                <button
                                  onClick={() => approveMutation.mutate(c.id)}
                                  disabled={isApproving}
                                  title="Approve registration"
                                  className="p-1.5 rounded-lg hover:bg-green-500/20 text-green-400 transition-colors disabled:opacity-50"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                {/* Decline */}
                                <button
                                  onClick={() => {
                                    setDeclineReason("");
                                    setDeclining({ id: c.id, name: `${c.firstName} ${c.lastName}` });
                                  }}
                                  title="Decline registration"
                                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            ) : null}
                            {/* Edit */}
                            <button
                              onClick={() => setLocation(`/portal/${websiteUid}/banking/customers/${c.id}`)}
                              title="Edit customer"
                              className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Decline Reason Dialog */}
      <Dialog open={!!declining} onOpenChange={(open) => { if (!open) { setDeclining(null); setDeclineReason(""); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" /> Decline Registration
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Declining <strong className="text-slate-200">{declining?.name}</strong>'s registration request. Provide a reason (optional) — it will be recorded and sent to the customer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Reason for declining (optional)…"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={3}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeclining(null); setDeclineReason(""); }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => declining && declineMutation.mutate({ id: declining.id, reason: declineReason })}
              disabled={declineMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {declineMutation.isPending ? "Declining…" : "Decline Registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
