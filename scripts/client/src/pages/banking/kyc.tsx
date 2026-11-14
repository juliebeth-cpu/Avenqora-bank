import { useQuery } from "@tanstack/react-query";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import CustomerKycForm from "@/components/customer-kyc-form";
import { bankingGetKyc, bankingSubmitKyc } from "@/lib/banking-api";
import { Shield, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { useBankingAuth } from "@/lib/banking-auth";
import { formatBankingDate, getBankingRegionalConfig } from "@/lib/banking-region";

interface Props { params: { websiteUid: string } }

const statusInfo: Record<string, { color: string; icon: any; text: string }> = {
  pending: { color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", icon: Clock, text: "Under Review" },
  approved: { color: "text-green-400 border-green-500/30 bg-green-500/10", icon: CheckCircle, text: "Approved" },
  rejected: { color: "text-red-400 border-red-500/30 bg-red-500/10", icon: XCircle, text: "Rejected" },
  more_info_requested: { color: "text-orange-400 border-orange-500/30 bg-orange-500/10", icon: AlertCircle, text: "More Info Needed" },
  not_submitted: { color: "text-slate-400 border-slate-700 bg-slate-800/40", icon: Shield, text: "Not Submitted" },
};

export default function BankingKycPage({ params }: Props) {
  const { websiteUid } = params;
  const { customer } = useBankingAuth();
  const regional = getBankingRegionalConfig(customer);
  const { data: submissions, isLoading, refetch } = useQuery({ queryKey: ["banking-kyc", websiteUid], queryFn: bankingGetKyc });

  if (isLoading) return <CustomerBankingLayout websiteUid={websiteUid}><div className="animate-pulse h-32 bg-slate-800/60 rounded-xl" /></CustomerBankingLayout>;

  const kyc = Array.isArray(submissions) ? submissions[0] : submissions;
  const status = kyc?.status ?? "not_submitted";
  const info = statusInfo[status] ?? statusInfo.not_submitted;
  const Icon = info?.icon ?? Clock;
  return (
      <CustomerBankingLayout websiteUid={websiteUid}>
        <div className="max-w-lg space-y-4">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Shield className="w-6 h-6 text-blue-400" /> KYC Verification</h1>
          <div className={`border rounded-xl p-5 ${info?.color ?? "text-slate-400 border-slate-700 bg-slate-800/40"}`}>
            <div className="flex items-center gap-3 mb-2">
              <Icon className="w-6 h-6" />
              <p className="font-semibold">{info?.text ?? "Pending"}</p>
            </div>
            {kyc?.reviewNotes && <p className="text-sm mt-2 opacity-80">Notes: {kyc.reviewNotes}</p>}
            {kyc?.submittedAt && <p className="text-xs mt-2 opacity-60">Submitted: {formatBankingDate(kyc.submittedAt, regional)}</p>}
          </div>
          {status !== "pending" && status !== "approved" && (
            <CustomerKycForm
              token={localStorage.getItem("danzy_banking_token") ?? ""}
              primaryColor="#2563eb"
              submitKyc={bankingSubmitKyc}
              onSubmitted={() => { void refetch(); }}
              intro={status === "rejected" || status === "more_info_requested"
                ? "Update the requested information and resubmit your identity documents."
                : undefined}
            />
          )}
        </div>
      </CustomerBankingLayout>
  );
}
