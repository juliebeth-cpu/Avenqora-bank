import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  bankingListBeneficiaries, bankingCreateBeneficiary, bankingDeleteBeneficiary,
} from "@/lib/banking-api";
import { Users, Plus, Trash2, Edit2, X, Building, Globe } from "lucide-react";

interface Props { params: { websiteUid: string } }

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY", "NGN", "GHS", "KES", "ZAR"];

export default function BeneficiariesPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: beneficiaries = [], isLoading } = useQuery({
    queryKey: ["banking-beneficiaries"],
    queryFn: bankingListBeneficiaries,
  });

  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      nickname: "", bankName: "", accountName: "", accountNumber: "",
      iban: "", swiftBic: "", routingNumber: "", bankAddress: "",
      currency: "USD", country: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: bankingCreateBeneficiary,
    onSuccess: () => {
      toast({ title: "Beneficiary saved" });
      qc.invalidateQueries({ queryKey: ["banking-beneficiaries"] });
      setShowForm(false);
      reset();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: bankingDeleteBeneficiary,
    onSuccess: () => {
      toast({ title: "Beneficiary removed" });
      qc.invalidateQueries({ queryKey: ["banking-beneficiaries"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const onSubmit = (data: any) => {
    const cleaned = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ""));
    createMutation.mutate(cleaned);
  };

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" /> Beneficiaries
            </h1>
            <p className="text-slate-400 text-sm mt-1">Saved recipients for transfers</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9">
              <Plus className="w-4 h-4" /> Add Beneficiary
            </Button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-white font-semibold">New Beneficiary</h2>
              <button onClick={() => { setShowForm(false); reset(); }} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Nickname *</label>
                  <Input {...register("nickname")} placeholder="e.g. John's Account" className="bg-slate-900/80 border-slate-600 text-white" required />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Bank Name *</label>
                  <Input {...register("bankName")} placeholder="e.g. Chase Bank" className="bg-slate-900/80 border-slate-600 text-white" required />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Account Name *</label>
                  <Input {...register("accountName")} placeholder="Full legal name" className="bg-slate-900/80 border-slate-600 text-white" required />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Account Number *</label>
                  <Input {...register("accountNumber")} placeholder="Account number" className="bg-slate-900/80 border-slate-600 text-white" required />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">IBAN</label>
                  <Input {...register("iban")} placeholder="e.g. GB29NWBK60161331926819" className="bg-slate-900/80 border-slate-600 text-white font-mono text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">SWIFT / BIC</label>
                  <Input {...register("swiftBic")} placeholder="e.g. CHASUS33" className="bg-slate-900/80 border-slate-600 text-white font-mono text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Routing Number</label>
                  <Input {...register("routingNumber")} placeholder="For US transfers" className="bg-slate-900/80 border-slate-600 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Currency</label>
                  <Select defaultValue="USD" onValueChange={(v) => setValue("currency", v)}>
                    <SelectTrigger className="bg-slate-900/80 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Country</label>
                  <Input {...register("country")} placeholder="e.g. United States" className="bg-slate-900/80 border-slate-600 text-white" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs block mb-1">Bank Address</label>
                  <Input {...register("bankAddress")} placeholder="Bank branch address" className="bg-slate-900/80 border-slate-600 text-white" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {createMutation.isPending ? "Saving..." : "Save Beneficiary"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); reset(); }} className="border-slate-600 text-slate-300">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-800/60 rounded-xl" />)}
          </div>
        ) : (beneficiaries as any[]).length === 0 ? (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-10 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No beneficiaries yet</p>
            <p className="text-slate-500 text-sm mt-1">Add a beneficiary to make transfers faster</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(beneficiaries as any[]).map((b: any) => (
              <div key={b.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 hover:border-slate-600 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                      <Building className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold">{b.nickname}</p>
                      <p className="text-slate-400 text-sm">{b.accountName} · {b.bankName}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">{b.accountNumber}</p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {b.iban && (
                          <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded font-mono">
                            IBAN: {b.iban}
                          </span>
                        )}
                        {b.swiftBic && (
                          <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded font-mono">
                            BIC: {b.swiftBic}
                          </span>
                        )}
                        {b.country && (
                          <span className="text-xs bg-slate-700/60 text-slate-400 px-2 py-0.5 rounded flex items-center gap-1">
                            <Globe className="w-3 h-3" />{b.country}
                          </span>
                        )}
                        <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded">{b.currency}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(b.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerBankingLayout>
  );
}
