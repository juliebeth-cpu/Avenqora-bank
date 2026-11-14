import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle, XCircle } from "lucide-react";
import { bankingVerifyEmail } from "@/lib/banking-api";
import { getServiceSignIcon } from "@/lib/template-registry";
import { Link } from "wouter";

interface Props { params: { websiteUid: string } }
const ServiceIcon = getServiceSignIcon("banking");

export default function BankingVerifyEmailPage({ params }: Props) {
  const { websiteUid } = params;
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("Missing verification token."); return; }
    bankingVerifyEmail(token)
      .then(() => setStatus("success"))
      .catch((e) => { setStatus("error"); setMessage(e.message); });
  }, [token]);

  return (
    <div className="min-h-[100dvh] bg-[#0a1628] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <ServiceIcon className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-slate-300">Verifying your email...</p>
          </>
        )}
        {status === "success" && (
          <>
            <div className="w-14 h-14 bg-green-600/20 border border-green-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Email Verified!</h2>
            <p className="text-slate-400 text-sm mb-6">Your email has been verified. Your account is not active yet, so please try signing in again later.</p>
            <Link href={`/banking/${websiteUid}/login`} className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Go to Login</Link>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 bg-red-600/20 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-slate-400 text-sm mb-6">{message || "Invalid or expired verification link."}</p>
            <Link href={`/banking/${websiteUid}/login`} className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Back to Login</Link>
          </>
        )}
      </div>
    </div>
  );
}
