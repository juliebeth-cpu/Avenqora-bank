import { useMemo } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { getServiceSignIcon } from "@/lib/template-registry";
import { bankingRegister } from "@/lib/banking-api";
import { publicInfo } from "@/lib/portal-api";
import { useToast } from "@/hooks/use-toast";
import { useCustomerLocalization } from "@/lib/customer-localization";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import HumanVerification from "@/components/ui/human-verification";
import RegistrationFields from "@/components/customer/RegistrationFields";

interface Props { params: { websiteUid: string } }
const ServiceIcon = getServiceSignIcon("banking");

export default function BankingRegisterPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const { t } = useCustomerLocalization();
  const schema = useMemo(
    () =>
      z.object({
        username: z.string().min(3, t("Min 3 characters")),
        email: z.string().email(t("Valid email required")),
        password: z.string().min(6, t("Min 6 characters")),
        confirmPassword: z.string(),
        firstName: z.string().min(1, "Required"),
        lastName: z.string().min(1, "Required"),
        termsAccepted: z.boolean().refine(Boolean, t("You must agree to the Terms & Conditions")),
        accountType: z.enum(["checking", "savings"], { required_error: t("Account type is required") }),
        bankingRegion: z.enum(["USA", "EUROPE"], { required_error: t("Account region is required") }),
        phone: z.string().optional(),
        dateOfBirth: z.string().min(1, "Date of birth is required"),
        homeAddress: z.string().min(1, "Home address is required"),
        documentType: z.enum(["passport", "national_id", "drivers_license", "utility_bill", "other"], { required_error: "Identity document is required" }),
        documentNumber: z.string().min(1, "Document number is required"),
        country: z.string().min(2, "Country is required"),
        transactionPin: z.string().regex(/^\d{4,6}$/, "Transaction PIN must be 4 to 6 digits"),
        confirmTransactionPin: z.string(),
      }).refine((d) => d.password === d.confirmPassword, { message: t("Passwords don't match"), path: ["confirmPassword"] })
        .refine((d) => d.transactionPin === d.confirmTransactionPin, { message: t("Transaction PINs don't match"), path: ["confirmTransactionPin"] }),
    [t],
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [humanVerified, setHumanVerified] = useState(false);
  const { data: site } = useQuery({ queryKey: ["public-info", websiteUid], queryFn: () => publicInfo(websiteUid) });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "", firstName: "", lastName: "", phone: "", dateOfBirth: "", homeAddress: "", documentType: undefined, documentNumber: "", country: "", transactionPin: "", confirmTransactionPin: "", termsAccepted: false, accountType: undefined, bankingRegion: undefined },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setLoading(true);
    try {
      const { confirmPassword, ...rest } = values;
      await bankingRegister({ websiteUid, ...rest });
      setDone(true);
    } catch (err: any) {
      toast({ title: t("Registration failed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="min-h-[100dvh] bg-[#0a1628] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-green-600/20 border border-green-500/30 rounded-2xl flex items-center justify-center mb-4 mx-auto">
          <ServiceIcon className="w-7 h-7 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{t("Account Created!")}</h2>
        <p className="text-slate-400 text-sm mb-6">{t("Check your email to verify your account. Your account is not active yet, so please try signing in again later.")}</p>
        <Link href={`/banking/${websiteUid}/login`} className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">{t("Back to Login")}</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#0a1628] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-4">
            <ServiceIcon className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t("Create Account")}</h1>
          <p className="text-slate-400 text-sm mt-1">{t("Open your banking account")}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">{t("First Name")}</FormLabel><FormControl>
                    <Input placeholder="John" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel className="text-slate-300">{t("Last Name")}</FormLabel><FormControl>
                    <Input placeholder="Doe" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <RegistrationFields control={form.control} config={site?.registrationConfig} paymentSite />
              <FormField control={form.control} name="bankingRegion" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">{t("Account Region")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-3" role="group" aria-label={t("Account Region")}>
                      {[
                        { value: "USA" as const, label: "United States", currency: "US dollars · USD" },
                        { value: "EUROPE" as const, label: "Europe", currency: "Euros · EUR" },
                      ].map((option) => {
                        const selected = field.value === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => field.onChange(option.value)}
                            className={`min-h-[82px] rounded-xl border px-3 py-3 text-left transition-colors ${
                              selected
                                ? "border-blue-400 bg-blue-950/50 ring-1 ring-blue-400/40"
                                : "border-slate-700 bg-slate-900/50 hover:border-slate-500"
                            }`}
                            data-testid={`button-account-region-${option.value.toLowerCase()}`}
                          >
                            <span className="block text-sm font-semibold text-white">{option.label}</span>
                            <span className="mt-1 block text-xs text-slate-400">{option.currency}</span>
                          </button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                  {field.value && (
                    <p className="text-xs text-slate-400" data-testid="text-selected-account-currency">
                      Your first account will use {field.value === "EUROPE" ? "euros (EUR)" : "US dollars (USD)"} when it is opened.
                    </p>
                  )}
                </FormItem>
              )} />
              <FormField control={form.control} name="username" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-300">{t("Username")}</FormLabel><FormControl>
                  <Input placeholder="johndoe" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-300">{t("Email Address")}</FormLabel><FormControl>
                  <Input type="email" placeholder="john@example.com" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                </FormControl><FormMessage /></FormItem>
              )} />
               <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="phone" render={({ field }) => (
                   <FormItem><FormLabel className="text-slate-300">Phone *</FormLabel><FormControl>
                    <Input placeholder="+1 555 0000" className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="password" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-300">{t("Password")}</FormLabel><FormControl>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pr-11 bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("Hide password") : t("Show password")} title={showPassword ? t("Hide password") : t("Show password")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                <FormItem><FormLabel className="text-slate-300">{t("Confirm Password")}</FormLabel><FormControl>
                  <div className="relative">
                    <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" className="pr-11 bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                    <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? t("Hide password") : t("Show password")} title={showConfirmPassword ? t("Hide password") : t("Show password")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FormControl><FormMessage /></FormItem>
              )} />
              <RegistrationFields control={form.control} config={{ requirePin: true, websiteUid }} />
              <HumanVerification onVerified={setHumanVerified} accentColor="#2563eb" />
              <Button type="submit" disabled={loading || !humanVerified} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold mt-2 disabled:opacity-50">
                {loading ? t("Creating Account...") : t("Create Account")}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-slate-500">
            {t("Already have an account?")}{" "}
            <Link href={`/banking/${websiteUid}/login`} className="text-blue-400 hover:text-blue-300">{t("Sign in")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
