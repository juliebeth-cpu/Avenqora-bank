import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingMe, bankingGetKyc, bankingUpdatePhoto, bankingChangePassword } from "@/lib/banking-api";
import { useBankingAuth } from "@/lib/banking-auth";
import { useCustomerLocalization } from "@/lib/customer-localization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import LockedCustomerInformation, { fileToDataUrl } from "@/components/customer/LockedCustomerInformation";

interface Props { params: { websiteUid: string } }

export default function BankingProfilePage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { setCustomer, customer } = useBankingAuth();
  const { t } = useCustomerLocalization();
  const [pwLoading, setPwLoading] = useState(false);

  const { data: me } = useQuery({ queryKey: ["banking-me"], queryFn: bankingMe, retry: false });
  const { data: kyc } = useQuery({ queryKey: ["banking-kyc"], queryFn: bankingGetKyc, retry: false });

  const pwForm = useForm({ defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const photoMutation = useMutation({
    mutationFn: async (file: File) => bankingUpdatePhoto(await fileToDataUrl(file)),
    onSuccess: (data) => {
      setCustomer({ ...customer!, profilePhotoUrl: data.profilePhotoUrl });
      qc.invalidateQueries({ queryKey: ["banking-me"] });
      toast({ title: t("Profile picture updated") });
    },
    onError: (e: any) => toast({ title: t("Error"), description: e.message, variant: "destructive" }),
  });

  const onChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      toast({ title: t("Passwords don't match"), variant: "destructive" }); return;
    }
    setPwLoading(true);
    try {
      await bankingChangePassword(values.currentPassword, values.newPassword);
      toast({ title: t("Password changed successfully") });
      pwForm.reset();
    } catch (e: any) {
      toast({ title: t("Error"), description: e.message, variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="max-w-xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("Profile")}</h1>
          <p className="text-slate-400 text-sm mt-1">{t("View your account information and security settings")}</p>
        </div>

        {/* Account info */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg font-bold">
            {me?.firstName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="text-white font-semibold">{me?.firstName} {me?.lastName}</p>
            <p className="text-slate-400 text-sm">{me?.email} · @{me?.username}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium ${me?.emailVerified ? "text-green-400" : "text-yellow-400"}`}>
                {me?.emailVerified ? t("Email verified") : t("Email not verified")}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 capitalize">{me?.status?.replace("_", " ")}</span>
            </div>
          </div>
        </div>

        <LockedCustomerInformation customer={{ ...(me ?? customer), ...(Array.isArray(kyc) ? kyc[0] : kyc), kycAddress: Array.isArray(kyc) ? kyc[0]?.address : kyc?.address }} onPhotoChange={(file) => photoMutation.mutate(file)} photoSaving={photoMutation.isPending} />

        {/* Change password */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> {t("Change Password")}</h2>
          <form onSubmit={pwForm.handleSubmit(onChangePassword)} className="space-y-4">
            {[["currentPassword", t("Current Password")],["newPassword", t("New Password")],["confirmPassword", t("Confirm New Password")]].map(([key, label]) => (
              <div key={key as string}>
                <label className="text-slate-300 text-sm block mb-1">{label as string}</label>
                <Input {...pwForm.register(key as any)} type="password" placeholder="••••••••"
                  className="bg-slate-900/60 border-slate-700 text-white h-11" />
              </div>
            ))}
            <Button type="submit" disabled={pwLoading} className="w-full h-11 bg-slate-700 hover:bg-slate-600 text-white gap-2">
              <Lock className="w-4 h-4" /> {pwLoading ? t("Changing...") : t("Change Password")}
            </Button>
          </form>
        </div>
      </div>
    </CustomerBankingLayout>
  );
}
