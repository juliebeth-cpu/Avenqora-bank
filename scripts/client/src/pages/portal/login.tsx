import { useState } from "react";
import { useLocation, Link } from "wouter";
import { usePortalAuth } from "@/lib/portal-auth";
import { portalLogin, portalComplete2FA, publicInfo } from "@/lib/portal-api";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock, User, AlertCircle, Calendar, Smartphone } from "lucide-react";

interface Props { params: { websiteUid: string } }

export default function PortalLoginPage({ params }: Props) {
  const { websiteUid } = params;
  const [, navigate] = useLocation();
  const { login } = usePortalAuth();

  // Step 1 — password
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  // Step 2 — 2FA
  const [requires2FA, setRequires2FA] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [twoFAError, setTwoFAError] = useState("");
  const [twoFALoading, setTwoFALoading] = useState(false);

  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ["portal-info", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });

  const primaryColor = info?.primaryColor ?? "#1a56db";
  const siteName = info?.name ?? "Platform";

  // ── Step 1: password submit ─────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setExpired(false);
    if (!identifier || !password) { setError("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const result = await portalLogin(websiteUid, identifier, password) as any;
      if (result.requiresTwoFactor) {
        setPreAuthToken(result.preAuthToken);
        setRequires2FA(true);
      } else {
        login(result.token, result.admin);
        const slug = result.admin.subdomain ?? result.admin.websiteUid;
        navigate(`/portal/${slug}/dashboard`);
      }
    } catch (err: any) {
      if (err.code === "SUBSCRIPTION_EXPIRED" || err.status === 402) {
        setExpired(true);
      } else {
        setError(err.message ?? "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: 2FA submit ──────────────────────────────────────────────────────

  const handle2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFAError("");
    if (totpCode.length !== 6) { setTwoFAError("Please enter the 6-digit code"); return; }
    setTwoFALoading(true);
    try {
      const result = await portalComplete2FA(preAuthToken, totpCode);
      login(result.token, result.admin);
      const slug = result.admin.subdomain ?? result.admin.websiteUid;
      navigate(`/portal/${slug}/dashboard`);
    } catch (err: any) {
      setTwoFAError(err.message ?? "Invalid code");
    } finally {
      setTwoFALoading(false);
    }
  };

  // ── Loading / Expired states ─────────────────────────────────────────────────

  if (infoLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
            <Calendar className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{siteName}</h1>
            <h2 className="text-red-400 font-semibold text-lg mt-2">Subscription Expired</h2>
            <p className="text-slate-400 text-sm mt-3">Your platform subscription has expired. Access to this portal has been temporarily disabled.</p>
            <p className="text-slate-400 text-sm mt-2">To reactivate your platform, please renew your subscription by contacting support.</p>
          </div>
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl text-left space-y-2">
            <p className="text-red-300 font-medium text-sm">What happens to your data?</p>
            <p className="text-slate-400 text-xs">All your data is safely preserved and will be fully restored once your subscription is renewed. No data has been lost.</p>
          </div>
          <Button onClick={() => setExpired(false)} variant="outline" className="border-slate-600 text-slate-300">← Back to Login</Button>
        </div>
      </div>
    );
  }

  // ── 2FA challenge step ───────────────────────────────────────────────────────

  if (requires2FA) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6">
        <div className="max-w-sm w-full space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg"
              style={{ backgroundColor: primaryColor + "20", border: `1px solid ${primaryColor}40` }}>
              <Smartphone className="w-8 h-8" style={{ color: primaryColor }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{siteName}</h1>
              <p className="text-slate-400 text-sm uppercase tracking-widest mt-1">Two-Factor Verification</p>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
            <p className="text-slate-400 text-sm text-center">
              Open your authenticator app and enter the 6-digit code for this account.
            </p>
            <form onSubmit={handle2FA} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Authentication Code</Label>
                <Input
                  value={totpCode}
                  onChange={e => { setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setTwoFAError(""); }}
                  placeholder="000000"
                  maxLength={6}
                  className="bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 text-center text-2xl tracking-[0.3em] font-mono h-14"
                  autoFocus
                />
              </div>

              {twoFAError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{twoFAError}</p>
                </div>
              )}

              <Button type="submit" disabled={twoFALoading || totpCode.length !== 6}
                className="w-full h-11 font-semibold text-white shadow-lg" style={{ backgroundColor: primaryColor }}>
                {twoFALoading ? "Verifying…" : "Verify & Sign In"}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => { setRequires2FA(false); setPreAuthToken(""); setTotpCode(""); setTwoFAError(""); }}
              className="w-full text-center text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Password step ────────────────────────────────────────────────────────────

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
            <p className="text-slate-400 text-sm uppercase tracking-widest mt-1">Admin Control Portal</p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Username or Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter your identifier"
                  className="pl-9 bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300 text-sm">Password</Label>
                <Link href={`/portal/${websiteUid}/forgot-password`} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500" />
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
              {loading ? "Signing in…" : "Sign In to Portal"}
            </Button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs">
          {info?.type && <span className="capitalize">{info.type} Platform</span>}
          {info?.status && info.status !== "active" && <span className="text-red-400 ml-2">· {info.status}</span>}
        </p>
      </div>
    </div>
  );
}
