import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingDashboard, bankingListDepositMethods, bankingListDepositBankAccounts, bankingCreateDeposit, bankingAttachReceipt, estimateBankingServerNow } from "@/lib/banking-api";
import { useBankingAuth } from "@/lib/banking-auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownCircle, CheckCircle, AlertTriangle, Copy, Check } from "lucide-react";

const schema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.string().min(1, "Enter amount").refine((v) => parseFloat(v) > 0, "Amount must be positive"),
  currency: z.string().default("USD"),
  method: z.string().min(1, "Select a payment method"),
  receivingBankAccountId: z.string().optional(),
});

type ReceivingBankAccountDetails = {
  displayName?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  currency?: string;
  country?: string | null;
  region?: string | null;
  routingNumber?: string | null;
  iban?: string | null;
  swiftBic?: string | null;
  bankAddress?: string | null;
  instructions?: string | null;
};

function ReceivingBankDetails({ account }: { account: ReceivingBankAccountDetails }) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const details = [
    { key: "displayName", label: "Account label", value: account.displayName },
    { key: "bankName", label: "Bank name", value: account.bankName },
    { key: "accountName", label: "Account holder", value: account.accountName },
    { key: "accountNumber", label: "Account number", value: account.accountNumber },
    { key: "currency", label: "Payment currency", value: account.currency },
    { key: "country", label: "Country", value: account.country },
    { key: "region", label: "Region", value: account.region },
    { key: "routingNumber", label: "Routing number", value: account.routingNumber },
    { key: "iban", label: "IBAN", value: account.iban },
    { key: "swiftBic", label: "SWIFT / BIC", value: account.swiftBic },
    { key: "bankAddress", label: "Bank address", value: account.bankAddress },
    { key: "instructions", label: "Payment instructions", value: account.instructions },
  ].filter((detail) => typeof detail.value === "string" && detail.value.trim().length > 0);

  const copyDetail = async (key: string, label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      toast({ title: `${label} copied` });
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Copy failed", description: `Could not copy ${label.toLowerCase()}.`, variant: "destructive" });
    }
  };

  return (
    <>
      <div role="alert" className="rounded-xl border border-amber-500 bg-amber-300 p-4 text-slate-950 shadow-sm">
        <h2 className="font-bold">⚠️ IMPORTANT PAYMENT WARNING</h2>
        <p className="mt-2 text-sm leading-relaxed">Please verify the receiving bank details carefully before making your transfer. Ensure the account holder, account number and payment currency are correct.</p>
        <p className="mt-2 text-sm leading-relaxed">Only transfer to the bank account displayed on this official deposit page. Do not send money to personal accounts provided through unofficial messages.</p>
      </div>
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5 space-y-3">
        <h2 className="font-semibold text-white">Receiving Bank Details</h2>
        {details.map((detail) => (
          <div key={detail.key} className="flex items-start justify-between gap-3 border-b border-slate-700/60 pb-2 last:border-b-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">{detail.label}</p>
              <p className="break-words text-sm text-slate-100 whitespace-pre-wrap">{detail.value}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={`Copy ${detail.label.toLowerCase()}`}
              aria-label={`Copy ${detail.label.toLowerCase()}`}
              onClick={() => typeof detail.value === "string" && copyDetail(detail.key, detail.label, detail.value)}
              className="shrink-0 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              {copiedField === detail.key ? <><Check className="mr-1 h-4 w-4 text-green-400" /> Copied</> : <><Copy className="mr-1 h-4 w-4" /> Copy</>}
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}

interface Props { params: { websiteUid: string } }

function depositCountdown(expiresAt: string, now: number) {
  const remainingSeconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  if (remainingSeconds === 0) return "Expired";
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function BankingDepositPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createdDeposit, setCreatedDeposit] = useState<any>(null);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [clockNow, setClockNow] = useState(0);
  const { customer } = useBankingAuth();

  const { data, isLoading: dashboardLoading, isFetching: dashboardFetching } = useQuery({ queryKey: ["banking-dashboard"], queryFn: bankingDashboard, retry: false });
  const resumeDepositId = typeof window === "undefined"
    ? null
    : new URLSearchParams(window.location.search).get("resumeDepositId");
  const resumableDeposit = (data?.resumableDeposits ?? []).find((deposit: any) => String(deposit.id) === resumeDepositId);
  const activeDeposit = createdDeposit ?? resumableDeposit ?? null;
  const sessionExpired = Boolean(
    activeDeposit?.status === "pending" &&
    !activeDeposit.receiptUrl &&
    activeDeposit.sessionExpiresAt &&
    new Date(activeDeposit.sessionExpiresAt).getTime() <= (clockNow || estimateBankingServerNow(data)),
  );
  const { data: depositMethods = [], isLoading: depositMethodsLoading } = useQuery({
    queryKey: ["banking-deposit-methods"],
    queryFn: bankingListDepositMethods,
    retry: false,
  });
  const { data: receivingBankAccounts = [], isLoading: receivingBankAccountsLoading } = useQuery({
    queryKey: ["banking-deposit-bank-accounts"],
    queryFn: bankingListDepositBankAccounts,
    retry: false,
  });
  useEffect(() => {
    const updateClock = () => setClockNow(estimateBankingServerNow(data));
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [data?.serverTime, data?.serverTimeMonotonicAnchorMs]);
  const allAccounts: any[] = data?.accounts ?? [];
  const accounts: any[] = allAccounts.filter((a: any) => a.status === "active");
  const customerSuspended = customer?.status === "suspended";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { accountId: "", amount: "", currency: "USD", method: "bank_transfer", receivingBankAccountId: "" },
  });
  const selectedCurrency = form.watch("currency");
  const depositAmount = form.watch("amount");
  const selectedBankAccount = receivingBankAccounts.find((account: any) =>
    String(account.id) === form.watch("receivingBankAccountId") && account.currency === selectedCurrency,
  );

  useEffect(() => {
    const currentMethod = form.getValues("method");
    if (depositMethods.length > 0 && !depositMethods.some((method: any) => method.id === currentMethod)) {
      form.setValue("method", depositMethods[0].id);
    }
  }, [depositMethods, form]);

  const depositMutation = useMutation({
    mutationFn: (values: z.infer<typeof schema>) =>
      bankingCreateDeposit({ accountId: parseInt(values.accountId), amount: parseFloat(values.amount), currency: values.currency, method: values.method, receivingBankAccountId: values.receivingBankAccountId ? parseInt(values.receivingBankAccountId) : undefined }),
    onSuccess: (data) => {
      setCreatedDeposit(data);
      qc.invalidateQueries({ queryKey: ["banking-dashboard"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitDeposit = (values: z.infer<typeof schema>) => {
    const hasEligibleReceivingAccount = receivingBankAccounts.some((account: any) => account.currency === values.currency);
    if (values.method === "bank_transfer" && hasEligibleReceivingAccount && !values.receivingBankAccountId) {
      form.setError("receivingBankAccountId", { message: "Select a receiving bank account" });
      return;
    }
    depositMutation.mutate(values);
  };

  const submitReceipt = async () => {
    if (!receiptUrl || !activeDeposit || sessionExpired) return;
    setSubmittingReceipt(true);
    try {
      await bankingAttachReceipt(activeDeposit.id, receiptUrl);
      toast({ title: "Receipt submitted! The admin will review your deposit." });
      setCreatedDeposit({ ...activeDeposit, receiptUrl, status: "processing" });
      qc.invalidateQueries({ queryKey: ["banking-dashboard"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // ── Blocked screens ──────────────────────────────────────────────────────────
  if (customerSuspended) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <div>
            <h2 className="text-white font-semibold text-lg">Account Suspended</h2>
            {(customer as any)?.rejectionReason && (
              <p className="text-red-400/80 text-sm mt-1">Reason: {(customer as any).rejectionReason}</p>
            )}
            <p className="text-slate-400 text-sm mt-2">Deposits are disabled while your account is suspended. Please contact customer support.</p>
          </div>
        </div>
      </div>
    </CustomerBankingLayout>
  );

  if (resumeDepositId && (dashboardLoading || dashboardFetching) && !createdDeposit) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg animate-pulse space-y-4">
        <div className="h-8 rounded bg-slate-800" />
        <div className="h-32 rounded-xl bg-slate-800" />
      </div>
    </CustomerBankingLayout>
  );

  if (resumeDepositId && !resumableDeposit && !createdDeposit) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
        <h1 className="font-semibold text-white">Deposit session unavailable</h1>
        <p className="mt-2 text-sm text-slate-300">This deposit is expired or is no longer available to resume.</p>
        <Link href={`/banking/${websiteUid}/deposit`} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
          Start a new deposit
        </Link>
      </div>
    </CustomerBankingLayout>
  );

  if (activeDeposit) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="w-6 h-6" />
          <h1 className="text-xl font-bold text-white">Deposit Request Submitted</h1>
        </div>
        {activeDeposit.sessionExpiresAt && activeDeposit.status === "pending" && !activeDeposit.receiptUrl && (
          <div className={`rounded-xl border p-4 ${sessionExpired ? "border-red-500/40 bg-red-500/10" : "border-amber-500/40 bg-amber-500/10"}`} role="status">
            <p className="text-xs font-medium uppercase text-amber-200">Deposit session</p>
            <p className="mt-1 text-lg font-bold text-white">
              {sessionExpired ? "Expired" : depositCountdown(activeDeposit.sessionExpiresAt, clockNow || estimateBankingServerNow(data))}
            </p>
            {sessionExpired && <p className="mt-1 text-sm text-slate-300">This request can no longer accept a receipt. Start a new deposit to continue.</p>}
          </div>
        )}
        {activeDeposit.receivingBankAccountSnapshot && (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-green-500/40 bg-green-500/10 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-green-200">Deposit Amount</p>
              <p className="mt-1 text-xl font-bold text-white">{activeDeposit.currency} {Number(activeDeposit.grossAmount ?? activeDeposit.amount).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-green-200">Selected Receiving Account</p>
              <p className="mt-1 text-sm font-semibold text-white">{activeDeposit.receivingBankAccountSnapshot.displayName}</p>
              <p className="text-sm text-slate-300">{activeDeposit.receivingBankAccountSnapshot.bankName}</p>
            </div>
          </div>
        )}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Reference</span><span className="text-white font-mono">{activeDeposit.reference}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Gross amount</span><span className="text-white font-semibold">{activeDeposit.currency} {Number(activeDeposit.grossAmount ?? activeDeposit.amount).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Transaction fee (0.05%)</span><span className="text-amber-300">{activeDeposit.currency} {Number(activeDeposit.fee ?? 0).toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Net amount credited after approval</span><span className="text-green-300 font-semibold">{activeDeposit.currency} {Number(activeDeposit.netAmount ?? activeDeposit.amount).toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Method</span><span className="text-slate-300 capitalize">{activeDeposit.method.replace("_", " ")}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Status</span><span className={sessionExpired ? "text-red-400" : "text-yellow-400"}>{sessionExpired ? "Expired" : activeDeposit.status === "processing" ? "Receipt submitted" : "Pending"}</span></div>
        </div>
        <p className="text-slate-500 text-xs">Your available balance will remain unchanged until an authorized reviewer approves this payment.</p>

        {activeDeposit.receivingBankAccountSnapshot && (
          <ReceivingBankDetails account={activeDeposit.receivingBankAccountSnapshot} />
        )}

        {activeDeposit.paymentInstructions && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5">
            <p className="text-blue-300 font-medium text-sm mb-2">Payment Instructions</p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{activeDeposit.paymentInstructions}</p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-slate-400 text-sm">After making payment, upload your receipt URL:</p>
          <Input value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)}
            placeholder="https://..." className="bg-slate-800 border-slate-700 text-white" />
          <Button onClick={submitReceipt} disabled={!receiptUrl || submittingReceipt || !!activeDeposit.receiptUrl || sessionExpired}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {activeDeposit.receiptUrl ? "Receipt Submitted ✓" : sessionExpired ? "Session Expired" : submittingReceipt ? "Submitting..." : "Submit Payment Receipt"}
          </Button>
        </div>
      </div>
    </CustomerBankingLayout>
  );

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowDownCircle className="w-6 h-6 text-green-400" /> Deposit Funds
          </h1>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitDeposit)} className="space-y-5">
              <FormField control={form.control} name="accountId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Account</FormLabel>
                  <Select value={field.value} onValueChange={(value) => { field.onChange(value); form.setValue("receivingBankAccountId", ""); }}>
                    <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {accounts.map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.currency} •••• {a.accountNumber?.slice(-4)} — {Number(a.balance).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Amount</FormLabel>
                    <FormControl><Input type="number" min="0.01" step="0.01" placeholder="0.00"
                      className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {["USD", "EUR", "GBP", "BTC", "ETH", "USDT"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Payment Method</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue /></SelectTrigger></FormControl>
                     <SelectContent className="bg-slate-900 border-slate-700">
                       {depositMethods.map((method: any) => (
                         <SelectItem key={method.id} value={method.id}>{method.label}</SelectItem>
                       ))}
                    </SelectContent>
                  </Select>
                   {depositMethodsLoading && <p className="text-slate-500 text-xs mt-1">Loading available payment methods...</p>}
                   {!depositMethodsLoading && depositMethods.length === 0 && <p className="text-amber-400 text-xs mt-1">No payment methods are currently enabled for this website.</p>}
                </FormItem>
              )} />
              {form.watch("method") === "bank_transfer" && (() => {
                const eligibleBankAccounts = receivingBankAccounts.filter((account: any) => account.currency === form.watch("currency"));
                if (eligibleBankAccounts.length === 0) return null;
                return (
                  <FormField control={form.control} name="receivingBankAccountId" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Receiving Bank Account</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue placeholder="Select receiving account" /></SelectTrigger></FormControl>
                        <SelectContent className="bg-slate-900 border-slate-700">
                          {eligibleBankAccounts.map((account: any) => <SelectItem key={account.id} value={String(account.id)}>{account.displayName} · {account.bankName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                );
              })()}
              {selectedBankAccount && (
                <>
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-blue-500/40 bg-blue-500/10 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase text-blue-200">Deposit Amount</p>
                      <p className="mt-1 text-xl font-bold text-white">{selectedCurrency} {depositAmount ? Number(depositAmount).toFixed(2) : "Enter amount"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase text-blue-200">Selected Receiving Account</p>
                      <p className="mt-1 text-sm font-semibold text-white">{selectedBankAccount.displayName}</p>
                      <p className="text-sm text-slate-300">{selectedBankAccount.bankName}</p>
                    </div>
                  </div>
                  <ReceivingBankDetails account={selectedBankAccount} />
                </>
              )}
              <Button type="submit" disabled={depositMutation.isPending || depositMethodsLoading || receivingBankAccountsLoading || accounts.length === 0 || depositMethods.length === 0}
                className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold">
                {depositMutation.isPending ? "Submitting..." : "Submit Deposit Request"}
              </Button>
              {accounts.length === 0 && <p className="text-yellow-400 text-xs text-center">No active accounts. Contact support.</p>}
            </form>
          </Form>
        </div>
      </div>
    </CustomerBankingLayout>
  );
}
