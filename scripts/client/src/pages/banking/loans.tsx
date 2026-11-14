import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { bankingApplyLoan, bankingListLoans, bankingDashboard } from "@/lib/banking-api";
import { useQuery as useAccounts } from "@tanstack/react-query";
import { Landmark, Plus, X, Clock, CheckCircle, XCircle, AlertCircle, TrendingUp } from "lucide-react";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingAmount, formatBankingDate, getBankingRegionalConfig } from "@/lib/banking-region";

interface Props { params: { websiteUid: string } }

const LOAN_TYPES = [
  { value: "personal", label: "Personal Loan" },
  { value: "business", label: "Business Loan" },
  { value: "mortgage", label: "Mortgage" },
  { value: "auto", label: "Auto Loan" },
  { value: "education", label: "Education Loan" },
  { value: "emergency", label: "Emergency Loan" },
];

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "text-yellow-400 bg-yellow-400/10", icon: Clock, label: "Pending Review" },
  approved: { color: "text-blue-400 bg-blue-400/10", icon: CheckCircle, label: "Approved" },
  active: { color: "text-green-400 bg-green-400/10", icon: TrendingUp, label: "Active" },
  rejected: { color: "text-red-400 bg-red-400/10", icon: XCircle, label: "Rejected" },
  completed: { color: "text-slate-400 bg-slate-400/10", icon: CheckCircle, label: "Completed" },
  defaulted: { color: "text-orange-400 bg-orange-400/10", icon: AlertCircle, label: "Defaulted" },
};

export default function LoansPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const [showForm, setShowForm] = useState(false);

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ["banking-loans"],
    queryFn: bankingListLoans,
  });

  const { data: dashData } = useAccounts({
    queryKey: ["banking-dashboard"],
    queryFn: bankingDashboard,
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      accountId: "", loanType: "personal", principalAmount: "",
      termMonths: "12", purpose: "", collateral: "",
    },
  });
  const accounts: any[] = dashData?.accounts ?? [];
  const selectedAccountId = watch("accountId");
  const selectedAccount = accounts.find((account) => String(account.id) === selectedAccountId);
  const loanCurrency = selectedAccount?.currency || regional.fallbackCurrency;

  const applyMutation = useMutation({
    mutationFn: bankingApplyLoan,
    onSuccess: () => {
      toast({ title: "Loan application submitted", description: "We will review your application shortly." });
      qc.invalidateQueries({ queryKey: ["banking-loans"] });
      setShowForm(false);
      reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const onSubmit = (data: any) => {
    applyMutation.mutate({
      accountId: parseInt(data.accountId),
      loanType: data.loanType,
      principalAmount: parseFloat(data.principalAmount),
      termMonths: parseInt(data.termMonths),
      purpose: data.purpose || undefined,
      collateral: data.collateral || undefined,
    });
  };

  // Simple monthly payment preview
  const principal = parseFloat(watch("principalAmount") || "0");
  const term = parseInt(watch("termMonths") || "12");
  const rate = 5 / 100 / 12;
  const monthly = principal && term ? (rate === 0 ? principal / term : (principal * rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1)) : 0;

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Landmark className="w-6 h-6 text-blue-400" /> Loans
            </h1>
            <p className="text-slate-400 text-sm mt-1">Apply for credit products</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9">
              <Plus className="w-4 h-4" /> Apply for Loan
            </Button>
          )}
        </div>

        {/* Application form */}
        {showForm && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Loan Application</h2>
              <button onClick={() => { setShowForm(false); reset(); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Loan Type</label>
                  <Select defaultValue="personal" onValueChange={(v) => setValue("loanType", v)}>
                    <SelectTrigger className="bg-slate-900/80 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Account *</label>
                  <Select onValueChange={(v) => setValue("accountId", v)}>
                    <SelectTrigger className="bg-slate-900/80 border-slate-600 text-white">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.accountType} ···{String(a.accountNumber).slice(-4)} ({a.currency})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Principal Amount ({loanCurrency}) *</label>
                  <Input {...register("principalAmount")} type="number" step="0.01" min="1" placeholder="0.00" className="bg-slate-900/80 border-slate-600 text-white" required />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Term (months)</label>
                  <Select defaultValue="12" onValueChange={(v) => setValue("termMonths", v)}>
                    <SelectTrigger className="bg-slate-900/80 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 6, 12, 18, 24, 36, 48, 60].map((m) => (
                        <SelectItem key={m} value={String(m)}>{m} months</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Currency</label>
                  <div className="flex h-10 items-center rounded-md border border-slate-700 bg-slate-900/60 px-3 text-sm text-slate-300">
                    {selectedAccount ? `${loanCurrency} · taken from selected account` : "Select an account first"}
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Purpose</label>
                  <Input {...register("purpose")} placeholder="Loan purpose" className="bg-slate-900/80 border-slate-600 text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 text-xs block mb-1">Collateral</label>
                  <Input {...register("collateral")} placeholder="Any collateral offered (optional)" className="bg-slate-900/80 border-slate-600 text-white" />
                </div>
              </div>

              {/* Payment preview */}
              {monthly > 0 && selectedAccount && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                  <p className="text-blue-300 text-xs font-medium mb-2">Estimated Payment (5% p.a.)</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-white font-bold">{formatBankingAmount(monthly, loanCurrency, regional)}</p>
                      <p className="text-slate-400 text-xs">Monthly</p>
                    </div>
                    <div>
                      <p className="text-white font-bold">{term}mo</p>
                      <p className="text-slate-400 text-xs">Term</p>
                    </div>
                    <div>
                      <p className="text-white font-bold">{formatBankingAmount(monthly * term, loanCurrency, regional)}</p>
                      <p className="text-slate-400 text-xs">Total Repay</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={applyMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {applyMutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }} className="border-slate-600 text-slate-300">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Loan list */}
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-slate-800/60 rounded-xl" />)}
          </div>
        ) : (loans as any[]).length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-10 text-center">
            <Landmark className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No loan applications yet</p>
            <p className="text-slate-500 text-sm mt-1">Apply for a loan to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(loans as any[]).map((loan: any) => {
              const cfg = statusConfig[loan.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              const progress = loan.status === "active" && loan.totalRepayable
                ? (Number(loan.amountRepaid) / Number(loan.totalRepayable)) * 100
                : 0;
              return (
                <div key={loan.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold capitalize">{loan.loanType.replace("_", " ")} Loan</p>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mt-1">
                        {formatBankingAmount(loan.principalAmount, loan.currency, regional)}
                        {loan.termMonths && ` · ${loan.termMonths} months`}
                        {loan.interestRate && Number(loan.interestRate) > 0 && ` · ${loan.interestRate}% p.a.`}
                      </p>
                      {loan.purpose && <p className="text-slate-500 text-xs mt-0.5">{loan.purpose}</p>}
                      {loan.monthlyPayment && (
                        <p className="text-blue-400 text-xs mt-1">
                          Monthly payment: {formatBankingAmount(loan.monthlyPayment, loan.currency, regional)}
                        </p>
                      )}
                      {loan.status === "active" && loan.totalRepayable && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>Repaid: {formatBankingAmount(loan.amountRepaid, loan.currency, regional)}</span>
                            <span>Total: {formatBankingAmount(loan.totalRepayable, loan.currency, regional)}</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(progress, 100)}%` }} />
                          </div>
                        </div>
                      )}
                      {loan.adminNotes && loan.status === "rejected" && (
                        <p className="text-red-400 text-xs mt-1.5 bg-red-400/10 px-2 py-1 rounded">{loan.adminNotes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-500 text-xs">{formatBankingDate(loan.createdAt, regional)}</p>
                      <p className="text-slate-600 text-xs font-mono mt-0.5">{loan.reference}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerBankingLayout>
  );
}
