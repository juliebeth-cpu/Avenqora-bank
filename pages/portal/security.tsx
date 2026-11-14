import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import QRCode from "qrcode";
import PortalLayout from "@/components/layout/portal-layout";
import {
  portalChangePassword,
  portal2FAStatus,
  portal2FASetup,
  portal2FAVerify,
  portal2FADisable,
} from "@/lib/portal-api";
import { usePortalAuth } from "@/lib/portal-auth";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Lock, Shield, CheckCircle, Loader2, Bell, Smartphone, Eye, EyeOff,
  QrCode, KeyRound, ShieldCheck, ShieldOff, Copy, Check,
} from "lucide-react";

// ── Change Password schema ────────────────────────────────────────────────────

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword:     z.string().min(6, "Minimum 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// ── 2FA Setup Dialog ─────────────────────────────────────────────────────────

function TwoFASetupDialog({
  open,
  onClose,
  onEnabled,
}: { open: boolean; onClose: () => void; onEnabled: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"qr" | "verify">("qr");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const setupMutation = useMutation({
    mutationFn: portal2FASetup,
    onSuccess: async (data) => {
      setSecret(data.secret);
      setUri(data.uri);
      try {
        const dataUrl = await QRCode.toDataURL(data.uri, { width: 200, margin: 2, color: { dark: "#ffffff", light: "#0d1b2e" } });
        setQrDataUrl(dataUrl);
      } catch {
        setQrDataUrl("");
      }
    },
    onError: (e: any) => toast({ title: "Setup failed", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (c: string) => portal2FAVerify(c),
    onSuccess: () => {
      toast({ title: "2FA enabled", description: "Two-factor authentication is now active on your account." });
      onEnabled();
      onClose();
    },
    onError: (e: any) => setVerifyError(e.message ?? "Invalid code"),
  });

  useEffect(() => {
    if (open && !secret) setupMutation.mutate();
  }, [open]);

  const copySecret = () => {
    navigator.clipboard.writeText(secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleClose = () => {
    setStep("qr"); setCode(""); setVerifyError(""); setSecret(""); setUri(""); setQrDataUrl("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md border-white/10 bg-[#0d1b2e] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="w-5 h-5 text-blue-400" />Set Up Two-Factor Authentication
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Add an extra layer of security to your admin account.
          </DialogDescription>
        </DialogHeader>

        {setupMutation.isPending ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : step === "qr" ? (
          <div className="space-y-5 mt-2">
            <p className="text-slate-300 text-sm">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
            </p>

            {qrDataUrl ? (
              <div className="flex justify-center">
                <div className="p-3 bg-[#0d1b2e] border border-slate-700 rounded-xl">
                  <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded-lg" />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-800/60 rounded-xl text-center text-sm text-slate-400">
                QR code unavailable — use manual entry below.
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-slate-400 text-xs">Or enter this key manually:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white break-all">
                  {secret}
                </code>
                <Button variant="outline" size="icon" onClick={copySecret}
                  className="flex-shrink-0 h-9 w-9 border-slate-600 text-slate-400 hover:text-white">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={handleClose} className="text-slate-400">Cancel</Button>
              <Button onClick={() => setStep("verify")} className="bg-blue-600 hover:bg-blue-700 text-white">
                I've scanned it →
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <p className="text-slate-300 text-sm">
              Enter the 6-digit code from your authenticator app to confirm setup.
            </p>
            <div className="space-y-1.5">
              <label className="text-slate-300 text-sm">Verification Code</label>
              <Input
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setVerifyError(""); }}
                placeholder="000000"
                maxLength={6}
                className="bg-slate-900/60 border-slate-700 text-white text-center text-2xl tracking-[0.3em] font-mono h-14"
              />
              {verifyError && <p className="text-red-400 text-xs">{verifyError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStep("qr")} className="text-slate-400">← Back</Button>
              <Button
                onClick={() => verifyMutation.mutate(code)}
                disabled={code.length !== 6 || verifyMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {verifyMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</> : "Enable 2FA"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── 2FA Disable Dialog ────────────────────────────────────────────────────────

function TwoFADisableDialog({
  open,
  onClose,
  onDisabled,
}: { open: boolean; onClose: () => void; onDisabled: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => portal2FADisable(password, code),
    onSuccess: () => {
      toast({ title: "2FA disabled", description: "Two-factor authentication has been removed from your account." });
      onDisabled();
      onClose();
    },
    onError: (e: any) => setError(e.message ?? "Failed to disable 2FA"),
  });

  const handleClose = () => { setPassword(""); setCode(""); setError(""); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md border-white/10 bg-[#0d1b2e] text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ShieldOff className="w-5 h-5 text-red-400" />Disable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Enter your password and current authenticator code to disable 2FA.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-slate-300 text-sm">Current Password</label>
            <div className="relative">
              <Input type={showPwd ? "text" : "password"} value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                className="bg-slate-900/60 border-slate-700 text-white pr-10" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-300 text-sm">Authenticator Code</label>
            <Input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              placeholder="000000" maxLength={6}
              className="bg-slate-900/60 border-slate-700 text-white text-center text-xl tracking-[0.2em] font-mono h-12" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={handleClose} className="text-slate-400">Cancel</Button>
            <Button onClick={() => mutation.mutate()}
              disabled={!password || code.length !== 6 || mutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white">
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Disabling…</> : "Disable 2FA"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const tips = [
  {
    icon: Bell,
    title: "Login Alerts",
    desc: "You will receive a notification for any new login to your administrator account.",
  },
  {
    icon: Shield,
    title: "Session Security",
    desc: "Always log out when you are done, especially on shared or public devices.",
  },
];

export default function AdminSecurityPage() {
  const { admin } = usePortalAuth();
  const { toast } = useToast();
  const [done, setDone] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [setup2FAOpen, setSetup2FAOpen] = useState(false);
  const [disable2FAOpen, setDisable2FAOpen] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const { data: tfaStatus, refetch: refetchTfa } = useQuery({
    queryKey: ["portal-2fa-status"],
    queryFn: portal2FAStatus,
    enabled: !!admin,
  });

  const totpEnabled = tfaStatus?.totpEnabled ?? false;

  const mutation = useMutation({
    mutationFn: (vals: z.infer<typeof schema>) =>
      portalChangePassword({ currentPassword: vals.currentPassword, newPassword: vals.newPassword }),
    onSuccess: () => {
      toast({ title: "Password updated", description: "Your administrator password has been changed." });
      form.reset();
      setDone(true);
      setTimeout(() => setDone(false), 5000);
    },
    onError: (e: any) =>
      toast({ title: "Failed to update password", description: e.message, variant: "destructive" }),
  });

  return (
    <PortalLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Security Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your administrator account security</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left: forms ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Change password */}
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800/40">
              <div className="px-6 py-5 border-b border-slate-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600/20 border border-blue-500/30">
                  <Lock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Change Password</h3>
                  <p className="text-slate-500 text-xs">Update your administrator login password</p>
                </div>
              </div>
              <div className="p-6">
                {done && (
                  <div className="mb-5 flex items-center gap-3 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <p className="text-emerald-400 text-sm font-medium">Password updated successfully!</p>
                  </div>
                )}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
                    <FormField control={form.control} name="currentPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Current Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showCurrent ? "text" : "password"} placeholder="Enter your current password"
                              className="bg-slate-900/60 border-slate-700 text-white h-11 pr-10" {...field} />
                            <button type="button" onClick={() => setShowCurrent(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showNew ? "text" : "password"} placeholder="At least 6 characters"
                              className="bg-slate-900/60 border-slate-700 text-white h-11 pr-10" {...field} />
                            <button type="button" onClick={() => setShowNew(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">Confirm New Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input type={showConfirm ? "text" : "password"} placeholder="Repeat new password"
                              className="bg-slate-900/60 border-slate-700 text-white h-11 pr-10" {...field} />
                            <button type="button" onClick={() => setShowConfirm(v => !v)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" disabled={mutation.isPending}
                      className="h-11 px-6 text-white font-semibold bg-blue-600 hover:bg-blue-700">
                      {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Updating…</> : "Update Password"}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>

            {/* Two-Factor Authentication */}
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800/40">
              <div className="px-6 py-5 border-b border-slate-700/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-600/20 border border-purple-500/30">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Two-Factor Authentication</h3>
                  <p className="text-slate-500 text-xs">Use an authenticator app for extra security</p>
                </div>
                <div className="ml-auto">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    totpEnabled
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-slate-700/60 text-slate-400 border-slate-600"
                  }`}>
                    {totpEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {totpEnabled ? (
                  <>
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-emerald-400 text-sm font-semibold">2FA is active</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          Your account requires an authenticator code at every login.
                        </p>
                      </div>
                    </div>
                    <Button onClick={() => setDisable2FAOpen(true)} variant="outline"
                      className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60">
                      <ShieldOff className="w-4 h-4 mr-2" />Disable 2FA
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 text-sm">
                      Protect your account with a time-based one-time password (TOTP). Works with Google Authenticator, Authy, and compatible apps.
                    </p>
                    <Button onClick={() => setSetup2FAOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white">
                      <QrCode className="w-4 h-4 mr-2" />Set Up 2FA
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Security tips */}
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800/40">
              <div className="px-6 py-5 border-b border-slate-700/60">
                <h3 className="text-white font-semibold">Security Best Practices</h3>
                <p className="text-slate-500 text-xs mt-0.5">Keep your administrator account safe</p>
              </div>
              <div className="p-6 space-y-4">
                {tips.map((t) => (
                  <div key={t.title} className="flex items-start gap-4 p-4 rounded-xl border border-slate-700/40 bg-slate-900/30">
                    <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-blue-600/10 border border-blue-500/20">
                      <t.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold mb-0.5">{t.title}</p>
                      <p className="text-slate-400 text-xs leading-relaxed">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: account info ── */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-700/60 overflow-hidden bg-slate-800/40">
              <div className="px-5 py-4 border-b border-slate-700/60">
                <h3 className="text-white font-semibold">Account Info</h3>
              </div>
              <div className="p-5 space-y-4">
                {[
                  { label: "Username",  value: admin?.username  ?? "—" },
                  { label: "Email",     value: admin?.email     ?? "—" },
                  { label: "Role",      value: admin?.role      ?? "admin" },
                  { label: "Platform",  value: admin?.websiteType ? `${admin.websiteType} platform` : "—" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-slate-500 text-xs mb-0.5">{item.label}</p>
                    <p className="text-white text-sm font-medium capitalize truncate">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 p-5 bg-amber-500/5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <p className="text-sm font-semibold text-amber-400">Security Notice</p>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                Never share your password with anyone, including platform support.
                Use a strong, unique password and change it regularly.
              </p>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        <TwoFASetupDialog
          open={setup2FAOpen}
          onClose={() => setSetup2FAOpen(false)}
          onEnabled={() => { refetchTfa(); setSetup2FAOpen(false); }}
        />
        <TwoFADisableDialog
          open={disable2FAOpen}
          onClose={() => setDisable2FAOpen(false)}
          onDisabled={() => { refetchTfa(); setDisable2FAOpen(false); }}
        />
      </div>
    </PortalLayout>
  );
}
