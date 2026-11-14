import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingDashboard, bankingCreateWithdrawal } from "@/lib/banking-api";
import { useBankingAuth } from "@/lib/banking-auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowUpCircle, CheckCircle, Lock, AlertTriangle } from "lucide-react";
import TransactionPinInput from "@/components/customer/TransactionPinInput";

const schema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: z.string().min(1, "Enter amount").refine((v) => parseFloat(v) > 0, "Amount must be positive"),
  currency: z.string().default("USD"),
  destinationType: z.enum(["bank_account", "crypto_wallet"]),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  routingNumber: z.string().optional(),
  walletAddress: z.string().optional(),
  network: z.string().optional(),
  transactionPin: z.string().regex(/^\d{4,6}$/, "Enter your 4 to 6 digit transaction PIN"),
});

interface Props { params: { websiteUid: string } }

export default function BankingWithdrawPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [done, setDone] = useState<any>(null);
  const { customer } = useBankingAuth();

  const { data } = useQuery({ queryKey: ["banking-dashboard"], queryFn: bankingDashboard, retry: false });
  const allAccounts: any[] = data?.accounts ?? [];
  const accounts: any[] = allAccounts.filter((a: any) => a.status === "active");
  const accountFrozen = allAccounts.length > 0 && allAccounts.every((a: any) => a.status === "frozen");
  const customerSuspended = customer?.status === "suspended";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { accountId: "", amount: "", currency: "USD", destinationType: "bank_account", transactionPin: "" },
  });

  const destinationType = form.watch("destinationType");

  const mutation = useMutation({
    mutationFn: (v: z.infer<typeof schema>) => {
      const destinationDetails: Record<string, string> = {};
      if (v.destinationType === "bank_account") {
        if (v.accountName) destinationDetails.accountName = v.accountName;
        if (v.accountNumber) destinationDetails.accountNumber = v.accountNumber;
        if (v.bankName) destinationDetails.bankName = v.bankName;
        if (v.routingNumber) destinationDetails.routingNumber = v.routingNumber;
      } else {
        if (v.walletAddress) destinationDetails.walletAddress = v.walletAddress;
        if (v.network) destinationDetails.network = v.network;
      }
       return bankingCreateWithdrawal({ accountId: parseInt(v.accountId), amount: parseFloat(v.amount), currency: v.currency, destinationType: v.destinationType, destinationDetails, transactionPin: v.transactionPin });
    },
       onSuccess: (data) => { setDone(data); qc.invalidateQueries({ queryKey: ["banking-dashboard"] }); },
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
            <p className="text-slate-400 text-sm mt-2">Withdrawals are disabled while your account is suspended. Please contact customer support.</p>
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

  if (done) return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <h1 className="text-xl font-bold text-white">Withdrawal Submitted</h1>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">Reference</span><span className="text-white font-mono">{done.reference}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Gross amount</span><span className="text-white font-semibold">{done.currency} {Number(done.amount).toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Transaction fee (0.05%)</span><span className="text-amber-300">{done.currency} {Number(done.fee ?? 0).toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Net delivered after approval</span><span className="text-green-300 font-semibold">{done.currency} {Number(done.netAmount ?? done.amount).toFixed(4)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Status</span><span className="text-yellow-400">Pending Review</span></div>
        </div>
        <p className="text-slate-400 text-sm">Your withdrawal request will be reviewed and processed. Available balance changes only after approval.</p>
        <Button onClick={() => setDone(null)} className="bg-blue-600 hover:bg-blue-700 text-white">New Withdrawal</Button>
      </div>
    </CustomerBankingLayout>
  );

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6 text-red-400" /> Withdraw Funds
          </h1>
          <p className="text-slate-400 text-sm mt-1">Submit a withdrawal request for review</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
              <FormField control={form.control} name="accountId" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">From Account</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue placeholder="Select account" /></SelectTrigger></FormControl>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {accounts.map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.currency} — Balance: {Number(a.balance).toFixed(2)} •••{a.accountNumber?.slice(-4)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">Amount</FormLabel>
                    <FormControl><Input type="number" min="0.01" step="0.01" placeholder="0.00" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {["USD","EUR","GBP","BTC","ETH","USDT"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="destinationType" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-300">Destination Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="bg-slate-900/60 border-slate-700 text-white h-11"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      <SelectItem value="bank_account">Bank Account</SelectItem>
                      <SelectItem value="crypto_wallet">Crypto Wallet</SelectItem>
                    </SelectContent>
                  </Select></FormItem>
              )} />

              {destinationType === "bank_account" ? (
                <div className="grid grid-cols-2 gap-4">
                  {[["accountName","Account Holder Name"],["accountNumber","Account Number"],["bankName","Bank Name"],["routingNumber","Routing/SWIFT Number"]].map(([key,label]) => (
                    <FormField key={key} control={form.control} name={key as any} render={({ field }) => (
                      <FormItem><FormLabel className="text-slate-300">{label}</FormLabel>
                        <FormControl><Input placeholder={label} className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {[["walletAddress","Wallet Address"],["network","Network (BTC/ETH/TRC20)"]].map(([key,label]) => (
                    <FormField key={key} control={form.control} name={key as any} render={({ field }) => (
                      <FormItem><FormLabel className="text-slate-300">{label}</FormLabel>
                        <FormControl><Input placeholder={label} className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  ))}
                </div>
              )}

              <FormField control={form.control} name="transactionPin" render={({ field }) => (
                <FormItem><FormControl><TransactionPinInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" disabled={mutation.isPending || accounts.length === 0}
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold">
                {mutation.isPending ? "Submitting..." : "Submit Withdrawal Request"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </CustomerBankingLayout>
  );
}
