import { useEffect, useRef, useState } from "react";
import { WEBSITE_CONFIG } from "../config";
import { BankingCustomerPanel } from "./BankingActions";
import BankingDepositFlow from "./BankingDepositFlow";
function formatCurrencySymbolFirst(value: unknown, currencyValue: unknown, fractionDigits = 2): string {
  const amount = Number(value);
  const currency = String(currencyValue ?? "USD").trim().toUpperCase();
  if (!Number.isFinite(amount)) return "Not provided";
  try {
    const parts = new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).formatToParts(amount);
    const symbol = parts.find(part => part.type === "currency")?.value ?? currency;
    const number = parts.filter(part => part.type !== "currency" && part.type !== "literal").map(part => part.value).join("");
    return symbol + " " + number;
  } catch { return currency + " " + amount.toFixed(fractionDigits); }
}


interface Props { onBack: () => void; }

export default function CustomerPortal({ onBack }: Props) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset" | "dashboard">(new URLSearchParams(window.location.search).get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
   const [resetToken, setResetToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
   const [country, setCountry] = useState("");
   const [transactionPin, setTransactionPin] = useState("");
   const [currentTransactionPin, setCurrentTransactionPin] = useState("");
   const [nextTransactionPin, setNextTransactionPin] = useState("");
   const [pinStatus, setPinStatus] = useState("");
   const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const customerSessionVersion = useRef(0);
     const [workflowData, setWorkflowData] = useState<any>({ accounts: [], transactions: [], records: [], plans: [], investments: [], positions: [], orders: [], properties: [], payments: [] });
   const [referralData, setReferralData] = useState<any>(null);
   const [kycSubmissions, setKycSubmissions] = useState<any[]>([]);
   const [kycForm, setKycForm] = useState<any>({ documentType: WEBSITE_CONFIG.kyc?.supportedIdTypes?.[0] ?? "passport", fullName: "", documentNumber: "", dateOfBirth: "", address: "" });
   const [kycFiles, setKycFiles] = useState<any>({});
   const [pendingKycId, setPendingKycId] = useState<number | null>(null);
   const [workflowId, setWorkflowId] = useState("");
    const [accountType, setAccountType] = useState(WEBSITE_CONFIG.capabilities?.accountTypes?.[0] ?? "checking");
   const [workflowTitle, setWorkflowTitle] = useState("");
   const [workflowAmount, setWorkflowAmount] = useState("");
   const [workflowSymbol, setWorkflowSymbol] = useState("");
    const [paymentRecordId, setPaymentRecordId] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("other");
    const [paymentProof, setPaymentProof] = useState("");
  const [trackingNum, setTrackingNum] = useState("");
  const [trackingResult, setTrackingResult] = useState<any>(null);
   const [receiptError, setReceiptError] = useState("");

  const authHeaders = () => ({ "Authorization": `Bearer ${localStorage.getItem("customer_token") ?? ""}` });
  const resetCustomerState = () => {
    customerSessionVersion.current += 1;
    localStorage.removeItem("customer_token");
    setMode("login");
    setCustomerInfo(null);
    setNotifications([]);
    setWorkflowData({ accounts: [], transactions: [], records: [], plans: [], investments: [], positions: [], orders: [], properties: [], payments: [] });
    setReferralData(null);
    setKycSubmissions([]);
    setKycForm({ documentType: WEBSITE_CONFIG.kyc?.supportedIdTypes?.[0] ?? "passport", fullName: "", documentNumber: "", dateOfBirth: "", address: "" });
    setKycFiles({});
    setPendingKycId(null);
    setWorkflowId("");
    setAccountType(WEBSITE_CONFIG.capabilities?.accountTypes?.[0] ?? "checking");
    setWorkflowTitle(""); setWorkflowAmount(""); setWorkflowSymbol("");
    setPaymentRecordId(""); setPaymentMethod("other"); setPaymentProof("");
    setTrackingNum(""); setTrackingResult(null); setReceiptError("");
    setCurrentTransactionPin(""); setNextTransactionPin(""); setPinStatus("");
    setEmail(""); setPassword(""); setResetToken("");
    setFirstName(""); setLastName(""); setCountry(""); setTransactionPin(""); setTermsAccepted(false);
    setError(""); setLoading(false);
    return customerSessionVersion.current;
  };
  const loadWorkflowData = async (sessionVersion = customerSessionVersion.current) => {
    const sessionToken = localStorage.getItem("customer_token");
    if (!sessionToken) return;
    const sessionHeaders = { Authorization: "Bearer " + sessionToken };
    const get = async (path: string) => {
      const response = await fetch(path, { headers: sessionHeaders });
      return response.ok ? response.json() : [];
    };
    const [accounts, transactions, records, plans, investments, positions, orders, properties, payments, referrals, kyc] = await Promise.all([
      get("/api/workflows/customer/accounts"),
      WEBSITE_CONFIG.type === "banking" ? get("/api/customer/transactions") : Promise.resolve([]),
      get("/api/workflows/customer/records"),
      get("/api/workflows/customer/investment/plans"),
      get("/api/workflows/customer/investment/records"),
      get("/api/workflows/customer/forex/positions"),
      get("/api/workflows/customer/crypto/orders"),
      fetch("/api/workflows/public/properties").then(response => response.ok ? response.json() : []),
      get("/api/workflows/customer/payments"),
      ["investment", "forex"].includes(WEBSITE_CONFIG.type) ? get("/api/workflows/customer/referrals") : Promise.resolve(null),
      WEBSITE_CONFIG.kyc?.enabled ? get("/api/workflows/customer/kyc") : Promise.resolve([]),
    ]);
    if (sessionVersion !== customerSessionVersion.current || localStorage.getItem("customer_token") !== sessionToken) return;
    setWorkflowData({ accounts, transactions, records, plans, investments, positions, orders, properties, payments });
    setReferralData(referrals);
    setKycSubmissions(Array.isArray(kyc) ? kyc : []);
    const pendingSubmission = Array.isArray(kyc) ? kyc.find((row: any) => ["pending", "more_info_requested"].includes(row.status)) : null;
    setPendingKycId(pendingSubmission?.id ? Number(pendingSubmission.id) : null);
  };

  useEffect(() => {
    if (mode !== "dashboard") return;
    const sessionToken = localStorage.getItem("customer_token");
    if (!sessionToken) return;
    let active = true;
    const refreshNotifications = async () => {
      try {
        const response = await fetch("/api/email/customer", { headers: { Authorization: "Bearer " + sessionToken } });
        if (!response.ok) return;
        const rows = await response.json();
        if (active && localStorage.getItem("customer_token") === sessionToken) setNotifications(Array.isArray(rows) ? rows : []);
      } catch {}
    };
    void refreshNotifications();
    const timer = window.setInterval(() => { void refreshNotifications(); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [mode]);

  async function markCustomerNotificationRead(id: number) {
    const response = await fetch("/api/email/customer/" + id + "/read", { method: "POST", headers: authHeaders() });
    if (response.ok) setNotifications(items => items.map(item => item.id === id ? { ...item, read: true } : item));
  }

    useEffect(() => {
      if (mode !== "dashboard" || WEBSITE_CONFIG.type !== "banking") return;
      const sessionVersion = customerSessionVersion.current;
      const sessionToken = localStorage.getItem("customer_token");
      if (!sessionToken) return;
      const refreshTransactions = async () => {
        try {
          const response = await fetch("/api/customer/transactions", { headers: { Authorization: "Bearer " + sessionToken } });
          if (!response.ok) return;
          const items = await response.json();
          if (sessionVersion !== customerSessionVersion.current || localStorage.getItem("customer_token") !== sessionToken) return;
          setWorkflowData((current: any) => ({
            ...current,
            transactions: Array.isArray(items) ? items : [],
          }));
        } catch {}
      };
      const timer = window.setInterval(() => { void refreshTransactions(); }, 30_000);
      return () => window.clearInterval(timer);
    }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loginEmail = email;
    const loginPassword = password;
    const sessionVersion = resetCustomerState();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (sessionVersion !== customerSessionVersion.current) return;
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }
      localStorage.setItem("customer_token", data.token);
      setCustomerInfo(data.customer);
      setMode("dashboard");
      void loadWorkflowData(sessionVersion);
    } catch {
      if (sessionVersion === customerSessionVersion.current) setError("Network error");
    } finally {
      if (sessionVersion === customerSessionVersion.current) setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ firstName, lastName, email, password, country, transactionPin, termsAccepted, referralCode: new URLSearchParams(window.location.search).get("ref") }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Registration failed"); return; }
      setMode("login");
      setError(WEBSITE_CONFIG.type === "banking"
        ? "Your registration has been received. You are currently waiting for approval (" + WEBSITE_CONFIG.name + "). You will be able to log in once your account has been approved."
        : "Account created — please log in.");
    } catch { setError("Network error"); } finally { setLoading(false); }
  };

  const submitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kycFiles.front && !kycSubmissions.some((row: any) => row.id === pendingKycId && (row.document_front_url || row.documentFrontUrl))) {
      setError("Upload the front of your identity document before submitting.");
      return;
    }
    setError(""); setLoading(true);
    try {
      let submissionId = pendingKycId;
      if (!submissionId) {
        const response = await fetch("/api/workflows/customer/kyc", {
          method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(kycForm),
        });
        const data = await response.json();
        if (!response.ok) { setError(data.error ?? "Unable to submit identity details"); return; }
        submissionId = Number(data.id);
        setPendingKycId(submissionId);
      }
      for (const slot of ["front", "back", "selfie"]) {
        const file = kycFiles[slot] as File | undefined;
        if (!file) continue;
        const response = await fetch("/api/workflows/customer/kyc/" + submissionId + "/file/" + slot, {
          method: "PUT", headers: { ...authHeaders(), "Content-Type": file.type }, body: file,
        });
        if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Document upload failed"); }
      }
      setPendingKycId(null); setKycFiles({});
      setError("Identity documents submitted for review.");
      await loadWorkflowData();
    } catch (error: any) { setError(error.message ?? "KYC submission failed"); }
    finally { setLoading(false); }
  };

  const copyReferralLink = async () => {
    if (!referralData?.referralCode) return;
    const link = window.location.origin + "/customer?ref=" + encodeURIComponent(referralData.referralCode);
    try { await navigator.clipboard.writeText(link); setError("Referral link copied."); }
    catch { setError(link); }
  };

  const shareReferralLink = async () => {
    if (!referralData?.referralCode) return;
    const link = window.location.origin + "/customer?ref=" + encodeURIComponent(referralData.referralCode);
    try {
      if (navigator.share) await navigator.share({ title: WEBSITE_CONFIG.name + " referral", url: link });
      else { await navigator.clipboard.writeText(link); setError("Sharing is unavailable; referral link copied."); }
    } catch (error: any) {
      if (error?.name !== "AbortError") setError("Unable to share the referral link.");
    }
  };

   const handleForgot = async (e: React.FormEvent) => {
     e.preventDefault();
     setError(""); setLoading(true);
     try {
       const res = await fetch("/api/auth/customer/request-password-reset", {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ email }),
       });
       const data = await res.json();
       if (!res.ok) { setError(data.error ?? "Unable to request reset"); return; }
       setError(data.message ?? "If an account exists, reset instructions have been sent.");
       setMode("reset");
     } catch { setError("Network error"); } finally { setLoading(false); }
   };

   const submitWorkflow = async (e: React.FormEvent) => {
     e.preventDefault();
     setError("");
     const amount = Number(workflowAmount);
      let path = "/api/workflows/customer/domain";
     let payload: any = { title: workflowTitle || WEBSITE_CONFIG.capabilities?.actionLabel || WEBSITE_CONFIG.type + " request", amount: amount || undefined, category: WEBSITE_CONFIG.capabilities?.recordCategory ?? WEBSITE_CONFIG.type, metadata: { source: "customer_portal" } };
     if (WEBSITE_CONFIG.type === "banking") {
       path = "/api/workflows/customer/accounts/request";
       payload = { accountType };
     } else if (WEBSITE_CONFIG.type === "investment") {
       path = "/api/workflows/customer/investment";
       payload = { planId: Number(workflowId), amount };
     } else if (WEBSITE_CONFIG.type === "real_estate") {
        payload = { title: workflowTitle || "Property inquiry", metadata: { propertyId: workflowId, source: "customer_portal" } };
     } else if (WEBSITE_CONFIG.type === "forex") {
       path = "/api/workflows/customer/forex/positions";
       payload = { symbol: workflowSymbol, volume: amount, direction: "buy" };
     } else if (WEBSITE_CONFIG.type === "crypto") {
       path = "/api/workflows/customer/crypto/orders";
       payload = { symbol: workflowSymbol, amount, side: "buy" };
      } else if (WEBSITE_CONFIG.type === "loan") {
        path = "/api/workflows/customer/loans";
        payload = { principalAmount: amount, termMonths: 12, loanType: "personal", purpose: workflowTitle };
      } else {
        const metadata: any = { source: "customer_portal" };
        if (WEBSITE_CONFIG.type === "digital_wallet") metadata.recipient = workflowId;
        if (WEBSITE_CONFIG.type === "ecommerce") metadata.items = [{ name: workflowTitle, quantity: 1 }];
        if (WEBSITE_CONFIG.type === "insurance") { metadata.policyNumber = workflowId; metadata.claimType = workflowTitle; }
        if (WEBSITE_CONFIG.type === "airline") { metadata.flightId = workflowId; metadata.passengers = [{ name: workflowTitle }]; }
        if (WEBSITE_CONFIG.type === "logistics") { metadata.pickupAddress = workflowId; metadata.deliveryAddress = workflowTitle; }
        if (WEBSITE_CONFIG.type === "hospital") { metadata.appointmentDate = workflowId; metadata.provider = workflowTitle; }
        if (WEBSITE_CONFIG.type === "school") { metadata.courseId = workflowId; metadata.studentName = workflowTitle; }
        if (WEBSITE_CONFIG.type === "hotel") { metadata.checkIn = workflowId; metadata.checkOut = workflowTitle; }
        if (WEBSITE_CONFIG.type === "crowdfunding") metadata.campaignId = workflowId;
        if (WEBSITE_CONFIG.type === "microfinance") metadata.productType = workflowId;
        payload = { title: WEBSITE_CONFIG.capabilities?.actionLabel ?? WEBSITE_CONFIG.type + " request", amount: amount || undefined, metadata };
     }
     try {
       const response = await fetch(path, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(payload) });
       const data = await response.json();
       if (!response.ok) { setError(data.error ?? "Unable to submit request"); return; }
       setWorkflowTitle(""); setWorkflowAmount(""); setWorkflowId(""); setWorkflowSymbol("");
      setError(WEBSITE_CONFIG.type === "banking" ? "Account opened successfully." : "Request submitted successfully.");
       void loadWorkflowData();
     } catch { setError("Network error"); }
   };
    const submitPayment = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      const record = workflowData.records?.find((item: any) => String(item.id) === paymentRecordId);
      if (!record) { setError("Select a request to pay."); return; }
      try {
        const response = await fetch("/api/workflows/customer/records/" + record.id + "/payment", { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(record.amount), method: paymentMethod, proofNotes: paymentProof }) });
        const data = await response.json();
        if (!response.ok) { setError(data.error ?? "Unable to submit payment"); return; }
        setPaymentRecordId(""); setPaymentProof(""); setError("Payment submitted for review.");
        void loadWorkflowData();
      } catch { setError("Network error"); }
    };

   const handleReset = async (e: React.FormEvent) => {
     e.preventDefault();
     setError(""); setLoading(true);
     try {
       const res = await fetch("/api/auth/customer/reset-password", {
         method: "POST", headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ token: resetToken, password }),
       });
       const data = await res.json();
       if (!res.ok) { setError(data.error ?? "Unable to reset password"); return; }
       setError("Password reset successfully — please sign in.");
       setMode("login");
       setPassword("");
       setResetToken("");
     } catch { setError("Network error"); } finally { setLoading(false); }
   };

  const handleTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackingResult(null);
    try {
      const res = await fetch(`/api/customer/tracking/${encodeURIComponent(trackingNum.trim())}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) { setTrackingResult({ error: data.error }); return; }
      setTrackingResult(data);
    } catch { setTrackingResult({ error: "Network error" }); }
  };

  const updateTransactionPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatus(""); setLoading(true);
    try {
      const response = await fetch("/api/workflows/customer/security/transaction-pin", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ currentTransactionPin, transactionPin: nextTransactionPin }),
      });
      const data = await response.json();
      if (!response.ok) { setPinStatus(data.error ?? "Unable to save transaction PIN"); return; }
      setCurrentTransactionPin(""); setNextTransactionPin("");
      setPinStatus("Transaction PIN saved.");
    } catch { setPinStatus("Network error"); }
    finally { setLoading(false); }
  };

   const escapeReceiptHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => {
     if (character === '"') return "&quot;";
     const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;" };
     return entities[character] ?? character;
   });
   const bankingReceiptStatus = (value: unknown) => {
     const status = String(value ?? "pending").trim().toLowerCase();
     if (["approved", "completed", "paid", "successful"].includes(status)) return "Approved";
     if (["pending", "processing", "confirming", "pending review", "pending_review"].includes(status)) return "Pending — Under Review/network";
     if (status === "rejected") return "Rejected";
     return status.replaceAll("_", " ").replaceAll("-", " ").split(" ")
       .map((word: string) => word ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(" ");
   };
   const openStandaloneBankingReceipt = (transaction: any) => {
     setReceiptError("");
     const receiptWindow = window.open("", "_blank");
     if (!receiptWindow) {
       setReceiptError("Allow pop-ups to print or save the receipt.");
       return;
     }
     receiptWindow.opener = null;

     const escape = escapeReceiptHtml;
     const rawLogoUrl = String(WEBSITE_CONFIG.logoUrl ?? "").trim();
     let logoUrl = "";
     try {
       const parsed = new URL(rawLogoUrl, window.location.href);
       const host = parsed.host.toLowerCase();
       if ((parsed.protocol === "data:" && rawLogoUrl.toLowerCase().startsWith("data:image/")) || (
         (parsed.protocol === "http:" || parsed.protocol === "https:")
         && !host.includes(["danzy", "app"].join("."))
         && !host.includes("replit.dev")
         && !host.includes("replit.app")
       )) logoUrl = parsed.href;
     } catch {}
     if (!logoUrl) {
       const fallbackLogo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="23" fill="#e8edf2"/><path d="M8 19 24 8l16 11v3H8zm3 4h4v12h-4zm9 0h4v12h-4zm9 0h4v12h-4zM8 38h32v3H8z" fill="#253342"/></svg>';
       logoUrl = "data:image/svg+xml," + encodeURIComponent(fallbackLogo);
     }

     const accountId = Number(transaction.account_id ?? transaction.accountId);
     const account = workflowData.accounts.find((item: any) => Number(item.id) === accountId);
     const accountNumber = String(account?.account_number ?? account?.accountNumber ?? "").replaceAll(" ", "");
     const maskedAccount = accountNumber ? "•••• " + accountNumber.slice(-4) : "Not provided";
     const currency = String(transaction.currency ?? account?.currency ?? "USD").toUpperCase();
     const numericAmount = Number(transaction.amount);
     const amount = formatCurrencySymbolFirst(numericAmount, currency);
     const rawDate = transaction.created_at ?? transaction.createdAt;
     const date = rawDate ? new Date(rawDate) : null;
     const dateLabel = date && Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not provided";
     const status = bankingReceiptStatus(transaction.metadata?.requestStatus ?? transaction.status);
     const type = String(transaction.transaction_type ?? transaction.transactionType ?? "Transaction").replaceAll("_", " ").replaceAll("-", " ");
     const receiptNumber = String(transaction.reference ?? ("TXN-" + transaction.id));
     const rejectionReason = String(transaction.rejection_reason ?? transaction.rejectionReason ?? transaction.metadata?.rejectionReason ?? "").trim();
     const rows: Array<[string, string]> = [
       ["Receipt number", receiptNumber],
       ["Transaction type", type],
       ["Description", String(transaction.description ?? "Not provided")],
       ["Account", maskedAccount],
       ["Amount", amount],
       ["Transaction date/time", dateLabel],
       ["Status", status],
     ];
     if (status === "Rejected" && rejectionReason) rows.push(["Rejection reason", rejectionReason]);
     const rowsMarkup = rows.map(([label, value]) =>
       '<div class="row"><span>' + escape(label) + '</span><strong>' + escape(value) + '</strong></div>'
     ).join("");
     const logo = escape(logoUrl);
     const brand = escape(WEBSITE_CONFIG.name);
     const watermarkTiles = Array.from({ length: 40 }, () =>
       '<img src="' + logo + '" alt="" aria-hidden="true" />'
     ).join("");
     const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
       + '<title>' + escape(receiptNumber) + ' receipt</title><style>'
       + '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e2e8f0;font:14px Arial,sans-serif;color:#17212b}'
       + '.paper{position:relative;width:210mm;min-height:297mm;margin:12px auto;padding:16mm;background:#fff;overflow:hidden;box-shadow:0 12px 36px rgba(15,23,42,.16)}'
       + '.watermark{position:absolute;inset:0;display:grid;grid-template-columns:repeat(5,1fr);grid-template-rows:repeat(8,1fr);align-items:center;justify-items:center;opacity:.055;pointer-events:none;z-index:0}'
       + '.watermark img{width:18mm;height:12mm;object-fit:contain}.content{position:relative;z-index:1}'
       + 'header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #dbe3ec;padding-bottom:16px;margin-bottom:22px}'
       + '.bank-logo{width:18mm;height:18mm;object-fit:contain;flex:none}h1{font-size:22px;margin:0 0 4px}.brand{font-size:14px;color:#526273;margin:0}'
       + '.badge{margin-left:auto;border:1px solid #b9c6d4;border-radius:99px;padding:7px 11px;font-weight:700;white-space:nowrap}'
       + '.row{display:grid;grid-template-columns:minmax(130px,35%) 1fr;gap:12px;padding:13px 10px;border-bottom:1px solid #e2e8f0;break-inside:avoid}'
       + '.row span{color:#526273}.row strong{overflow-wrap:anywhere}.note{margin-top:28px;color:#64748b;font-size:11px;text-align:center}'
       + '@media print{body{background:#fff}.paper{width:210mm;min-height:297mm;margin:0;box-shadow:none;overflow:visible;print-color-adjust:exact;-webkit-print-color-adjust:exact}.watermark{position:fixed;inset:0;height:100vh;break-inside:avoid}}'
       + '@media(max-width:600px){.paper{width:100%;min-height:100vh;margin:0;padding:20px}.badge{font-size:11px}.row{grid-template-columns:1fr;gap:4px}}'
       + '</style></head><body><main class="paper"><div class="watermark" aria-hidden="true">' + watermarkTiles + '</div>'
       + '<div class="content"><header><img class="bank-logo" src="' + logo + '" alt="' + brand + ' logo" />'
       + '<div><p class="brand">' + brand + '</p><h1>Transaction receipt</h1></div><span class="badge">' + escape(status) + '</span></header>'
       + rowsMarkup + '<p class="note">This receipt reflects the transaction status recorded by ' + brand + '.</p></div></main></body></html>';

     receiptWindow.addEventListener("load", () => {
       const images = Array.from(receiptWindow.document.images);
       void Promise.all(images.map(image => image.decode().catch(() => undefined))).then(() => {
         if (!receiptWindow.closed) { receiptWindow.focus(); receiptWindow.print(); }
       });
     }, { once: true });
     receiptWindow.document.open();
     receiptWindow.document.write(html);
     receiptWindow.document.close();
   };

   const inputStyle: React.CSSProperties = { width: "100%", padding: "0.75rem 1rem", background: "var(--theme-input-background)", border: "1px solid var(--theme-border)", borderRadius: 8, color: "var(--theme-text)", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" };
  const btnStyle: React.CSSProperties = { width: "100%", padding: "0.85rem", background: "#D4AF37", border: "none", borderRadius: 8, color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" };
  const domainType = !["banking", "investment", "real_estate", "forex", "crypto", "loan"].includes(WEBSITE_CONFIG.type);
  const domainFirstPlaceholder: Record<string, string> = { digital_wallet: "Recipient", ecommerce: "Product name", insurance: "Policy number", airline: "Flight ID", logistics: "Pickup address", hospital: "Appointment date", school: "Course ID", hotel: "Check-in date", crowdfunding: "Campaign ID", microfinance: "Product type" };
  const domainSecondPlaceholder: Record<string, string> = { ecommerce: "Quantity / order note", insurance: "Claim type", airline: "Passenger name", logistics: "Delivery address", hospital: "Provider", school: "Student name", hotel: "Check-out date" };

  return (
     <div style={{ minHeight: "100vh", background: "var(--theme-background)", display: "flex", alignItems: "center", justifyContent: "center" }}>
       <div style={{ width: "100%", maxWidth: WEBSITE_CONFIG.type === "banking" ? 900 : 440, padding: "2rem", background: "var(--theme-card)", borderRadius: 16, boxShadow: "0 25px 50px rgba(0,0,0,0.16)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <h1 style={{ color: "var(--theme-text)", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{WEBSITE_CONFIG.name}</h1>
          <p style={{ color: "var(--theme-mutedText)", fontSize: "0.85rem", marginTop: 4 }}>Customer Portal</p>
        </div>

        {mode === "dashboard" && (
          <div>
            <div style={{ marginBottom: "1rem", padding: "1rem", background: "var(--theme-background)", borderRadius: 10 }}>
              <p style={{ color: "var(--theme-mutedText)", margin: 0 }}>Welcome, <strong style={{ color: "var(--theme-text)" }}>{customerInfo?.firstName}</strong></p>
            </div>
            <section style={{ marginBottom: "1rem", padding: "1rem", background: "var(--theme-background)", borderRadius: 10, border: "1px solid var(--theme-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ color: "var(--theme-text)", margin: 0, fontSize: "1rem" }}>Notifications {notifications.filter(item => !item.read).length > 0 ? "(" + notifications.filter(item => !item.read).length + " unread)" : ""}</h3>
                <button type="button" onClick={() => { const token = localStorage.getItem("customer_token"); if (token) fetch("/api/email/customer", { headers: { Authorization: "Bearer " + token } }).then(r => r.ok ? r.json() : []).then(rows => setNotifications(Array.isArray(rows) ? rows : [])); }} style={{ padding: ".4rem .65rem", borderRadius: 6, border: "1px solid var(--theme-border)", background: "var(--theme-card)", color: "var(--theme-text)", cursor: "pointer" }}>Refresh</button>
              </div>
              {notifications.length === 0 ? <p style={{ color: "var(--theme-mutedText)", fontSize: ".85rem", marginBottom: 0 }}>You have no notifications.</p> : notifications.slice(0, 20).map(item => <div key={item.id} style={{ borderTop: "1px solid var(--theme-border)", padding: ".7rem 0", opacity: item.read ? .7 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><strong style={{ color: "var(--theme-text)", fontSize: ".9rem" }}>{item.title}</strong>{!item.read && <button type="button" onClick={() => void markCustomerNotificationRead(Number(item.id))} style={{ border: 0, background: "transparent", color: "#D4AF37", cursor: "pointer", fontSize: ".75rem", whiteSpace: "nowrap" }}>Mark read</button>}</div>
                <p style={{ color: "var(--theme-mutedText)", fontSize: ".85rem", margin: ".35rem 0" }}>{item.message}</p>
                <small style={{ color: "var(--theme-mutedText)", fontSize: ".72rem" }}>{item.createdAt || item.created_at ? new Date(item.createdAt ?? item.created_at).toLocaleString() : ""}</small>
              </div>)}
            </section>
            {WEBSITE_CONFIG.capabilities?.transactionPin && <form onSubmit={updateTransactionPin} style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
              <h3 style={{ color: "var(--theme-text)", margin: "0 0 .5rem", fontSize: "1rem" }}>Transaction PIN</h3>
              <p style={{ color: "var(--theme-mutedText)", fontSize: ".8rem", lineHeight: 1.45 }}>PIN hashes are not included in portable exports. Set a new PIN before using PIN-protected actions. Leave the current PIN blank the first time.</p>
              <input type="password" inputMode="numeric" autoComplete="current-password" placeholder="Current PIN (leave blank if not set)" value={currentTransactionPin} onChange={e => setCurrentTransactionPin(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
              <input type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} placeholder="New PIN (4–6 digits)" value={nextTransactionPin} onChange={e => setNextTransactionPin(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }} />
              {pinStatus && <p role="status" style={{ color: pinStatus.includes("saved") ? "#34d399" : "#f87171", fontSize: ".85rem" }}>{pinStatus}</p>}
              <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Saving…" : "Save transaction PIN"}</button>
            </form>}
            {WEBSITE_CONFIG.type === "banking" && <BankingCustomerPanel />}
             <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 16 }}>
               {[
                 ["Accounts", workflowData.accounts?.length ?? 0],
                 ["Requests", workflowData.records?.length ?? 0],
                 ["Investments", workflowData.investments?.length ?? 0],
                 ["Trades", (workflowData.positions?.length ?? 0) + (workflowData.orders?.length ?? 0)],
               ].map(([label, value]) => <div key={String(label)} style={{ background: "var(--theme-background)", borderRadius: 10, padding: "0.85rem" }}><div style={{ color: "var(--theme-mutedText)", fontSize: "0.75rem" }}>{label}</div><strong style={{ color: "var(--theme-text)", fontSize: "1.25rem" }}>{value}</strong></div>)}
             </div>
              {WEBSITE_CONFIG.type !== "tracking" && (
                <form onSubmit={submitWorkflow} style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: "1rem" }}>
                  <h3 style={{ color: "var(--theme-text)", margin: "0 0 0.75rem", fontSize: "1rem" }}>{WEBSITE_CONFIG.capabilities?.actionLabel ?? "Create a service request"}</h3>
                  {WEBSITE_CONFIG.type === "banking" && <select aria-label="Account type" value={accountType} onChange={e => setAccountType(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }}>
                    {(WEBSITE_CONFIG.capabilities?.accountTypes ?? []).map((type: string) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                  </select>}
                  {(WEBSITE_CONFIG.type === "investment" || WEBSITE_CONFIG.type === "real_estate") && <input placeholder={WEBSITE_CONFIG.type === "investment" ? "Plan ID" : "Property ID"} value={workflowId} onChange={e => setWorkflowId(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }} />}
                 {(WEBSITE_CONFIG.type === "forex" || WEBSITE_CONFIG.type === "crypto") && <input placeholder={WEBSITE_CONFIG.type === "forex" ? "Pair, e.g. EURUSD" : "Pair, e.g. BTC/USDT"} value={workflowSymbol} onChange={e => setWorkflowSymbol(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }} />}
                  {domainType && <input placeholder={domainFirstPlaceholder[WEBSITE_CONFIG.type] ?? WEBSITE_CONFIG.capabilities?.recordLabelSingular ?? "Request detail"} value={workflowId} onChange={e => setWorkflowId(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }} />}
                  {domainType && domainSecondPlaceholder[WEBSITE_CONFIG.type] && <input placeholder={domainSecondPlaceholder[WEBSITE_CONFIG.type]} value={workflowTitle} onChange={e => setWorkflowTitle(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }} />}
                  {WEBSITE_CONFIG.type !== "banking" && WEBSITE_CONFIG.type !== "real_estate" && <input type="number" min="0.01" step="0.01" placeholder="Amount / size" value={workflowAmount} onChange={e => setWorkflowAmount(e.target.value)} required={WEBSITE_CONFIG.type !== "hospital" && WEBSITE_CONFIG.type !== "school" && WEBSITE_CONFIG.type !== "hotel" && WEBSITE_CONFIG.type !== "airline" && WEBSITE_CONFIG.type !== "insurance" && WEBSITE_CONFIG.type !== "logistics"} style={{ ...inputStyle, marginBottom: 8 }} />}
                 {error && <p style={{ color: error.includes("success") ? "#34d399" : "#f87171", fontSize: "0.85rem" }}>{error}</p>}
                 <button type="submit" style={btnStyle}>{WEBSITE_CONFIG.type === "banking" ? "Open Account" : "Submit request"}</button>
               </form>
             )}
             <BankingDepositFlow />
               {["investment", "forex"].includes(WEBSITE_CONFIG.type) && referralData && <div style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}>
                 <h3 style={{ color: "var(--theme-text)", margin: "0 0 .75rem", fontSize: "1rem" }}>Refer a friend</h3>
                 <p style={{ color: "var(--theme-mutedText)", margin: "0 0 .5rem" }}>Your referral code: <strong style={{ color: "var(--theme-text)" }}>{referralData.referralCode}</strong></p>
                 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 10 }}>
                   <div><small style={{ color: "var(--theme-mutedText)" }}>Total referrals</small><div style={{ color: "var(--theme-text)", fontWeight: 700 }}>{referralData.totalReferrals ?? 0}</div></div>
                   <div><small style={{ color: "var(--theme-mutedText)" }}>Pending bonuses</small><div style={{ color: "var(--theme-text)", fontWeight: 700 }}>{referralData.pendingBonus ?? "0.00"}</div></div>
                   <div><small style={{ color: "var(--theme-mutedText)" }}>Approved bonuses</small><div style={{ color: "var(--theme-text)", fontWeight: 700 }}>{referralData.approvedBonus ?? "0.00"}</div></div>
                 </div>
                 {referralData.enabled ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={copyReferralLink} style={btnStyle}>Copy referral link</button><button type="button" onClick={shareReferralLink} style={{ ...btnStyle, background: "var(--theme-surface-soft)", color: "var(--theme-text)" }}>Share referral link</button></div> : <p style={{ color: "var(--theme-mutedText)" }}>The referral program is currently disabled.</p>}
                 {referralData.history?.length > 0 && <div style={{ marginTop: 10 }}><strong style={{ color: "var(--theme-text)" }}>Earnings history</strong>{referralData.history.slice(0, 8).map((item: any) => <p key={(item.source ?? "rewards") + "-" + item.id} style={{ color: "var(--theme-mutedText)", margin: ".35rem 0" }}>{item.plan_name ?? "Referral reward"} · {item.bonus_amount} {item.currency ?? "USD"} · {item.status}</p>)}</div>}
               </div>}
               {WEBSITE_CONFIG.kyc?.enabled && <form onSubmit={submitKyc} style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}>
                 <h3 style={{ color: "var(--theme-text)", margin: "0 0 .75rem", fontSize: "1rem" }}>Identity verification</h3>
                 {kycSubmissions.map((item: any) => <p key={item.id} style={{ color: "var(--theme-mutedText)", margin: ".25rem 0" }}>Submission {item.id}: {item.status}</p>)}
                 <input aria-label="Full legal name" placeholder="Full legal name" value={kycForm.fullName} onChange={e => setKycForm((value: any) => ({ ...value, fullName: e.target.value }))} required style={{ ...inputStyle, marginBottom: 8 }} />
                 <select aria-label="Identity document type" value={kycForm.documentType} onChange={e => setKycForm((value: any) => ({ ...value, documentType: e.target.value }))} style={{ ...inputStyle, marginBottom: 8 }}>
                   {(WEBSITE_CONFIG.kyc.supportedIdTypes ?? ["passport"]).map((type: string) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
                 </select>
                 <input aria-label="Document number" placeholder="Document number" value={kycForm.documentNumber} onChange={e => setKycForm((value: any) => ({ ...value, documentNumber: e.target.value }))} required style={{ ...inputStyle, marginBottom: 8 }} />
                 {WEBSITE_CONFIG.kyc.requireDateOfBirth && <input aria-label="Date of birth" type="date" value={kycForm.dateOfBirth} onChange={e => setKycForm((value: any) => ({ ...value, dateOfBirth: e.target.value }))} required style={{ ...inputStyle, marginBottom: 8 }} />}
                 {WEBSITE_CONFIG.kyc.requireHomeAddress && <input aria-label="Address" placeholder="Residential address" value={kycForm.address} onChange={e => setKycForm((value: any) => ({ ...value, address: e.target.value }))} required style={{ ...inputStyle, marginBottom: 8 }} />}
                 <label style={{ display: "block", color: "var(--theme-mutedText)", marginBottom: 6 }}>Document front (JPG, PNG, WEBP, or PDF)<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={e => setKycFiles((value: any) => ({ ...value, front: e.target.files?.[0] }))} style={{ display: "block", marginTop: 4 }} /></label>
                 <label style={{ display: "block", color: "var(--theme-mutedText)", marginBottom: 6 }}>Document back (optional)<input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={e => setKycFiles((value: any) => ({ ...value, back: e.target.files?.[0] }))} style={{ display: "block", marginTop: 4 }} /></label>
                 <label style={{ display: "block", color: "var(--theme-mutedText)", marginBottom: 10 }}>Selfie (optional)<input type="file" accept=".jpg,.jpeg,.png,.webp" onChange={e => setKycFiles((value: any) => ({ ...value, selfie: e.target.files?.[0] }))} style={{ display: "block", marginTop: 4 }} /></label>
                 <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Uploading…" : "Submit identity documents"}</button>
               </form>}
               {workflowData.accounts?.length > 0 && <div style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}><h3 style={{ color: "var(--theme-text)", margin: "0 0 .5rem", fontSize: "1rem" }}>Your accounts</h3>{workflowData.accounts.map((item: any) => {
                 const balance = Number(item.balance);
                 let balanceParts: Intl.NumberFormatPart[] = [];
                  try {
                    const currency = String(item.currency ?? "USD").trim().toUpperCase();
                    if (WEBSITE_CONFIG.type === "banking" && Number.isFinite(balance) && currency) {
                      balanceParts = new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 3 }).formatToParts(balance);
                    }
                  } catch {}
                  const currencyPart = balanceParts.find(part => part.type === "currency");
                  const numberParts = balanceParts.filter(part => part.type !== "currency" && part.type !== "literal");
                  return <p key={item.id} style={{ color: "var(--theme-text)", margin: ".35rem 0" }}>{item.account_number ?? item.accountNumber} · {balanceParts.length ? <><span style={{ fontSize: ".7em", fontWeight: 500, verticalAlign: "baseline" }}>{currencyPart?.value}</span>{" "}{numberParts.map((part, index) => <span key={index} style={{ fontSize: "4em", fontWeight: 900, verticalAlign: "baseline" }}>{part.value}</span>)}</> : <>{formatCurrencySymbolFirst(balance, item.currency, 0)}</>}</p>;
               })}</div>}
                {WEBSITE_CONFIG.type === "banking" && <div style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <h3 style={{ color: "var(--theme-text)", margin: 0, fontSize: "1rem" }}>Online Banking receipts</h3>
                    <button type="button" onClick={() => void loadWorkflowData()} style={{ ...btnStyle, width: "auto", padding: ".5rem .75rem", fontSize: ".8rem" }}>Refresh</button>
                  </div>
                  {receiptError && <p role="status" style={{ color: "#f87171", fontSize: ".85rem" }}>{receiptError}</p>}
                  {workflowData.transactions?.length > 0 ? workflowData.transactions.slice(0, 12).map((transaction: any) => {
                    const amountValue = Number(transaction.amount);
                    const amountCurrency = String(transaction.currency ?? "USD").toUpperCase();
                    const amountLabel = Number.isFinite(amountValue) ? formatCurrencySymbolFirst(amountValue, amountCurrency) : "";
                    const parsedDate = transaction.created_at ? new Date(transaction.created_at) : null;
                    const dateLabel = parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toLocaleString() : "";
                    return <div key={transaction.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: "1px solid var(--theme-border)", padding: ".75rem 0" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ color: "var(--theme-text)", fontSize: ".85rem" }}>{transaction.reference ?? ("TXN-" + transaction.id)}</strong>
                        <p style={{ color: "var(--theme-mutedText)", margin: ".25rem 0", fontSize: ".8rem" }}>{String(transaction.transaction_type ?? transaction.transactionType ?? "Transaction").replaceAll("_", " ")}{amountLabel ? " · " + amountLabel : ""}</p>
                        <small style={{ color: "var(--theme-mutedText)" }}>{bankingReceiptStatus(transaction.metadata?.requestStatus ?? transaction.status)}{dateLabel ? " · " + dateLabel : ""}</small>
                      </div>
                      <button type="button" onClick={() => openStandaloneBankingReceipt(transaction)} style={{ ...btnStyle, width: "auto", padding: ".55rem .75rem", fontSize: ".8rem" }}>Print / save receipt</button>
                    </div>;
                  }) : <p style={{ color: "var(--theme-mutedText)", fontSize: ".85rem" }}>No banking transactions yet. Receipts will appear here when transactions are recorded.</p>}
                </div>}
              {(workflowData.records?.length > 0 || workflowData.investments?.length > 0 || workflowData.positions?.length > 0 || workflowData.orders?.length > 0) && <div style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}><h3 style={{ color: "var(--theme-text)", margin: "0 0 .5rem", fontSize: "1rem" }}>Recent activity</h3>{[...(workflowData.records ?? []), ...(workflowData.investments ?? []), ...(workflowData.positions ?? []), ...(workflowData.orders ?? [])].slice(0, 8).map((item: any) => <p key={(item.id + "-" + (item.category ?? item.status))} style={{ color: "var(--theme-text)", margin: ".35rem 0" }}>{item.title ?? item.name ?? item.symbol ?? item.pair ?? "Activity"} · {item.status ?? "pending"}{item.amount ? " · " + item.amount : ""}</p>)}</div>}
               {WEBSITE_CONFIG.capabilities?.payment && workflowData.records?.length > 0 && <form onSubmit={submitPayment} style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginBottom: 12 }}>
                 <h3 style={{ color: "var(--theme-text)", margin: "0 0 .75rem", fontSize: "1rem" }}>Submit payment evidence</h3>
                <select value={paymentRecordId} onChange={e => setPaymentRecordId(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }}><option value="">Choose a request</option>{workflowData.records.filter((item: any) => item.status === "pending" || item.status === "approved").map((item: any) => <option key={item.id} value={item.id}>{item.title} · {item.amount != null && Number.isFinite(Number(item.amount)) ? formatCurrencySymbolFirst(item.amount, item.currency ?? "USD") : item.amount ?? "amount pending"}</option>)}</select>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>{(WEBSITE_CONFIG.capabilities?.paymentMethods ?? []).map((method: string) => <option key={method}>{method}</option>)}</select>
                <input placeholder={WEBSITE_CONFIG.capabilities?.paymentEvidence ? "Proof / receipt reference (required)" : "Proof / receipt reference (optional)"} value={paymentProof} onChange={e => setPaymentProof(e.target.value)} required={WEBSITE_CONFIG.capabilities?.paymentEvidence} style={{ ...inputStyle, marginBottom: 8 }} />
                <button type="submit" style={btnStyle}>Submit payment</button>
              </form>}
             {(WEBSITE_CONFIG.type === "tracking" || WEBSITE_CONFIG.type === "logistics") && <form onSubmit={handleTracking} style={{ marginBottom: "1rem" }}>
               <input type="text" placeholder="Enter tracking number" value={trackingNum} onChange={e => setTrackingNum(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
               <button type="submit" style={btnStyle}>Track Shipment</button>
             </form>}
             {(WEBSITE_CONFIG.type === "tracking" || WEBSITE_CONFIG.type === "logistics") && trackingResult?.error && <p style={{ color: "#f87171", marginTop: 8 }}>{trackingResult.error}</p>}
             {(WEBSITE_CONFIG.type === "tracking" || WEBSITE_CONFIG.type === "logistics") && trackingResult?.shipment && (
               <div style={{ background: "var(--theme-background)", borderRadius: 10, padding: "1rem", marginTop: "1rem" }}>
                 <p style={{ color: "var(--theme-text)", fontWeight: 600 }}>Tracking: {trackingResult.shipment.trackingNumber}</p>
                 <p style={{ color: "var(--theme-mutedText)" }}>Status: {trackingResult.shipment.status.replace(/_/g, " ")}</p>
                 <p style={{ color: "var(--theme-mutedText)" }}>Recipient: {trackingResult.shipment.recipientName}</p>
                {trackingResult.events?.map((ev: any) => (
                   <div key={ev.id} style={{ borderTop: "1px solid var(--theme-border)", paddingTop: 8, marginTop: 8 }}>
                     <p style={{ color: "var(--theme-mutedText)", fontSize: "0.8rem", margin: 0 }}>{new Date(ev.timestamp).toLocaleString()}</p>
                     <p style={{ color: "var(--theme-text)", fontSize: "0.875rem", margin: "2px 0 0" }}>{ev.description ?? ev.status} {ev.location ? `— ${ev.location}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
            <button onClick={resetCustomerState} style={{ ...btnStyle, background: "var(--theme-surface-soft)", color: "var(--theme-text)", marginTop: "1rem" }}>Logout</button>
          </div>
        )}

         {mode === "forgot" && (
           <form onSubmit={handleForgot}>
              <p style={{ color: "var(--theme-mutedText)", fontSize: "0.9rem", lineHeight: 1.5 }}>Enter your email and we will send a one-time password reset token when SMTP is configured.</p>
             <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={{ ...inputStyle, marginBottom: 16 }} />
              {error && <p style={{ color: "var(--theme-text)", fontSize: "0.875rem", marginBottom: 12 }}>{error}</p>}
             <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Sending…" : "Send reset instructions"}</button>
              <button type="button" onClick={() => { setMode("login"); setError(""); }} style={{ ...btnStyle, background: "var(--theme-surface-soft)", color: "var(--theme-text)", marginTop: 10 }}>Back to Login</button>
           </form>
         )}

         {mode === "reset" && (
           <form onSubmit={handleReset}>
              <p style={{ color: "var(--theme-mutedText)", fontSize: "0.9rem", lineHeight: 1.5 }}>Paste the one-time token from your email and choose a new password.</p>
             <input type="text" placeholder="Reset token" value={resetToken} onChange={e => setResetToken(e.target.value)} required style={{ ...inputStyle, marginBottom: 10 }} />
             <input type="password" placeholder="New password (12+ characters)" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputStyle, marginBottom: 16 }} />
              {error && <p style={{ color: "var(--theme-text)", fontSize: "0.875rem", marginBottom: 12 }}>{error}</p>}
             <button type="submit" disabled={loading} style={btnStyle}>{loading ? "Resetting…" : "Reset password"}</button>
              <button type="button" onClick={() => { setMode("login"); setError(""); }} style={{ ...btnStyle, background: "var(--theme-surface-soft)", color: "var(--theme-text)", marginTop: 10 }}>Back to Login</button>
           </form>
         )}

         {(mode === "login" || mode === "register") && (
          <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
            {mode === "register" && (
              <>
                <input type="text" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required style={{ ...inputStyle, marginBottom: 10 }} />
                <input type="text" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} required style={{ ...inputStyle, marginBottom: 10 }} />
                 {WEBSITE_CONFIG.capabilities?.country !== "hidden" && <input type="text" placeholder={WEBSITE_CONFIG.capabilities?.country === "required" ? "Country (required)" : "Country (optional)"} value={country} onChange={e => setCountry(e.target.value)} required={WEBSITE_CONFIG.capabilities?.country === "required"} style={{ ...inputStyle, marginBottom: 10 }} />}
                 {WEBSITE_CONFIG.capabilities?.transactionPin && <input inputMode="numeric" pattern="[0-9]{4,6}" placeholder="Transaction PIN (4-6 digits)" value={transactionPin} onChange={e => setTransactionPin(e.target.value)} required style={{ ...inputStyle, marginBottom: 10 }} />}
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start", color: "var(--theme-text)", fontSize: ".8rem", marginBottom: 10 }}><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} required /> I accept the Terms & Conditions and Privacy Policy.</label>
              </>
            )}
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={{ ...inputStyle, marginBottom: 10 }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ ...inputStyle, marginBottom: 16 }} />
            {error && <p style={{ color: mode === "register" ? "#34d399" : "#f87171", fontSize: "0.875rem", marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={loading} style={btnStyle}>{mode === "login" ? "Sign In" : "Create Account"}</button>
             <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }} style={{ ...btnStyle, background: "var(--theme-surface-soft)", color: "var(--theme-text)", marginTop: 10 }}>
              {mode === "login" ? "Create Account" : "Back to Login"}
            </button>
              {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setError(""); }} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--theme-mutedText)", cursor: "pointer", textDecoration: "underline" }}>Forgot password?</button>}
          </form>
        )}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--theme-mutedText)", fontSize: "0.85rem", cursor: "pointer" }}>← Back to Admin Login</button>
        </div>
      </div>
    </div>
  );
}
