import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Mail } from "lucide-react";
import { bankingForgotPassword } from "@/lib/banking-api";
import { getServiceSignIcon } from "@/lib/template-registry";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const schema = z.object({ email: z.string().email("Valid email required") });

interface Props { params: { websiteUid: string } }
const ServiceIcon = getServiceSignIcon("banking");

export default function BankingForgotPasswordPage({ params }: Props) {
  const { websiteUid } = params;
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: z.infer<typeof schema>) => {
    setLoading(true);
    try {
      await bankingForgotPassword(websiteUid, values.email);
      setSent(true);
    } catch {
      setSent(true); // Always show success to avoid email enumeration
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a1628] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mb-4">
            <ServiceIcon className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-slate-400 text-sm mt-1">Enter your email to receive a reset link</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-8 shadow-xl">
          {sent ? (
            <div className="text-center">
              <Mail className="w-10 h-10 text-blue-400 mx-auto mb-3" />
              <p className="text-white font-medium mb-1">Check your email</p>
              <p className="text-slate-400 text-sm mb-5">If an account exists with that email, a reset link has been sent.</p>
              <Link href={`/banking/${websiteUid}/login`} className="text-blue-400 hover:text-blue-300 text-sm">Back to login</Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com"
                        className="bg-slate-900/60 border-slate-700 text-white h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" disabled={loading} className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <p className="text-center text-sm text-slate-500">
                  <Link href={`/banking/${websiteUid}/login`} className="text-blue-400 hover:text-blue-300">Back to login</Link>
                </p>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
