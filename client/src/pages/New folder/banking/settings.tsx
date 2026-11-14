import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBankingAuth } from "@/lib/banking-auth";
import CustomerBankingLayout from "@/components/layout/customer-banking-layout";
import { bankingChangePassword, bankingSetTransactionPin } from "@/lib/banking-api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Shield, Moon, Sun, Globe, Bell, Lock, Save, Eye, EyeOff } from "lucide-react";
import { CUSTOMER_LOCALES } from "@/lib/localization-registry";
import { useCustomerLocalization } from "@/lib/customer-localization";
import { useWebsiteTheme } from "@/lib/website-theme";

interface Props { params: { websiteUid: string } }

const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  { code: "GHS", symbol: "₵", name: "Ghanaian Cedi" },
  { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
];

export default function BankingSettingsPage({ params }: Props) {
  const { websiteUid } = params;
  const { customer } = useBankingAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Persisted in localStorage
  const [currency, setCurrency] = useState(() => localStorage.getItem("banking_currency") ?? "USD");
  const { locale, config, setLanguage, t } = useCustomerLocalization();
  const { mode, setMode } = useWebsiteTheme();
  const darkMode = mode === "dark";
  const [emailNotifs, setEmailNotifs] = useState(() => localStorage.getItem("banking_email_notifs") !== "false");
  const [pushNotifs, setPushNotifs] = useState(() => localStorage.getItem("banking_push_notifs") !== "false");

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pinCurrentPw, setPinCurrentPw] = useState("");
  const [transactionPin, setTransactionPin] = useState("");
  const [confirmTransactionPin, setConfirmTransactionPin] = useState("");

  const handleCurrencyChange = (v: string) => {
    setCurrency(v);
    localStorage.setItem("banking_currency", v);
    toast({ title: "Currency updated", description: `Display currency set to ${v}` });
  };

  const handleLanguageChange = async (v: string) => {
    try {
      await setLanguage(v as typeof locale);
      toast({ title: t("Language updated") });
    } catch (error: any) {
      toast({ title: "Language update failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDarkModeToggle = (v: boolean) => {
    setMode(v ? "dark" : "light");
    toast({ title: v ? "Dark mode enabled" : "Light mode enabled" });
  };

  const handleEmailNotifsToggle = (v: boolean) => {
    setEmailNotifs(v);
    localStorage.setItem("banking_email_notifs", String(v));
  };

  const handlePushNotifsToggle = (v: boolean) => {
    setPushNotifs(v);
    localStorage.setItem("banking_push_notifs", String(v));
  };

  const pwMutation = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) => bankingChangePassword(current, next),
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPw.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    pwMutation.mutate({ current: currentPw, next: newPw });
  };

  const pinMutation = useMutation({
    mutationFn: () => bankingSetTransactionPin(pinCurrentPw, transactionPin, confirmTransactionPin),
    onSuccess: () => {
      toast({ title: "Transaction PIN updated" });
      setPinCurrentPw(""); setTransactionPin(""); setConfirmTransactionPin("");
    },
    onError: (e: any) => toast({ title: "PIN update failed", description: e.message, variant: "destructive" }),
  });

  const handlePinChange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4,6}$/.test(transactionPin)) {
      toast({ title: "PIN must be 4 to 6 digits", variant: "destructive" }); return;
    }
    if (transactionPin !== confirmTransactionPin) {
      toast({ title: "Transaction PINs don't match", variant: "destructive" }); return;
    }
    pinMutation.mutate();
  };

  return (
    <CustomerBankingLayout websiteUid={websiteUid}>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-400" /> Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your account preferences</p>
        </div>

        {/* Appearance */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            {darkMode ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
            Appearance
          </h2>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-slate-300 text-sm font-medium">Dark Mode</p>
              <p className="text-slate-500 text-xs mt-0.5">Toggle between dark and light interface</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={handleDarkModeToggle} />
          </div>
        </div>

        {/* Currency & Language */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
             <Globe className="w-4 h-4 text-blue-400" /> {t("Display Preferences")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs block mb-2">Default Currency</label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="bg-slate-900/80 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
               <label className="text-slate-400 text-xs block mb-2">{t("Language")}</label>
               <Select value={locale} onValueChange={handleLanguageChange} disabled={!config.allowCustomerOverride}>
                <SelectTrigger className="bg-slate-900/80 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                   {CUSTOMER_LOCALES.filter((l) => config.supportedLocales.includes(l.code)).map((l) => (
                     <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-400" /> Notifications
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-slate-700/40">
              <div>
                <p className="text-slate-300 text-sm font-medium">Email Notifications</p>
                <p className="text-slate-500 text-xs mt-0.5">Receive email alerts for transactions</p>
              </div>
              <Switch checked={emailNotifs} onCheckedChange={handleEmailNotifsToggle} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-slate-300 text-sm font-medium">Push Notifications</p>
                <p className="text-slate-500 text-xs mt-0.5">In-app notification alerts</p>
              </div>
              <Switch checked={pushNotifs} onCheckedChange={handlePushNotifsToggle} />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" /> Security
          </h2>
          <form onSubmit={handlePasswordChange} className="space-y-3">
            <p className="text-slate-400 text-sm flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Change Password
            </p>
            <div className="relative">
              <Input
                type={showCurrentPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Current password"
                className="bg-slate-900/80 border-slate-600 text-white pr-10"
                required
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="relative">
              <Input
                type={showNewPw ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="New password (min. 6 characters)"
                className="bg-slate-900/80 border-slate-600 text-white pr-10"
                required
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Confirm new password"
              className="bg-slate-900/80 border-slate-600 text-white"
              required
            />
            <Button type="submit" disabled={pwMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Save className="w-4 h-4" />
              {pwMutation.isPending ? "Updating..." : "Update Password"}
            </Button>
          </form>

          <form onSubmit={handlePinChange} className="space-y-3 pt-4 border-t border-slate-700/40">
            <p className="text-slate-400 text-sm flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Set or change transaction PIN</p>
            <p className="text-slate-500 text-xs">This PIN authorizes transfers. It is checked on the server and never appears in receipts or transaction records.</p>
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pinCurrentPw} onChange={(event) => setPinCurrentPw(event.target.value)} placeholder="Current account password" className="bg-slate-900/80 border-slate-600 text-white" required />
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={transactionPin} onChange={(event) => setTransactionPin(event.target.value.replace(/\D/g, ""))} placeholder="New transaction PIN (4 to 6 digits)" className="bg-slate-900/80 border-slate-600 text-white" required />
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={confirmTransactionPin} onChange={(event) => setConfirmTransactionPin(event.target.value.replace(/\D/g, ""))} placeholder="Confirm transaction PIN" className="bg-slate-900/80 border-slate-600 text-white" required />
            <Button type="submit" disabled={pinMutation.isPending} className="bg-slate-700 hover:bg-slate-600 text-white gap-2"><Shield className="w-4 h-4" />{pinMutation.isPending ? "Updating..." : "Save Transaction PIN"}</Button>
          </form>

          {/* Account info */}
          <div className="mt-4 pt-4 border-t border-slate-700/40">
            <p className="text-slate-400 text-xs font-medium mb-2">Account Information</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-300">{customer?.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Username</span>
                <span className="text-slate-300">{customer?.username}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">KYC Status</span>
                <span className={customer?.kycStatus === "approved" ? "text-green-400" : "text-yellow-400"}>
                  {customer?.kycStatus ?? "Not submitted"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CustomerBankingLayout>
  );
}
