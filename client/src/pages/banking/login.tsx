import { useMemo } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Lock, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useBankingAuth } from "@/lib/banking-auth";
import { bankingLogin } from "@/lib/banking-api";
import { publicInfo } from "@/lib/portal-api";
import { getServiceSignIcon } from "@/lib/template-registry";
import { useToast } from "@/hooks/use-toast";
import { useCustomerLocalization } from "@/lib/customer-localization";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MediaSlideshow from "@/components/MediaSlideshow";
import WebsiteLogo from "@/components/website-logo";

interface Props { params: { websiteUid: string } }
const ServiceIcon = getServiceSignIcon("banking");

export default function BankingLoginPage({ params }: Props) {
  const { websiteUid } = params;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useCustomerLocalization();
  const { login } = useBankingAuth();
  const schema = useMemo(
    () =>
      z.object({
        identifier: z.string().min(1, t("Username or email required")),
        password: z.string().min(1, t("Password required")),
      }),
    [t],
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [suspendedInfo, setSuspendedInfo] = useState<{ reason: string | null } | null>(null);

  // Fetch site public info for branding
  const { data: siteInfo } = useQuery<any>({
    queryKey: ["banking-public-info", websiteUid],
    queryFn: () => publicInfo(websiteUid),
    retry: false,
  });
  const bankName = String(siteInfo?.name ?? "").trim();
  const bankLogo = typeof siteInfo?.logoUrl === "string" ? siteInfo.logoUrl : null;

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setLoading(true);
    setSuspendedInfo(null);
    try {
      const res = await bankingLogin({ websiteUid, ...values });
      const canonicalUid = res.customer?.websiteUid ?? websiteUid;
      login(res.token, { ...res.customer, websiteUid: canonicalUid });
      setLocation(`/banking/${canonicalUid}/dashboard`);
    } catch (err: any) {
      if (err?.data?.code === "ACCOUNT_SUSPENDED") {
        setSuspendedInfo({ reason: err?.data?.rejectionReason ?? null });
      } else {
        toast({ title: t("Login failed"), description: err.message || t("Invalid credentials"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex" style={{ background: "#0a1628" }}>

      {/* ── Left: Slideshow panel (desktop only) ─────────────────────── */}
      <div className="hidden lg:block relative w-[480px] flex-shrink-0 overflow-hidden">
        <MediaSlideshow className="absolute inset-0" overlay />
        {/* Brand overlay */}
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-10 pointer-events-none">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {bankLogo ? (
              <WebsiteLogo src={bankLogo} alt={bankName ? `${bankName} logo` : ""} size={44} className="border border-blue-500/30 bg-blue-600/20" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-blue-500/30 bg-blue-600/20">
                <ServiceIcon className="h-6 w-6 text-blue-400" />
              </div>
            )}
            {bankName && <p className="font-bold text-base" style={{ color: "#fff" }}>{bankName}</p>}
          </div>
          {/* Tagline */}
          <div className="space-y-3">
            <h2 className="text-4xl font-bold leading-tight text-white drop-shadow-lg">
              Banking<br />
              <span className="text-blue-300">Made Simple.</span>
            </h2>
            <p className="text-white/60 text-base leading-relaxed drop-shadow">
              Manage your accounts, transfers, and more from anywhere in the world.
            </p>
          </div>
          {/* Footer */}
          <p className="text-white/30 text-xs">© {new Date().getFullYear()}{bankName ? ` ${bankName}` : ""}. All rights reserved.</p>
        </div>
        {/* Fallback gradient if no media */}
        <div className="absolute inset-0 -z-10" style={{ background: "linear-gradient(160deg, #0d1f42 0%, #071020 100%)" }} />
      </div>

      {/* ── Right: Form panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-8 text-center">
            {bankLogo ? (
              <WebsiteLogo src={bankLogo} alt={bankName ? `${bankName} logo` : ""} size={56} className="border border-blue-500/30 bg-blue-600/20 mb-4" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-blue-500/30 bg-blue-600/20 mb-4">
                <ServiceIcon className="h-7 w-7 text-blue-400" />
              </div>
            )}
            {bankName && <h1 className="text-2xl font-bold" style={{ color: "#fff" }}>{bankName}</h1>}
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-bold text-white">{t("Sign in")}</h1>
            <p className="text-slate-400 text-sm mt-1">{t("Access your banking account")}</p>
          </div>

          {suspendedInfo && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-300 font-semibold text-sm">{t("Account Suspended")}</p>
                {suspendedInfo.reason ? (
                  <p className="text-red-400/80 text-xs mt-1">Reason: {suspendedInfo.reason}</p>
                ) : (
                  <p className="text-slate-400 text-xs mt-1">{t("Please contact customer support for assistance.")}</p>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 shadow-xl">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="identifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{t("Username or Email")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input placeholder={t("Enter your identifier")} className="pl-10 bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{t("Password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-11 bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                        <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("Hide password") : t("Show password")} title={showPassword ? t("Hide password") : t("Show password")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  {loading ? t("Signing in...") : t("Sign In")}
                </Button>
              </form>
            </Form>

            <div className="mt-5 space-y-3 text-center text-sm">
              <Link href={`/banking/${websiteUid}/forgot-password`} className="text-blue-400 hover:text-blue-300 transition-colors">{t("Forgot password?")}</Link>
              <p className="text-slate-500">
                {t("No account?")}{" "}
                <Link href={`/banking/${websiteUid}/register`} className="text-blue-400 hover:text-blue-300">{t("Register here")}</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
