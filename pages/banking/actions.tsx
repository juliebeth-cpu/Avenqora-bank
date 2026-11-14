import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useBankingAuth } from "@/lib/banking-auth";
import {
  bankingCreateCustomerAction,
  bankingDashboard,
  bankingListCustomerActions,
} from "@/lib/banking-api";
import { formatBankingDateTime, formatBankingAmount, getBankingRegionalConfig } from "@/lib/banking-region";
import { AlertCircle, ArrowUpRight, FileText, Send, Wallet } from "lucide-react";

interface Props { params: { websiteUid: string; actionType: string } }

type ActionType = "bill_payment" | "zelle" | "sending_order";
type FieldConfig = { key: string; label: string; placeholder: string; type?: string };

const ACTIONS: Record<ActionType, { title: string; subtitle: string; icon: typeof FileText; fields: FieldConfig[] }> = {
  bill_payment: {
    title: "Pay Bills",
    subtitle: "Create a bill payment request.",
    icon: FileText,
    fields: [
      { key: "billerName", label: "Biller name", placeholder: "Utility, rent, or service provider" },
      { key: "billAccountReference", label: "Bill account or reference", placeholder: "Account number or invoice reference" },
      { key: "note", label: "Note (optional)", placeholder: "Payment description" },
    ],
  },
  zelle: {
    title: "Zelle",
    subtitle: "Zelle payment request",
    icon: Send,
    fields: [
      { key: "recipientName", label: "Recipient name", placeholder: "Full name" },
      { key: "recipientContact", label: "Recipient email or phone", placeholder: "name@example.com or phone number" },
      { key: "note", label: "Note (optional)", placeholder: "What is this payment for?" },
    ],
  },
  sending_order: {
    title: "Sending Order",
    subtitle: "Submit a Europe-region sending order. Approval records it internally; no external bank transfer is sent.",
    icon: ArrowUpRight,
    fields: [
      { key: "recipientName", label: "Recipient name", placeholder: "Full name" },
      { key: "bankName", label: "Recipient bank", placeholder: "Bank name" },
      { key: "recipientIban", label: "IBAN or account number", placeholder: "Recipient IBAN" },
      { key: "recipientCountry", label: "Recipient country", placeholder: "Country" },
      { key: "swiftBic", label: "SWIFT / BIC (optional)", placeholder: "Bank identifier" },
      { key: "note", label: "Payment reference (optional)", placeholder: "Reference or note" },
    ],
  },
};

const REGION_ACTIONS: Record<string, ActionType[]> = {
  USA: ["bill_payment", "zelle"],
  EUROPE: ["sending_order"],
};

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending review", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Successful", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Declined", className: "bg-rose-100 text-rose-800" },
  refunded: { label: "Refunded", className: "bg-slate-200 text-slate-700" },
};

export default function BankingActionsPage({ params }: Props) {
  const { websiteUid, actionType: rawActionType } = params;
  const actionType = rawActionType as ActionType;
  const config = ACTIONS[actionType];
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const allowed = Boolean(config && REGION_ACTIONS[regional.region]?.includes(actionType));
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [transactionPin, setTransactionPin] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});

  const dashboardQuery = useQuery({
    queryKey: ["banking-dashboard"],
    queryFn: bankingDashboard,
    enabled: allowed,
  });
  const actionsQuery = useQuery({
    queryKey: ["banking-customer-actions"],
    queryFn: bankingListCustomerActions,
    enabled: allowed,
    refetchInterval: 30_000,
  });
  const accounts = (dashboardQuery.data?.accounts ?? []).filter((account: any) => account.status === "active");

  const createMutation = useMutation({
    mutationFn: bankingCreateCustomerAction,
    onSuccess: async (created) => {
      toast({ title: "Request submitted", description: `Reference ${created.reference}` });
      setAmount("");
      setDueDate("");
      setTransactionPin("");
      setDetails({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["banking-customer-actions"] }),
        queryClient.invalidateQueries({ queryKey: ["banking-dashboard"] }),
      ]);
    },
    onError: (error: any) => toast({ title: "Could not submit request", description: error.message, variant: "destructive" }),
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !allowed) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    const cleanedDetails = Object.fromEntries(
      Object.entries(details).map(([key, value]) => [key, value.trim()]).filter(([, value]) => Boolean(value)),
    );
    createMutation.mutate({
      actionType,
      accountId: Number(accountId),
      amount: numericAmount,
      details: cleanedDetails,
      dueAt: dueDate ? new Date(`${dueDate}T23:59:59.999`).toISOString() : null,
      transactionPin,
    });
  }

  if (!allowed || !config) {
    return (
      <CustomerBankingLayout websiteUid={websiteUid} appearance="banking">
        <div className="mx-auto max-w-xl rounded-2xl border bank-surface p-6">
          <AlertCircle className="bank-muted h-6 w-6" />
          <h1 className="bank-title mt-3 text-lg font-semibold">Action unavailable</h1>
          <p className="bank-muted mt-1 text-sm">This payment action is not available in your banking region.</p>
        </div>
      </CustomerBankingLayout>
    );
  }

  const Icon = config.icon;
  const selectedAccount = accounts.find((account: any) => String(account.id) === accountId);
  const requests = actionsQuery.data ?? [];

  return (
    <CustomerBankingLayout websiteUid={websiteUid} appearance="banking">
      <div className="mx-auto max-w-2xl space-y-6" data-testid={`banking-action-${actionType}`}>
        <header>
          <h1 className="bank-title flex items-center gap-2 text-2xl font-semibold">
            <Icon className="bank-accent h-6 w-6" /> {config.title}
          </h1>
          <p className="bank-muted mt-1 text-sm">{config.subtitle}</p>
        </header>

        <form onSubmit={submit} className="bank-surface space-y-5 rounded-2xl border p-5 sm:p-6">
          <div>
            <label htmlFor="action-account" className="bank-title mb-1.5 block text-sm font-medium">Pay from account</label>
            <select
              id="action-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
              className="bank-title h-11 w-full rounded-xl border border-[var(--bank-line)] bg-[var(--bank-surface)] px-3 text-sm"
            >
              <option value="">Choose an active account</option>
              {accounts.map((account: any) => (
                <option key={account.id} value={String(account.id)}>
                  {account.currency} ···· {String(account.accountNumber ?? "").slice(-4)} · Balance {Number(account.balance).toFixed(2)}
                </option>
              ))}
            </select>
            {dashboardQuery.isLoading && <p className="bank-muted mt-1 text-xs">Loading accounts…</p>}
            {!dashboardQuery.isLoading && accounts.length === 0 && <p className="mt-1 text-xs text-rose-700">No active accounts are available.</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="action-amount" className="bank-title mb-1.5 block text-sm font-medium">Amount</label>
              <Input
                id="action-amount"
                type="number"
                min="0.0001"
                max="1000000000"
                step="0.0001"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                className="bank-title border-[var(--bank-line)] bg-[var(--bank-surface)]"
              />
            </div>
            <div>
              <label className="bank-title mb-1.5 block text-sm font-medium">Currency</label>
              <div className="bank-muted flex h-10 items-center rounded-xl border border-[var(--bank-line)] px-3 text-sm">
                {selectedAccount?.currency ?? "Selected account currency"}
              </div>
            </div>
          </div>

          {actionType !== "zelle" && (
            <div>
              <label htmlFor="action-due-date" className="bank-title mb-1.5 block text-sm font-medium">Due date (optional)</label>
              <Input
                id="action-due-date"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="bank-title border-[var(--bank-line)] bg-[var(--bank-surface)]"
              />
              <p className="bank-muted mt-1 text-xs">The due date is used only for the internal payment-history score.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {config.fields.map((field) => (
              <div key={field.key} className={field.key === "note" ? "sm:col-span-2" : ""}>
                <label htmlFor={`action-${field.key}`} className="bank-title mb-1.5 block text-sm font-medium">
                  {field.label}
                </label>
                <Input
                  id={`action-${field.key}`}
                  type={field.type ?? "text"}
                  value={details[field.key] ?? ""}
                  onChange={(event) => setDetails((current) => ({ ...current, [field.key]: event.target.value }))}
                  placeholder={field.placeholder}
                  required={!field.label.includes("optional")}
                  maxLength={field.key === "note" ? 500 : field.key === "recipientIban" ? 34 : 254}
                  className="bank-title border-[var(--bank-line)] bg-[var(--bank-surface)]"
                />
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="action-transaction-pin" className="bank-title mb-1.5 block text-sm font-medium">Transaction PIN</label>
            <Input
              id="action-transaction-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              minLength={4}
              pattern="[0-9]{4,6}"
              required
              value={transactionPin}
              onChange={(event) => setTransactionPin(event.target.value.replace(/\D/g, ""))}
              placeholder="4 to 6 digits"
              className="bank-title border-[var(--bank-line)] bg-[var(--bank-surface)]"
            />
            <p className="bank-muted mt-1 text-xs">Required to submit this request.</p>
          </div>

          <Button
            type="submit"
            disabled={createMutation.isPending || dashboardQuery.isLoading || accounts.length === 0}
            className="bank-primary h-11 w-full rounded-xl font-semibold text-white"
          >
            {createMutation.isPending ? "Submitting request…" : `Submit ${config.title} Request`}
          </Button>
        </form>

        <section className="space-y-3" aria-labelledby="action-history-title">
          <div className="flex items-center justify-between">
            <h2 id="action-history-title" className="bank-title text-base font-semibold">Your requests</h2>
            {actionsQuery.isFetching && <span className="bank-muted text-xs">Refreshing…</span>}
          </div>
          {requests.length === 0 ? (
            <div className="bank-surface rounded-2xl border p-6 text-center">
              <Wallet className="bank-muted mx-auto h-6 w-6" />
              <p className="bank-muted mt-2 text-sm">No payment requests yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((request: any) => {
                const isInternalPaymentAction = request.actionType === "zelle" || request.actionType === "sending_order";
                const status = isInternalPaymentAction && request.status === "approved"
                  ? { label: "Approved (internal)", className: "bg-emerald-100 text-emerald-800" }
                  : STATUS[request.status] ?? STATUS.pending;
                return (
                  <article key={request.id} className="bank-surface rounded-2xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="bank-title text-sm font-semibold">{request.actionType.replaceAll("_", " ")}</p>
                        <p className="bank-muted mt-1 font-mono text-xs">{request.reference}</p>
                        <p className="bank-muted mt-1 text-xs">{formatBankingDateTime(request.createdAt, regional)}</p>
                      </div>
                      <div className="text-right">
                        <p className="bank-title text-sm font-semibold">{formatBankingAmount(request.amount, request.currency, regional)}</p>
                        <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                      </div>
                    </div>
                    {request.adminNotes && <p className="mt-3 rounded-lg bg-[var(--bank-surface-soft)] p-3 text-xs">{request.adminNotes}</p>}
                    {request.status === "approved" && isInternalPaymentAction
                      ? <p className="mt-2 text-xs text-emerald-700">Approved to the internal ledger. No external payment was sent.</p>
                      : request.status === "approved" && <p className="mt-2 text-xs text-emerald-700">Request completed.</p>}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </CustomerBankingLayout>
  );
}
