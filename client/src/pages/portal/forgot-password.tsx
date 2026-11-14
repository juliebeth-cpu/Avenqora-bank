import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { publicInfo } from "@/lib/portal-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Mail, AlertCircle, ArrowLeft, Copy, CheckCircle2 } from "lucide-react";

interface Props { params: { websiteUid: string } }

export default function PortalForgotPasswordPage({ params }: Props) {
  const { websiteUid } = params;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ resetPin: string; expiresIn: string } | null>(null);
  const [copied, setCopied] = useState(false);

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
    if (!email) { setError("Please enter your email address"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/website/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUid, email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Request failed"); return; }
      setResult({ resetPin: data.resetPin, expiresIn: data.expiresIn });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyPin = () => {
    if (!result?.resetPin) return;
    navigator.clipboard.writeText(result.resetPin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
            <p className="text-slate-400 text-sm uppercase tracking-widest mt-1">Password Reset</p>
          </div>
        </div>

        {!result ? (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
            <p className="text-slate-400 text-sm">
              Enter the email address linked to your admin account and we'll generate a reset code.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pl-9 bg-slate-900/60 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500"
                  />
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
                {loading ? "Generating code…" : "Send Reset Code"}
              </Button>
            </form>
            <div className="text-center">
              <Link href={`/portal/${websiteUid}/login`}>
                <a className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" />Back to login
                </a>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <p className="text-emerald-400 text-sm font-medium">Reset code generated successfully</p>
            </div>

            <div className="space-y-3">
              <p className="text-slate-400 text-sm">Your 6-digit reset code:</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-900/60 border border-slate-600 rounded-xl px-5 py-3 text-center">
                  <span className="text-3xl font-mono font-bold text-white tracking-[0.3em]">{result.resetPin}</span>
                </div>
                <Button variant="outline" size="icon" onClick={copyPin}
                  className="h-12 w-12 border-slate-600 text-slate-400 hover:text-white hover:border-slate-400">
                  {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-slate-500 text-xs">Expires in: {result.expiresIn}</p>
            </div>

            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
              <p className="text-amber-400 text-xs leading-relaxed">
                <strong>Note:</strong> In a production environment this code would be sent to your email. Keep it confidential.
              </p>
            </div>

            <Link href={`/portal/${websiteUid}/reset-password`}>
              <a>
                <Button className="w-full h-11 font-semibold text-white" style={{ backgroundColor: primaryColor }}>
                  Continue to Reset Password →
                </Button>
              </a>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
