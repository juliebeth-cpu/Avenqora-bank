import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { publicInfo } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock, AlertCircle, Eye, EyeOff, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";

interface Props { params: { websiteUid: string } }

export default function PortalResetPasswordPage({ params }: Props) {
  const { websiteUid } = params;
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const { data: info } = useQuery({
    queryKey: ["portal-info", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });

  const primaryColor = info?.primaryColor ?? "#1a56db";
  const siteName = info?.name ?? "Platform";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !pin || !newPassword || !confirmPassword) {
      setError("All fields are required"); return;
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError("Reset code must be exactly 6 digits"); return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match"); return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters"); return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/website/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUid, email, pin, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Reset failed"); return; }
      setDone(true);
      setTimeout(() => navigate(`/portal/${websiteUid}/login`), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
            style={{ backgroundColor: primaryColor + "20", border: `1px solid ${primaryColor}40` }}>
            <ShieldCheck className="w-8 h-8" style={{ color: primaryColor }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{siteName}</h1>
            <p className="text-slate-400 text-sm uppercase tracking-widest mt-1">Set New Password</p>
          </div>
        </div>

        {done ? (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Password Updated!</h2>
              <p className="text-slate-400 text-sm mt-1">Redirecting you to the login page…</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Email Address</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} type="email"
                  placeholder="your@email.com"
                  className="bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500" />
              </div>

              {/* Reset PIN */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">6-Digit Reset Code</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" maxLength={6}
                    className="pl-9 bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 tracking-[0.25em] font-mono text-lg" />
                </div>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input type={showNew ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-9 pr-10 bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500" />
                  <button type="button" onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="pl-9 pr-10 bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500" />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" tabIndex={-1}>
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full h-11 font-semibold text-white shadow-lg"
                style={{ backgroundColor: primaryColor }}>
                {loading ? "Updating…" : "Reset Password"}
              </Button>
            </form>

            <div className="text-center">
              <Link href={`/portal/${websiteUid}/forgot-password`}>
                <a className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />Get a new reset code
                </a>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
