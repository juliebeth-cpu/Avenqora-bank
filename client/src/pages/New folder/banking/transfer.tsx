import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingListAccounts, bankingCreateTransfer } from "@/lib/banking-api";
import { useBankingAuth } from "@/lib/banking-auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeftRight, Clock, Lock, AlertTriangle, ShieldCheck, Pencil } from "lucide-react";
import { WORLD_COUNTRIES } from "@/lib/world-countries";
import { formatBankingAmount, getBankingRegionalConfig } from "@/lib/banking-region";
import { IBAN_COUNTRY_CODES, isValidIban } from "@/lib/banking-transfer-validation";

const schema = z.object({
  fromAccountId: z.string().min(1, "Select source account"),
  amount: z.string().trim().min(1, "Amount is required")
    .refine((v) => /^\d+(?:\.\d{1,4})?$/.test(v), "Use no more than 4 decimal places")
    .refine((v) => parseFloat(v) > 0, "Must be greater than 0"),
  currency: z.string().min(1, "Select currency"),
  transferType: z.enum(["national", "international"]),
  recipientCountry: z.string().min(1, "Select recipient country"),
  recipientAccountName: z.string().trim().min(1, "Recipient account name is required"),
  recipientBankName: z.string().trim().min(1, "Recipient bank name is required"),
  accountNumber: z.string().trim().min(1, "Account number is required"),
  iban: z.string().trim().optional(),
  swiftBic: z.string().trim().optional(),
  description: z.string().optional(),
}).superRefine((values, ctx) => {
  const hasIban = Boolean(values.iban?.trim());
  if ((IBAN_COUNTRY_CODES.has(values.recipientCountry) || hasIban) && !isValidIban(values.iban ?? "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["iban"],
      message: "Enter a valid IBAN for this recipient country",
    });
  }
  if (values.swiftBic && !/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/i.test(values.swiftBic.trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["swiftBic"],
      message: "SWIFT/BIC must contain 8 or 11 letters and digits",
    });
  }
  if (values.transferType === "international" && !values.swiftBic?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["swiftBic"],
      message: "SWIFT/BIC is required for international transfers",
    });
  }
});

type FormValues = z.infer<typeof schema>;

interface Props { params: { websiteUid: string } }

export default function BankingTransferPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [done, setDone] = useState<any>(null);
  const [reviewValues, setReviewValues] = useState<FormValues | null>(null);
  const [transactionPin, setTransactionPin] = useState("");
  const { customer } = useBankingAuth();
  const regional = useMemo(() => getBankingRegionalConfig(customer), [customer]);

  const accountQuery = useQuery({
    queryKey: ["banking-accounts", websiteUid, customer?.id],
    queryFn: bankingListAccounts,
    retry: false,
  });
  const allAccounts: any[] = accountQuery.data ?? [];
  const accounts: any[] = allAccounts.filter((a: any) => a.status === "active");
  const accountFrozen = allAccounts.length > 0 && allAccounts.every((a: any) => a.status === "frozen");
  const customerSuspended = customer?.status === "suspended";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromAccountId: "", amount: "", currency: "USD",
      transferType: "national", recipientCountry: "",
      recipientAccountName: "", recipientBankName: "",
      accountNumber: "", iban: "", swiftBic: "", description: "",
    },
  });

  const transferType = form.watch("transferType");
  const recipientCountry = form.watch("recipientCountry");
  const isIbanCountry = IBAN_COUNTRY_CODES.has(recipientCountry);
  const selectedSourceId = form.watch("fromAccountId");
  const selectedSourceAccount = accounts.find((account: any) => String(account.id) === selectedSourceId);
  const isInternational = transferType === "international";
  const reviewTransfer = form.handleSubmit(
    (values) => {
      setTransactionPin("");
      setReviewValues(values);
    },
    (errors) => {
      const firstError = Object.values(errors).find((error) => Boolean(error?.message));
      if (firstError?.message) {
        toast({
          title: "Check transfer details",
          description: String(firstError.message),
          variant: "destructive",
        });
      }
    },
  );

  const mutation = useMutation({
    mutationFn: ({ values, pin }: { values: FormValues; pin: string }) => {
      const beneficiaryDetails: Record<string, string> = {
        recipientAccountName: values.recipientAccountName,
        recipientBankName: values.recipientBankName,
        accountNumber: values.accountNumber,
        recipientCountry: values.recipientCountry,
      };
      if (IBAN_COUNTRY_CODES.has(values.recipientCountry) && values.iban) beneficiaryDetails.iban = values.iban;
      if (values.transferType === "international" && values.swiftBic) beneficiaryDetails.swiftBic = values.swiftBic;
      if (values.description) beneficiaryDetails.description = values.description;

      return bankingCreateTransfer({
        fromAccountId: parseInt(values.fromAccountId),
        amount: parseFloat(values.amount),
        currency: values.currency,
        transferType: values.transferType,
        beneficiaryDetails,
        transactionPin: pin,
      });
    },
    onSuccess: (data) => {
      setDone(data);
      qc.invalidateQueries({ queryKey: ["banking-dashboard"] });
      qc.invalidateQueries({ queryKey: ["banking-transactions"] });
      qc.invalidateQueries({ queryKey: ["banking-transfers"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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
            <p className="text-slate-400 text-sm mt-2">Transfers are disabled while your account is suspended. Please contact customer support.</p>
          </div>
        </div>
      </div>
    </CustomerBankingLayout>
  );

  if (accountFrozen) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-8 flex flex-col items-center gap-4 text-center">
          <Lock className="w-10 h-10 text-blue-400" />
          <div>
            <h2 className="text-white font-semibold text-lg">Account Temporarily Frozen</h2>
            <p className="text-slate-400 text-sm mt-2">Your account has been temporarily frozen. Please contact customer support.</p>
          </div>
        </div>
      </div>
    </CustomerBankingLayout>
  );

  // ── Success / pending screen ─────────────────────────────────────────────────
  if (done) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Transfer Request Received</h1>
            <p className="text-slate-400 text-sm">Pending — our team is reviewing your request</p>
          </div>
        </div>

        <div className="bg-slate-800/60 border border-yellow-500/20 rounded-xl p-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Reference</span>
            <span className="text-white font-mono text-xs">{done.reference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Gross amount</span>
            <span className="text-white font-semibold">{formatBankingAmount(done.amount, done.currency, regional, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Transfer fee</span>
            <span className="text-amber-300">{formatBankingAmount(done.fee ?? 0, done.currency, regional, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Net after platform fee</span>
            <span className="text-green-300 font-semibold">{formatBankingAmount(done.netAmount ?? done.amount, done.currency, regional, { maximumFractionDigits: 4 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Type</span>
            <span className="text-slate-300 capitalize">{done.transferType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status</span>
            <span className="inline-flex items-center gap-1.5 text-yellow-400 font-medium">
              <Pencil className="w-3.5 h-3.5" /> Pending — Under review by our team
            </span>
          </div>
        </div>

        <Button onClick={() => { setDone(null); form.reset(); }}
          className="bg-blue-600 hover:bg-blue-700 text-white">
          Make Another Transfer
        </Button>
      </div>
    </CustomerBankingLayout>
  );

  if (reviewValues) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-blue-400" /> Review Transfer</h1>
          <p className="text-slate-400 text-sm mt-1">Confirm the details, then authorize this transfer with your transaction PIN.</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="text-white font-semibold">{formatBankingAmount(reviewValues.amount, reviewValues.currency, regional, { maximumFractionDigits: 4 })}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Recipient</span><span className="text-white text-right">{reviewValues.recipientAccountName}<br /><span className="text-slate-400 text-xs">{reviewValues.recipientBankName} · {reviewValues.accountNumber}</span></span></div>
          <div className="flex justify-between"><span className="text-slate-400">Transfer type</span><span className="text-slate-300 capitalize">{reviewValues.transferType}</span></div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-3">
          <label htmlFor="transaction-pin" className="text-slate-300 text-sm font-medium">Transaction PIN</label>
          <Input id="transaction-pin" inputMode="numeric" autoComplete="off" type="password" maxLength={6} value={transactionPin} onChange={(event) => setTransactionPin(event.target.value.replace(/\D/g, ""))} placeholder="Enter your 4 to 6 digit PIN" className="bg-slate-900/60 border-slate-700 text-white h-11" />
          <p className="text-slate-500 text-xs">Your PIN is validated securely and is never stored with the transfer.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setReviewValues(null); setTransactionPin(""); }} className="border-slate-600 text-slate-300">Back</Button>
          <Button disabled={transactionPin.length < 4 || mutation.isPending} onClick={() => mutation.mutate({ values: reviewValues, pin: transactionPin })} className="bg-blue-600 hover:bg-blue-700 text-white">{mutation.isPending ? "Authorizing..." : "Authorize Transfer"}</Button>
        </div>
      </div>
    </CustomerBankingLayout>
  );

  // ── Form ─────────────────────────────────────────────────────────────────────
  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-blue-400" /> Bank Transfer
          </h1>
        </div>

        {accountQuery.isLoading && (
          <p className="text-slate-400 text-sm" role="status">Loading your accounts…</p>
        )}
        {accountQuery.isError && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200" role="alert">
            <span>Your accounts could not be loaded. Try again before reviewing this transfer.</span>
            <Button type="button" variant="outline" disabled={accountQuery.isFetching}
              onClick={() => void accountQuery.refetch()}>
              {accountQuery.isFetching ? "Loading…" : "Retry"}
            </Button>
          </div>
        )}
        {!accountQuery.isLoading && !accountQuery.isError && accounts.length === 0 && (
          <p className="text-amber-200 text-sm" role="status">No active account is available for this transfer.</p>
        )}

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
          <Form {...form}>
            <form onSubmit={reviewTransfer} className="space-y-5">

              {/* From Account */}
              <FormField control={form.control} name="fromAccountId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">From Account</FormLabel>
                  <Select value={field.value} onValueChange={(value) => {
                    field.onChange(value);
                    const selected = accounts.find((account: any) => String(account.id) === value);
                    form.setValue(
                      "currency",
                      selected?.currency ? String(selected.currency).trim().toUpperCase() : "",
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}>
                    <FormControl>
                      <SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11">
                        <SelectValue placeholder="Select your account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {accounts.length === 0
                        ? <SelectItem value="_none" disabled>No active accounts</SelectItem>
                        : accounts.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.currency} — {Number(a.balance).toFixed(2)} •••{a.accountNumber?.slice(-4)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Amount + Currency */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Amount</FormLabel>
                    <FormControl>
                    <Input type="number" min="0.0001" step="0.0001" placeholder="0.00"
                        className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Currency</FormLabel>
                    <Select value={field.value ?? ""} disabled={!selectedSourceAccount}
                      onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-transfer-currency" className="bg-slate-900/60 border-slate-700 text-white h-11">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {selectedSourceAccount?.currency && (
                          <SelectItem value={String(selectedSourceAccount.currency).trim().toUpperCase()}>
                            {String(selectedSourceAccount.currency).trim().toUpperCase()} · Source-account currency
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage data-testid="error-transfer-currency" />
                  </FormItem>
                )} />
              </div>

              {/* Transfer Type + Recipient Country */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="transferType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Transfer Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="national">Domestic</SelectItem>
                        <SelectItem value="international">International</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="recipientCountry" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Recipient Country</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                         {WORLD_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Recipient Account Name */}
              <FormField control={form.control} name="recipientAccountName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Recipient Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Full name as on bank account"
                      className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Recipient Bank Name */}
              <FormField control={form.control} name="recipientBankName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Recipient Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Barclays, Chase, HSBC"
                      className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Account Number */}
              <FormField control={form.control} name="accountNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Account Number</FormLabel>
                  <FormControl>
                    <Input placeholder="Recipient's account number"
                      className="bg-slate-900/60 border-slate-700 text-white h-11 font-mono" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* IBAN — only for IBAN countries */}
              {isIbanCountry && (
                <FormField control={form.control} name="iban" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">
                      IBAN
                       <span className="ml-2 text-xs text-blue-400 font-normal">Required for {WORLD_COUNTRIES.find(c => c.code === recipientCountry)?.name}</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                        className="bg-slate-900/60 border-slate-700 text-white h-11 font-mono uppercase" {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* SWIFT/BIC — only for international */}
              {isInternational && (
                <FormField control={form.control} name="swiftBic" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">
                      SWIFT / BIC Code
                      <span className="ml-2 text-xs text-blue-400 font-normal">Required for international transfers</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BARCGB22"
                        className="bg-slate-900/60 border-slate-700 text-white h-11 font-mono uppercase" {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Transfer Description <span className="text-slate-500 font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="Purpose of transfer, invoice reference, etc."
                      rows={2}
                      className="bg-slate-900/60 border-slate-700 text-white resize-none" {...field} />
                  </FormControl>
                </FormItem>
              )} />

              <Button type="submit"
                disabled={mutation.isPending || accountQuery.isLoading || accountQuery.isError || accounts.length === 0}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {accountQuery.isLoading ? "Loading accounts…" : accountQuery.isError ? "Accounts unavailable" : accounts.length === 0 ? "No active account" : "Review Transfer"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </CustomerBankingLayout>
  );
}
