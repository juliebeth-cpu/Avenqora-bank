import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PortalLayout from "@/components/layout/portal-layout";
import {
  portalGetCustomer,
  portalGetAccountTransactions,
  portalAdminFundAccount,
  portalAdminDebitAccount,
  portalEditBalance,
  portalUpdateAccountStatus,
  portalUpdateCustomerStatus,
  portalUpdateCustomerProfile,
  portalDeleteCustomer,
  portalGetCustomerAuditLog,
} from "@/lib/portal-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, DollarSign, TrendingDown, Lock, Unlock, PauseCircle,
  PlayCircle, Trash2, CreditCard, Clock, Activity, AlertTriangle,
  TrendingUp, Edit3, User, ShieldCheck, ShieldX, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalKind =
  | "fund"
  | "debit"
  | "edit-balance"
  | "edit-ledger"
  | "freeze"
  | "unfreeze"
  | "suspend"
  | "reactivate"
  | "edit-profile"
  | "delete"
  | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const txTypeColor: Record<string, string> = {
  credit: "text-green-400",
  debit: "text-red-400",
  transfer: "text-blue-400",
  fee: "text-orange-400",
  interest: "text-purple-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerEditPage({
  params,
}: {
  params: { websiteUid: string; customerId: string };
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const customerId = parseInt(params.customerId, 10);
  const websiteUid = params.websiteUid;

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<ModalKind>(null);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"transactions" | "audit">("transactions");

  // Fund / Debit form
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txType, setTxType] = useState("credit");
  const [txDate, setTxDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [txTime, setTxTime] = useState(format(new Date(), "HH:mm"));

  // Balance edit
  const [newBalance, setNewBalance] = useState("");

  // Suspend reason / delete confirmation
  const [reason, setReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [profileForm, setProfileForm] = useState({ username: "", email: "", firstName: "", lastName: "", phone: "", address: "", city: "", country: "" });

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["portal-customer", customerId],
    queryFn: () => portalGetCustomer(customerId),
    enabled: !isNaN(customerId),
  });

  const primaryAccount = customer?.accounts?.[0] ?? null;
  const effectiveAccountId = activeAccountId ?? primaryAccount?.id ?? null;

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["portal-account-transactions", effectiveAccountId],
    queryFn: () => portalGetAccountTransactions(effectiveAccountId!),
    enabled: effectiveAccountId !== null,
  });

  const { data: auditLog = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["portal-customer-audit", customerId],
    queryFn: () => portalGetCustomerAuditLog(customerId),
    enabled: activeTab === "audit",
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["portal-customer", customerId] });
    qc.invalidateQueries({ queryKey: ["portal-customers"] });
    qc.invalidateQueries({ queryKey: ["portal-account-transactions", effectiveAccountId] });
    qc.invalidateQueries({ queryKey: ["portal-customer-audit", customerId] });
  };

  const fundMutation = useMutation({
    mutationFn: () =>
      portalAdminFundAccount(effectiveAccountId!, {
        amount: parseFloat(txAmount),
        description: txDesc || undefined,
        transactionType: txType as any,
        overrideDate: txDate || undefined,
        overrideTime: txTime || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Account funded successfully" });
      closeModal();
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const debitMutation = useMutation({
    mutationFn: () =>
      portalAdminDebitAccount(effectiveAccountId!, {
        amount: parseFloat(txAmount),
        description: txDesc || undefined,
        transactionType: txType as any,
        overrideDate: txDate || undefined,
        overrideTime: txTime || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Account debited successfully" });
      closeModal();
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editBalanceMutation = useMutation({
    mutationFn: (type: "current" | "ledger") =>
      portalEditBalance(
        effectiveAccountId!,
        type === "current" ? newBalance : undefined,
        type === "ledger" ? newBalance : undefined,
      ),
    onSuccess: () => {
      toast({ title: "Balance updated" });
      closeModal();
      invalidate();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const freezeAccountMutation = useMutation({
    mutationFn: () => portalUpdateAccountStatus(effectiveAccountId!, "frozen"),
    onSuccess: () => { toast({ title: "Account frozen" }); closeModal(); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unfreezeAccountMutation = useMutation({
    mutationFn: () => portalUpdateAccountStatus(effectiveAccountId!, "active"),
    onSuccess: () => { toast({ title: "Account unfrozen" }); closeModal(); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: () => portalUpdateCustomerStatus(customerId, "suspended", reason || undefined),
    onSuccess: () => { toast({ title: "Customer suspended" }); closeModal(); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => portalUpdateCustomerStatus(customerId, "active"),
    onSuccess: () => { toast({ title: "Customer reactivated" }); closeModal(); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const profileMutation = useMutation({
    mutationFn: () => portalUpdateCustomerProfile(customerId, Object.fromEntries(Object.entries(profileForm).filter(([, value]) => value.trim() !== ""))),
    onSuccess: () => { toast({ title: "Registration information updated" }); closeModal(); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => portalDeleteCustomer(customerId),
    onSuccess: () => {
      toast({ title: "Customer deleted" });
      setLocation(`/portal/${websiteUid}/banking/customers`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const openModal = (kind: ModalKind) => {
    setModal(kind);
    setTxAmount("");
    setTxDesc("");
    setTxType(kind === "debit" ? "debit" : "credit");
    setTxDate(format(new Date(), "yyyy-MM-dd"));
    setTxTime(format(new Date(), "HH:mm"));
    setNewBalance("");
    setReason("");
    setDeleteConfirm("");
    if (kind === "edit-profile" && customer) {
      setProfileForm({ username: customer.username ?? "", email: customer.email ?? "", firstName: customer.firstName ?? "", lastName: customer.lastName ?? "", phone: customer.phone ?? "", address: customer.address ?? "", city: customer.city ?? "", country: customer.country ?? "" });
    }
  };

  const closeModal = () => setModal(null);

  const isPending =
    fundMutation.isPending ||
    debitMutation.isPending ||
    editBalanceMutation.isPending ||
    freezeAccountMutation.isPending ||
    unfreezeAccountMutation.isPending ||
    suspendMutation.isPending ||
    reactivateMutation.isPending ||
    profileMutation.isPending ||
    deleteMutation.isPending;

  // ─────────────────────────────────────────────────────────────────────────────

  if (loadingCustomer) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
        </div>
      </PortalLayout>
    );
  }

  if (!customer) {
    return (
      <PortalLayout>
        <div className="text-center py-16 text-slate-500">Customer not found.</div>
      </PortalLayout>
    );
  }

  const isSuspended = customer.status === "suspended";
  const isFrozen = customer.status === "frozen";
  const isActive = customer.status === "active";
  const accountFrozen = primaryAccount?.status === "frozen";

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation(`/portal/${websiteUid}/banking/customers`)}
            className="p-2 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {customer.firstName} {customer.lastName}
            </h1>
            <p className="text-slate-400 text-sm">Customer ID #{customer.id}</p>
          </div>
        </div>

        {/* Suspended / Frozen banner */}
        {isSuspended && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-red-300 font-medium">Account Suspended</p>
              {customer.rejectionReason && (
                <p className="text-red-400/70 text-sm mt-0.5">
                  Reason: {customer.rejectionReason}
                </p>
              )}
              <p className="text-red-400/60 text-xs mt-1">
                All banking activities are blocked. The customer sees this reason after login.
              </p>
            </div>
          </div>
        )}
        {isFrozen && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-blue-300 font-medium">Account Frozen</p>
              <p className="text-blue-400/60 text-xs mt-1">
                Transfers, withdrawals and payments are disabled. Customer sees: "Your account has been
                temporarily frozen. Please contact customer support."
              </p>
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer details card */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4" /> Customer Details
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Username</dt>
                <dd className="text-slate-200">@{customer.username}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Email</dt>
                <dd className="text-slate-200">{customer.email}</dd>
              </div>
              {customer.phone && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Phone</dt>
                  <dd className="text-slate-200">{customer.phone}</dd>
                </div>
              )}
              {customer.country && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Country</dt>
                  <dd className="text-slate-200">{customer.country}</dd>
                </div>
              )}
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${customerStatusColor[customer.status] ?? ""}`}>
                    {customer.status.replace("_", " ")}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-slate-500">KYC</dt>
                <dd>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${kycColor[customer.kycStatus] ?? ""}`}>
                    {customer.kycStatus === "approved" ? <ShieldCheck className="w-3 h-3 mr-1" /> : <ShieldX className="w-3 h-3 mr-1" />}
                    {customer.kycStatus.replace("_", " ")}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Registered</dt>
                <dd className="text-slate-200">{format(new Date(customer.createdAt), "MMM d, yyyy")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last Login</dt>
                <dd className="text-slate-200">
                  {customer.lastLogin
                    ? format(new Date(customer.lastLogin), "MMM d, yyyy HH:mm")
                    : <span className="text-slate-600 italic">Never</span>}
                </dd>
              </div>
            </dl>
          </div>

          {/* Account details card */}
          {primaryAccount ? (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Account Details
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Account No.</dt>
                  <dd className="text-slate-200 font-mono">{primaryAccount.accountNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Type</dt>
                  <dd className="text-slate-200 capitalize">{primaryAccount.accountType.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Currency</dt>
                  <dd className="text-slate-200">{primaryAccount.currency}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Current Balance</dt>
                  <dd className="text-white font-semibold text-base">
                    {primaryAccount.currency} {Number(primaryAccount.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Ledger Balance</dt>
                  <dd className="text-slate-300">
                    {primaryAccount.currency} {Number(primaryAccount.ledgerBalance ?? primaryAccount.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-slate-500">Acct Status</dt>
                  <dd>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${accountStatusColor[primaryAccount.status] ?? ""}`}>
                      {primaryAccount.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-slate-500">
              <CreditCard className="w-8 h-8 opacity-40" />
              <p className="text-sm">No bank account yet</p>
              <p className="text-xs text-center opacity-70">Approve the customer to auto-create a checking account.</p>
            </div>
          )}
        </div>

        {/* Account Management Actions */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Account Management
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => openModal("edit-profile")}
              size="sm"
              className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30"
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-1.5" /> Edit Registration
            </Button>

            {/* Fund */}
            <Button
              onClick={() => openModal("fund")}
              disabled={!primaryAccount}
              size="sm"
              className="bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30"
              variant="outline"
            >
              <TrendingUp className="w-4 h-4 mr-1.5" /> Fund Account
            </Button>

            {/* Debit */}
            <Button
              onClick={() => openModal("debit")}
              disabled={!primaryAccount}
              size="sm"
              className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30"
              variant="outline"
            >
              <TrendingDown className="w-4 h-4 mr-1.5" /> Debit Account
            </Button>

            {/* Edit Current Balance */}
            <Button
              onClick={() => openModal("edit-balance")}
              disabled={!primaryAccount}
              size="sm"
              className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30"
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-1.5" /> Edit Balance
            </Button>

            {/* Edit Ledger Balance */}
            <Button
              onClick={() => openModal("edit-ledger")}
              disabled={!primaryAccount}
              size="sm"
              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30"
              variant="outline"
            >
              <Edit3 className="w-4 h-4 mr-1.5" /> Edit Ledger Balance
            </Button>

            {/* Freeze / Unfreeze account */}
            {primaryAccount && primaryAccount.status !== "frozen" ? (
              <Button
                onClick={() => openModal("freeze")}
                size="sm"
                className="bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 border border-sky-500/30"
                variant="outline"
              >
                <Lock className="w-4 h-4 mr-1.5" /> Freeze Account
              </Button>
            ) : primaryAccount ? (
              <Button
                onClick={() => openModal("unfreeze")}
                size="sm"
                className="bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 border border-teal-500/30"
                variant="outline"
              >
                <Unlock className="w-4 h-4 mr-1.5" /> Unfreeze Account
              </Button>
            ) : null}

            {/* Suspend / Reactivate customer */}
            {!isSuspended ? (
              <Button
                onClick={() => openModal("suspend")}
                size="sm"
                className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 border border-orange-500/30"
                variant="outline"
              >
                <PauseCircle className="w-4 h-4 mr-1.5" /> Suspend Account
              </Button>
            ) : (
              <Button
                onClick={() => openModal("reactivate")}
                size="sm"
                className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
                variant="outline"
              >
                <PlayCircle className="w-4 h-4 mr-1.5" /> Reactivate Account
              </Button>
            )}

            {/* Delete */}
            <Button
              onClick={() => openModal("delete")}
              size="sm"
              className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-700/30"
              variant="outline"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Delete Account
            </Button>
          </div>
        </div>

        {/* Tabs: Transactions / Audit Log */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
          <div className="flex border-b border-slate-700/60">
            <button
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === "transactions"
                  ? "text-white border-b-2 border-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <DollarSign className="w-4 h-4" /> Transactions
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === "audit"
                  ? "text-white border-b-2 border-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" /> Audit Log
            </button>
          </div>

          {/* Transactions */}
          {activeTab === "transactions" && (
            <div className="overflow-x-auto">
              {!primaryAccount ? (
                <p className="text-center py-10 text-slate-500">No account — no transactions.</p>
              ) : loadingTx ? (
                <div className="p-8 flex justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-center py-10 text-slate-500">No transactions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 bg-slate-800/60">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Reference</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Type</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Description</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(transactions as any[]).map((tx) => (
                      <tr key={tx.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{tx.reference}</td>
                        <td className={`px-4 py-3 capitalize font-medium ${txTypeColor[tx.transactionType] ?? "text-slate-300"}`}>
                          {tx.transactionType}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{tx.description ?? "—"}</td>
                        <td className={`px-4 py-3 text-right font-medium ${txTypeColor[tx.transactionType] ?? "text-slate-300"}`}>
                          {tx.transactionType === "credit" || tx.transactionType === "interest" ? "+" : "-"}
                          {tx.currency} {Number(tx.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${
                            tx.status === "completed"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : tx.status === "reversed"
                              ? "bg-slate-500/20 text-slate-400 border-slate-500/30"
                              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Audit Log */}
          {activeTab === "audit" && (
            <div className="overflow-x-auto">
              {loadingAudit ? (
                <div className="p-8 flex justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : auditLog.length === 0 ? (
                <p className="text-center py-10 text-slate-500">No audit entries yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60 bg-slate-800/60">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Action</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Admin</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Customer</th>
                      <th className="text-right px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Amount</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Reason / Note</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">IP Address</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium whitespace-nowrap">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auditLog as any[]).map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                        <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap capitalize">
                          {entry.action.replace(/_/g, " ")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {entry.adminUsername ? (
                            <span className="text-blue-400 text-xs font-mono">@{entry.adminUsername}</span>
                          ) : (
                            <span className="text-slate-500 text-xs">{entry.userType} #{entry.userId}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {entry.customer ?? `Customer #${customer?.id}`}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {entry.amount != null ? (
                            <span className="text-white font-medium text-xs">
                              {Number(entry.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[180px] truncate" title={entry.reason ?? ""}>
                          {entry.reason ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs font-mono whitespace-nowrap">
                          {entry.ipAddress ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(entry.createdAt), "MMM d, yyyy HH:mm")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}

      {/* Locked registration information */}
      <Dialog open={modal === "edit-profile"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5 text-blue-400" /> Edit Registration Information</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(profileForm).map(([field, value]) => (
              <div key={field}>
                <Label className="text-slate-300 text-sm capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                <Input
                  value={value}
                  onChange={(event) => setProfileForm((current) => ({ ...current, [field]: event.target.value }))}
                  className="mt-1 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancel</Button>
            <Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending}>
              {profileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fund / Debit */}
      <Dialog open={modal === "fund" || modal === "debit"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal === "fund"
                ? <><TrendingUp className="w-5 h-5 text-green-400" /> Fund Account</>
                : <><TrendingDown className="w-5 h-5 text-red-400" /> Debit Account</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300 text-sm">Amount *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Description</Label>
              <Input
                placeholder="Enter description…"
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-sm">Transaction Type</Label>
              <Select value={txType} onValueChange={setTxType}>
                <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                  <SelectItem value="interest">Interest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">Date</Label>
                <Input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <Label className="text-slate-300 text-sm">Time</Label>
                <Input
                  type="time"
                  value={txTime}
                  onChange={(e) => setTxTime(e.target.value)}
                  className="mt-1 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={!txAmount || parseFloat(txAmount) <= 0 || isPending}
              onClick={() => modal === "fund" ? fundMutation.mutate() : debitMutation.mutate()}
              className={modal === "fund" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {isPending ? "Processing…" : modal === "fund" ? "Fund Account" : "Debit Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Balance */}
      <Dialog open={modal === "edit-balance" || modal === "edit-ledger"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-400" />
              {modal === "edit-balance" ? "Edit Current Balance" : "Edit Ledger Balance"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              Current value:{" "}
              <span className="text-white font-medium">
                {primaryAccount?.currency}{" "}
                {modal === "edit-balance"
                  ? Number(primaryAccount?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })
                  : Number(primaryAccount?.ledgerBalance ?? primaryAccount?.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </p>
            <div>
              <Label className="text-slate-300 text-sm">New balance *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={!newBalance || isPending}
              onClick={() => editBalanceMutation.mutate(modal === "edit-balance" ? "current" : "ledger")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? "Saving…" : "Save Balance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Freeze */}
      <Dialog open={modal === "freeze"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-sky-400" /> Freeze Account
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm">
            Freezing this account will disable all transfers, withdrawals and payments. The customer
            will see a frozen notice.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={isPending}
              onClick={() => freezeAccountMutation.mutate()}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isPending ? "Freezing…" : "Freeze Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unfreeze */}
      <Dialog open={modal === "unfreeze"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-teal-400" /> Unfreeze Account
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm">
            This will restore the account to active status and re-enable all transactions.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={isPending}
              onClick={() => unfreezeAccountMutation.mutate()}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isPending ? "Unfreezing…" : "Unfreeze Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend */}
      <Dialog open={modal === "suspend"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-orange-400" /> Suspend Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              The customer will be blocked from all banking activities. They will see your reason
              after logging in.
            </p>
            <div>
              <Label className="text-slate-300 text-sm">Suspension reason *</Label>
              <Input
                placeholder="Enter reason…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={!reason.trim() || isPending}
              onClick={() => suspendMutation.mutate()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isPending ? "Suspending…" : "Suspend Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate */}
      <Dialog open={modal === "reactivate"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-emerald-400" /> Reactivate Account
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm">
            This will set the customer status back to active and restore all access.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={isPending}
              onClick={() => reactivateMutation.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending ? "Reactivating…" : "Reactivate Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={modal === "delete"} onOpenChange={closeModal}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" /> Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-slate-400 text-sm">
              This will <span className="text-red-400 font-medium">permanently delete</span> the
              customer and all associated data. This cannot be undone.
            </p>
            <div>
              <Label className="text-slate-300 text-sm">
                Type <span className="text-red-400 font-mono">DELETE</span> to confirm
              </Label>
              <Input
                placeholder="DELETE"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-1 bg-slate-800 border-slate-700 text-white font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button
              disabled={deleteConfirm !== "DELETE" || isPending}
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? "Deleting…" : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
