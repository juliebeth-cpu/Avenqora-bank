import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import PortalLayout from "@/components/layout/portal-layout";
import { portalGetBankingSettings, portalUpdateBankingSettings, portalListDepositBankAccounts, portalCreateDepositBankAccount, portalUpdateDepositBankAccount } from "@/lib/portal-api";
import { portalGetCustomerLocalization, portalUpdateCustomerLocalization } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save, Plus, Pencil, X } from "lucide-react";
import { CUSTOMER_LOCALES, DEFAULT_CUSTOMER_LOCALIZATION } from "@/lib/localization-registry";

const DEFAULT_DEPOSIT_METHODS = [
  { id: "bank_transfer", label: "Bank Transfer", enabled: true, instructions: "" },
  { id: "crypto", label: "Cryptocurrency", enabled: true, instructions: "" },
  { id: "cash_app", label: "Cash App", enabled: false, instructions: "" },
  { id: "paypal", label: "PayPal", enabled: false, instructions: "" },
  { id: "other", label: "Other", enabled: false, instructions: "" },
];

const EMPTY_BANK_ACCOUNT = {
  displayName: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  currency: "USD",
  country: "",
  region: "all",
  routingNumber: "",
  iban: "",
  swiftBic: "",
  bankAddress: "",
  instructions: "",
  enabled: false,
  sortOrder: 0,
};

export default function BankingSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { register, handleSubmit, reset, watch, setValue } = useForm<any>({
    defaultValues: { kycRequirement: "optional", enableNationalTransfer: true, enableInternationalTransfer: true, enableInternalTransfer: true, enableCryptoTransfer: false, supportWidgetEnabled: false, smartsuppKey: "", depositMethods: DEFAULT_DEPOSIT_METHODS },
  });

  const { data: settings, isLoading } = useQuery({ queryKey: ["portal-banking-settings"], queryFn: portalGetBankingSettings });
  const { data: depositBankAccounts = [], isLoading: bankAccountsLoading } = useQuery({
    queryKey: ["portal-deposit-bank-accounts"],
    queryFn: portalListDepositBankAccounts,
  });
  const { data: localization } = useQuery({ queryKey: ["portal-customer-localization"], queryFn: portalGetCustomerLocalization });
  const [localizationForm, setLocalizationForm] = useState(DEFAULT_CUSTOMER_LOCALIZATION);
  const [bankAccountForm, setBankAccountForm] = useState(EMPTY_BANK_ACCOUNT);
  const [editingBankAccountId, setEditingBankAccountId] = useState<number | null>(null);

  useEffect(() => {
    if (localization) setLocalizationForm(localization);
  }, [localization]);

  useEffect(() => {
    if (settings) {
      reset({
        bankInstructions: settings.bankInstructions ?? "",
        cryptoInstructions: settings.cryptoInstructions ?? "",
        kycRequirement: settings.kycRequirement ?? "optional",
        enableNationalTransfer: settings.enableNationalTransfer ?? true,
        enableInternationalTransfer: settings.enableInternationalTransfer ?? true,
        enableInternalTransfer: settings.enableInternalTransfer ?? true,
        enableCryptoTransfer: settings.enableCryptoTransfer ?? false,
        minimumDeposit: settings.minimumDeposit ?? "",
        minimumWithdrawal: settings.minimumWithdrawal ?? "",
        withdrawalFeePercent: settings.withdrawalFeePercent ?? "",
        transferFeePercent: settings.transferFeePercent ?? "",
        supportWidgetEnabled: settings.supportWidgetEnabled === true,
        smartsuppKey: settings.smartsuppKey ?? "",
        depositMethods: settings.depositMethods?.length
          ? settings.depositMethods
          : DEFAULT_DEPOSIT_METHODS,
      });
    }
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) => portalUpdateBankingSettings(data),
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["portal-banking-settings"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const localizationMutation = useMutation({
    mutationFn: () => portalUpdateCustomerLocalization(localizationForm),
    onSuccess: (updated) => {
      setLocalizationForm(updated);
      toast({ title: "Customer language settings saved" });
      qc.invalidateQueries({ queryKey: ["portal-customer-localization"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const bankAccountMutation = useMutation({
    mutationFn: (body: object) => editingBankAccountId
      ? portalUpdateDepositBankAccount(editingBankAccountId, body)
      : portalCreateDepositBankAccount(body),
    onSuccess: () => {
      toast({ title: editingBankAccountId ? "Receiving account updated" : "Receiving account added" });
      qc.invalidateQueries({ queryKey: ["portal-deposit-bank-accounts"] });
      setBankAccountForm(EMPTY_BANK_ACCOUNT);
      setEditingBankAccountId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <PortalLayout><div className="animate-pulse space-y-4">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-slate-800 rounded-lg" />)}</div></PortalLayout>;

  const kycRequirement = watch("kycRequirement");
  const enableNationalTransfer = watch("enableNationalTransfer");
  const enableInternationalTransfer = watch("enableInternationalTransfer");
  const enableInternalTransfer = watch("enableInternalTransfer");
  const enableCryptoTransfer = watch("enableCryptoTransfer");
  const depositMethods = watch("depositMethods") ?? DEFAULT_DEPOSIT_METHODS;

  return (
    <PortalLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-400" /> Banking Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure payment instructions, KYC, and transfer options</p>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-white font-semibold">Customer Language &amp; Localization</h2>
            <p className="text-xs text-slate-500 mt-1">
              Customer pages use the selected country to choose a language automatically. Customers can override it when enabled.
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm font-medium">Enable customer localization</p>
              <p className="text-slate-500 text-xs">Keep automatic language selection available.</p>
            </div>
            <Switch checked={localizationForm.enabled} onCheckedChange={(value) => setLocalizationForm((current) => ({ ...current, enabled: value }))} />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-2">Fallback language</label>
            <Select
              value={localizationForm.defaultLocale}
              onValueChange={(value) => setLocalizationForm((current) => ({ ...current, defaultLocale: value as typeof current.defaultLocale }))}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {CUSTOMER_LOCALES.map((language) => <SelectItem key={language.code} value={language.code}>{language.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Available customer languages</p>
            {CUSTOMER_LOCALES.map((language) => (
              <div key={language.code} className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">{language.label}</span>
                <Switch
                  checked={localizationForm.supportedLocales.includes(language.code)}
                  disabled={localizationForm.supportedLocales.length === 1 && localizationForm.supportedLocales.includes(language.code)}
                  onCheckedChange={(enabled) => setLocalizationForm((current) => ({
                    ...current,
                    supportedLocales: enabled
                      ? [...new Set([...current.supportedLocales, language.code])]
                      : current.supportedLocales.filter((code) => code !== language.code),
                  }))}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm font-medium">Detect language from country</p>
              <p className="text-slate-500 text-xs">Use the customer&apos;s country when no override is saved.</p>
            </div>
            <Switch checked={localizationForm.countryAutoDetect} onCheckedChange={(value) => setLocalizationForm((current) => ({ ...current, countryAutoDetect: value }))} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-300 text-sm font-medium">Allow customer language override</p>
              <p className="text-slate-500 text-xs">Customers can choose another enabled language in Settings.</p>
            </div>
            <Switch checked={localizationForm.allowCustomerOverride} onCheckedChange={(value) => setLocalizationForm((current) => ({ ...current, allowCustomerOverride: value }))} />
          </div>
          <Button type="button" disabled={localizationMutation.isPending} onClick={() => localizationMutation.mutate()} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Save className="w-4 h-4" /> {localizationMutation.isPending ? "Saving..." : "Save Customer Language Settings"}
          </Button>
        </div>

        <section className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-white font-semibold">Receiving Bank Accounts</h2>
            <p className="text-xs text-slate-500 mt-1">Enabled accounts are shown to matching customers for manual bank-transfer deposits.</p>
          </div>
          <div className="divide-y divide-slate-700/60">
            {bankAccountsLoading ? <p className="py-3 text-sm text-slate-500">Loading accounts...</p> : depositBankAccounts.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">No receiving accounts configured.</p>
            ) : depositBankAccounts.map((account: any) => (
              <div key={account.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{account.displayName} <span className="text-slate-500">({account.currency})</span></p>
                  <p className="text-xs text-slate-400">{account.bankName} · {account.accountName} · {account.accountNumber}</p>
                  <p className="text-xs text-slate-500">{account.region ?? "All regions"} · {account.enabled ? "Enabled" : "Disabled"}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setBankAccountForm({ ...EMPTY_BANK_ACCOUNT, ...account, region: account.region ?? "all", country: account.country ?? "", routingNumber: account.routingNumber ?? "", iban: account.iban ?? "", swiftBic: account.swiftBic ?? "", bankAddress: account.bankAddress ?? "", instructions: account.instructions ?? "" });
                  setEditingBankAccountId(account.id);
                }} className="shrink-0 border-slate-700 text-slate-300">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
              </div>
            ))}
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            const { region, ...fields } = bankAccountForm;
            bankAccountMutation.mutate({
              ...fields,
              region: region === "all" ? null : region,
              country: fields.country.trim() || null,
              routingNumber: fields.routingNumber.trim() || null,
              iban: fields.iban.trim() || null,
              swiftBic: fields.swiftBic.trim() || null,
              bankAddress: fields.bankAddress.trim() || null,
              instructions: fields.instructions.trim() || null,
            });
          }} className="space-y-3 border-t border-slate-700/60 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                ["displayName", "Account label"], ["bankName", "Bank name"], ["accountName", "Account holder"],
                ["accountNumber", "Account number"], ["currency", "Currency (3-letter code)"], ["country", "Country"],
                ["routingNumber", "Routing number"], ["iban", "IBAN"], ["swiftBic", "SWIFT / BIC"], ["sortOrder", "Display order"],
              ] as const).map(([field, label]) => (
                <label key={field} className="text-xs text-slate-400">
                  {label}
                  <Input
                    value={bankAccountForm[field] as string | number}
                    onChange={(event) => setBankAccountForm((current) => ({ ...current, [field]: field === "sortOrder" ? Number(event.target.value) : event.target.value }))}
                    type={field === "sortOrder" ? "number" : "text"}
                    min={field === "sortOrder" ? "0" : undefined}
                    className="mt-1 bg-slate-800 border-slate-700 text-white"
                  />
                </label>
              ))}
              <label className="text-xs text-slate-400">
                Customer region
                <Select value={bankAccountForm.region} onValueChange={(value) => setBankAccountForm((current) => ({ ...current, region: value }))}>
                  <SelectTrigger className="mt-1 bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="all">All regions</SelectItem>
                    <SelectItem value="USA">USA</SelectItem>
                    <SelectItem value="EUROPE">Europe</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="text-xs text-slate-400 sm:col-span-2">
                Bank address
                <Textarea value={bankAccountForm.bankAddress} onChange={(event) => setBankAccountForm((current) => ({ ...current, bankAddress: event.target.value }))} rows={2} className="mt-1 bg-slate-800 border-slate-700 text-white" />
              </label>
              <label className="text-xs text-slate-400 sm:col-span-2">
                Customer instructions
                <Textarea value={bankAccountForm.instructions} onChange={(event) => setBankAccountForm((current) => ({ ...current, instructions: event.target.value }))} rows={2} className="mt-1 bg-slate-800 border-slate-700 text-white" />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Switch checked={bankAccountForm.enabled} onCheckedChange={(enabled) => setBankAccountForm((current) => ({ ...current, enabled }))} />
                Enabled for customers
              </div>
              <div className="flex gap-2">
                {editingBankAccountId !== null && <Button type="button" variant="outline" onClick={() => { setBankAccountForm(EMPTY_BANK_ACCOUNT); setEditingBankAccountId(null); }} className="border-slate-700 text-slate-300"><X className="mr-1.5 h-4 w-4" /> Cancel</Button>}
                <Button type="submit" disabled={bankAccountMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {editingBankAccountId === null ? <Plus className="mr-1.5 h-4 w-4" /> : <Save className="mr-1.5 h-4 w-4" />}
                  {bankAccountMutation.isPending ? "Saving..." : editingBankAccountId === null ? "Add account" : "Save account"}
                </Button>
              </div>
            </div>
          </form>
        </section>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
          {/* Customer Support Widget */}
          <section className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-semibold">Customer Support Chat Widget</h2>
              <p className="text-xs text-slate-500 mt-1">Show your Smartsupp chat launcher on the customer banking portal after a customer signs in.</p>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-slate-300 text-sm font-medium">Enable customer chat</p>
                <p className="text-slate-500 text-xs">The widget loads only for signed-in customers.</p>
              </div>
              <Switch checked={watch("supportWidgetEnabled") === true} onCheckedChange={(enabled) => setValue("supportWidgetEnabled", enabled)} />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Smartsupp key</label>
              <Input {...register("smartsuppKey")} autoComplete="off" placeholder="Paste your Smartsupp key" className="bg-slate-800 border-slate-700 text-white" />
              <p className="mt-1 text-xs text-slate-500">Find this key in your Smartsupp installation code. Save settings after entering it.</p>
            </div>
          </section>

          {/* Payment Instructions */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold">Payment Instructions</h2>
            <p className="text-xs text-slate-500">Customers only see enabled methods for this website. The fixed transaction fee is calculated by the server at approval.</p>
            {depositMethods.map((method: any, index: number) => (
              <div key={method.id} className="rounded-lg border border-slate-700/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-200 text-sm font-medium">{method.label}</p>
                    <p className="text-slate-500 text-xs">{method.id}</p>
                  </div>
                  <Switch
                    checked={!!method.enabled}
                    onCheckedChange={(enabled) => setValue(`depositMethods.${index}.enabled`, enabled)}
                  />
                </div>
                <Textarea
                  {...register(`depositMethods.${index}.instructions`)}
                  placeholder={`Payment instructions for ${method.label}`}
                  rows={3}
                  className="bg-slate-800 border-slate-700 text-white resize-none"
                />
              </div>
            ))}
            <input type="hidden" {...register("bankInstructions")} />
            <input type="hidden" {...register("cryptoInstructions")} />
          </div>

          {/* KYC */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold">KYC Requirement</h2>
            <Select value={kycRequirement} onValueChange={(v) => setValue("kycRequirement", v)}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                <SelectItem value="required">Required — customers must complete KYC</SelectItem>
                <SelectItem value="optional">Optional — customers can skip KYC</SelectItem>
                <SelectItem value="disabled">Disabled — KYC is not shown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transfer Types */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold">Transfer Types</h2>
            {[
              { key: "enableNationalTransfer", label: "National Transfer", value: enableNationalTransfer },
              { key: "enableInternationalTransfer", label: "International Transfer", value: enableInternationalTransfer },
              { key: "enableInternalTransfer", label: "Internal Transfer (between accounts)", value: enableInternalTransfer },
              { key: "enableCryptoTransfer", label: "Cryptocurrency Transfer", value: enableCryptoTransfer },
            ].map(({ key, label, value }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">{label}</span>
                <Switch checked={!!value} onCheckedChange={(v) => setValue(key, v)} />
              </div>
            ))}
          </div>

          {/* Fees */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold">Limits & Fees</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 block mb-1">Minimum Deposit</label>
                <Input {...register("minimumDeposit")} type="number" min="0" step="0.01" placeholder="0.00"
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Minimum Withdrawal</label>
                <Input {...register("minimumWithdrawal")} type="number" min="0" step="0.01" placeholder="0.00"
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Withdrawal Fee (%)</label>
                <Input {...register("withdrawalFeePercent")} type="number" min="0" max="100" step="0.01" placeholder="0.00"
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
              <div>
                <label className="text-sm text-slate-400 block mb-1">Transfer Fee (%)</label>
                <Input {...register("transferFeePercent")} type="number" min="0" max="100" step="0.01" placeholder="0.05"
                  className="bg-slate-800 border-slate-700 text-white" />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={mutation.isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 gap-2">
            <Save className="w-4 h-4" /> Save Settings
          </Button>
        </form>
      </div>
    </PortalLayout>
  );
}
