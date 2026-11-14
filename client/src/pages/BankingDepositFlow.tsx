import { useEffect, useMemo, useState } from "react";

const headers = () => ({ Authorization: "Bearer " + (localStorage.getItem("customer_token") ?? "") });
async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } });
  const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error ?? "Request failed");
  return body;
}
const money = (amount: number, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount); }
  catch { return currency + " " + amount.toFixed(4); }
}
const panel: React.CSSProperties = { background: "var(--theme-card, #172033)", border: "1px solid var(--theme-border, #334155)", borderRadius: 10, padding: 18, marginBottom: 14 };
const input: React.CSSProperties = { width: "100%", minHeight: 42, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--theme-border, #475569)", background: "var(--theme-input-background, #0f172a)", color: "var(--theme-text, #f8fafc)" };

export default function BankingDepositFlow() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [methods, setMethods] = useState<any[]>([]);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [receivingAccounts, setReceivingAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [receivingBankAccountId, setReceivingBankAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionPin, setTransactionPin] = useState("");
  const [activeDeposit, setActiveDeposit] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const accounts = (dashboard?.accounts ?? []).filter((item: any) => item.status === "active");
  const selectedAccount = accounts.find((item: any) => String(item.id) === accountId);
  const currency = String(selectedAccount?.currency ?? "USD").toUpperCase();
  const eligibleReceiving = receivingAccounts.filter((item: any) => item.currency === currency);
  const selectedReceiving = eligibleReceiving.find((item: any) => String(item.id) === receivingBankAccountId);
  const sessionExpired = Boolean(activeDeposit?.status === "pending" && !activeDeposit.receiptUrl && activeDeposit.sessionExpiresAt && new Date(activeDeposit.sessionExpiresAt).getTime() <= now);
  const countdown = useMemo(() => {
    if (!activeDeposit?.sessionExpiresAt) return "No expiry set for this legacy deposit";
    const seconds = Math.max(0, Math.ceil((new Date(activeDeposit.sessionExpiresAt).getTime() - now) / 1000));
    if (!seconds) return "Expired";
    return Math.floor(seconds / 3600) + "h " + Math.floor(seconds % 3600 / 60) + "m " + seconds % 60 + "s";
  }, [activeDeposit?.sessionExpiresAt, now]);
  const gross = Number(amount) || 0;
  const fee = Math.round(gross * 0.0005 * 10000) / 10000;

  async function refresh() {
    const [dashboardData, depositMethods, bankAccounts, deposits] = await Promise.all([
      request("/api/customer/dashboard"),
      request("/api/customer/deposit-methods"),
      request("/api/customer/deposit-bank-accounts"),
      request("/api/customer/deposits"),
    ]);
    setDashboard(dashboardData);
    setDepositHistory(deposits);
    const serverTime = Date.parse(dashboardData.serverTime);
    setServerOffset(Number.isFinite(serverTime) ? serverTime - Date.now() : 0);
    setMethods(depositMethods);
    setReceivingAccounts(bankAccounts);
    if (!accountId && dashboardData.accounts?.length) setAccountId(String(dashboardData.accounts.find((item: any) => item.status === "active")?.id ?? ""));
    const resumeId = new URLSearchParams(window.location.search).get("resumeDepositId");
    if (resumeId) setActiveDeposit((dashboardData.resumableDeposits ?? []).find((item: any) => String(item.id) === resumeId) ?? deposits.find((item: any) => String(item.id) === resumeId) ?? null);
  }

  useEffect(() => { void refresh().catch((error) => setMessage(error.message)); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now() + serverOffset), 1000); return () => window.clearInterval(timer); }, [serverOffset]);

  async function submitDeposit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const created = await request("/api/customer/deposits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: Number(accountId), amount: Number(amount), currency, method, receivingBankAccountId: receivingBankAccountId ? Number(receivingBankAccountId) : undefined, transactionPin }) });
      setActiveDeposit(created); setAmount(""); setTransactionPin(""); setReceiptFile(null); await refresh();
      setMessage("Deposit request submitted. Your balance will update after review.");
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function uploadReceipt() {
    if (!activeDeposit || !receiptFile || sessionExpired) return;
    setBusy(true); setMessage("");
    try {
      const target = await request("/api/customer/deposits/" + activeDeposit.id + "/receipt-upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const uploaded = await fetch(target.uploadURL, { method: "PUT", headers: { "Content-Type": receiptFile.type }, body: receiptFile });
      const result = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok) throw new Error(result.error ?? "Receipt upload failed");
      setActiveDeposit((current: any) => ({ ...current, status: "processing", receiptUrl: result.receiptUrl }));
      setReceiptFile(null); await refresh(); setMessage("Receipt submitted for review.");
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function openReceipt() {
    if (!activeDeposit?.receiptUrl) return;
    try {
      const response = await fetch(activeDeposit.receiptUrl, { headers: headers() });
      if (!response.ok) throw new Error("Receipt is unavailable");
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error: any) { setMessage(error.message); }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Copied to clipboard."); }
    catch { setMessage("Copy is unavailable in this browser."); }
  }

  return <section aria-label="Banking deposits" style={{ maxWidth: 820, margin: "0 auto", padding: 16, color: "var(--theme-text, #f8fafc)" }}>
    <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Deposits</h2>
    <p style={{ color: "var(--theme-mutedText, #94a3b8)", marginTop: 0 }}>Choose a deposit method and follow its status here.</p>
    {(dashboard?.resumableDeposits ?? []).length > 0 && <div style={panel}>
      <h3 style={{ marginTop: 0 }}>Resume a deposit</h3>
      {(dashboard.resumableDeposits ?? []).map((item: any) => <button key={item.id} type="button" onClick={() => { setActiveDeposit(item); setMessage(""); }} style={{ ...input, textAlign: "left", marginBottom: 8, cursor: "pointer" }}>{item.reference} · {money(Number(item.amount), item.currency)} · {item.status}</button>)}
    </div>}
    {activeDeposit ? <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><h3 style={{ margin: 0 }}>Deposit {activeDeposit.reference}</h3><button type="button" onClick={() => { setActiveDeposit(null); setMessage(""); }} style={{ ...input, width: "auto", cursor: "pointer" }}>New deposit</button></div>
      {activeDeposit.status === "pending" && !activeDeposit.receiptUrl && <p role="timer" aria-live="polite" style={{ color: sessionExpired ? "#ef4444" : "#f59e0b" }}>Time remaining: {countdown}</p>}
      {activeDeposit.receivingBankAccountSnapshot && <div role="alert" style={{ ...panel, background: "#fcd34d", borderColor: "#f59e0b", color: "#111827" }}>
        <strong>Verify the receiving bank details before sending funds.</strong>
        <p>Only transfer to the account displayed here. Do not send funds to personal accounts provided through unofficial messages.</p>
        {[["Bank", "bankName"], ["Account holder", "accountName"], ["Account number", "accountNumber"], ["Currency", "currency"], ["Country", "country"], ["Routing number", "routingNumber"], ["IBAN", "iban"], ["SWIFT / BIC", "swiftBic"], ["Bank address", "bankAddress"]].map(([label, key]) => activeDeposit.receivingBankAccountSnapshot[key] && <p key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10, overflowWrap: "anywhere" }}><span><small>{label}</small><br /><strong>{activeDeposit.receivingBankAccountSnapshot[key]}</strong></span><button type="button" onClick={() => void copy(activeDeposit.receivingBankAccountSnapshot[key])} aria-label={"Copy " + label} title={"Copy " + label}>Copy</button></p>)}
      </div>}
      <div style={panel}>
        <p>Gross amount: <strong>{money(Number(activeDeposit.amount), activeDeposit.currency)}</strong></p>
        <p>Transaction fee: <strong>{money(Number(activeDeposit.fee ?? 0), activeDeposit.currency)}</strong></p>
        <p>Net amount after approval: <strong>{money(Number(activeDeposit.netAmount ?? activeDeposit.amount), activeDeposit.currency)}</strong></p>
        <p>Method: {String(activeDeposit.method ?? "").replaceAll("_", " ")} · Status: {sessionExpired ? "Expired" : activeDeposit.status}</p>
        {activeDeposit.paymentInstructions && <p style={{ whiteSpace: "pre-wrap" }}>{activeDeposit.paymentInstructions}</p>}
        {activeDeposit.receiptUrl && <button type="button" onClick={() => void openReceipt()}>View submitted receipt</button>}
      </div>
      {activeDeposit.status === "pending" && !activeDeposit.receiptUrl && !sessionExpired && <div style={panel}>
        <label style={{ display: "block", marginBottom: 8 }}>Payment receipt (JPEG, PNG, WEBP, PDF; max 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} style={{ display: "block", marginTop: 8 }} /></label>
        <button type="button" disabled={!receiptFile || busy} onClick={() => void uploadReceipt()} style={{ ...input, cursor: busy ? "wait" : "pointer" }}>{busy ? "Uploading…" : "Submit receipt"}</button>
      </div>}
    </div> : <form onSubmit={submitDeposit} style={panel}>
      <label style={{ display: "block", marginBottom: 12 }}>Account<select required value={accountId} onChange={(event) => { setAccountId(event.target.value); setReceivingBankAccountId(""); }} style={{ ...input, display: "block", marginTop: 6 }}>{accounts.map((item: any) => <option key={item.id} value={item.id}>{item.account_number ?? item.accountNumber} · {item.currency} · {item.status}</option>)}</select></label>
      <label style={{ display: "block", marginBottom: 12 }}>Deposit method<select required value={method} onChange={(event) => { setMethod(event.target.value); setReceivingBankAccountId(""); }} style={{ ...input, display: "block", marginTop: 6 }}>{methods.map((item: any) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {method === "bank_transfer" && eligibleReceiving.length > 0 && <label style={{ display: "block", marginBottom: 12 }}>Receiving bank account<select required value={receivingBankAccountId} onChange={(event) => setReceivingBankAccountId(event.target.value)} style={{ ...input, display: "block", marginTop: 6 }}><option value="">Select receiving account</option>{eligibleReceiving.map((item: any) => <option key={item.id} value={item.id}>{item.displayName} · {item.bankName} · {item.currency}</option>)}</select></label>}
      {selectedReceiving && <div role="alert" style={{ ...panel, background: "#fcd34d", borderColor: "#f59e0b", color: "#111827" }}><strong>IMPORTANT PAYMENT WARNING</strong><p>Verify the receiving bank details carefully. Only send funds to this account.</p>{[["Bank", "bankName"], ["Account holder", "accountName"], ["Account number", "accountNumber"], ["Currency", "currency"], ["Country", "country"], ["Routing number", "routingNumber"], ["IBAN", "iban"], ["SWIFT / BIC", "swiftBic"], ["Bank address", "bankAddress"], ["Instructions", "instructions"]].map(([label, key]) => selectedReceiving[key] && <p key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10, overflowWrap: "anywhere" }}><span><small>{label}</small><br /><strong>{selectedReceiving[key]}</strong></span><button type="button" onClick={() => void copy(selectedReceiving[key])} aria-label={"Copy " + label} title={"Copy " + label}>Copy</button></p>)}</div>}
      <label style={{ display: "block", marginBottom: 12 }}>Amount ({currency})<input required type="number" min="0.01" max="1000000000" step="0.0001" value={amount} onChange={(event) => setAmount(event.target.value)} style={{ ...input, display: "block", marginTop: 6 }} /></label>
      {gross > 0 && <div style={{ ...panel, marginBottom: 12 }}><p>Gross amount: <strong>{money(gross, currency)}</strong></p><p>Estimated fee (0.05%): <strong>{money(fee, currency)}</strong></p><p>Net amount after approval: <strong>{money(Math.max(0, gross - fee), currency)}</strong></p></div>}
      <label style={{ display: "block", marginBottom: 12 }}>Transaction PIN<input required inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4,6}" minLength={4} maxLength={6} value={transactionPin} onChange={(event) => setTransactionPin(event.target.value)} style={{ ...input, display: "block", marginTop: 6 }} /></label>
      <button type="submit" disabled={busy || !accounts.length} style={{ ...input, cursor: busy ? "wait" : "pointer" }}>{busy ? "Submitting…" : "Create deposit request"}</button>
    </form>}
    {depositHistory.length > 0 && <div style={panel}>
      <h3 style={{ marginTop: 0 }}>Recent deposits</h3>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>{depositHistory.map((item: any) => <button key={item.id} type="button" onClick={() => { setActiveDeposit(item); setMessage(""); }} style={{ ...input, display: "block", textAlign: "left", marginBottom: 8, cursor: "pointer" }}>{item.reference} · {money(Number(item.amount), item.currency)} · {item.status}{item.receiptUrl ? " · receipt on file" : ""}</button>)}</div>
    </div>}
    {message && <p role="status" style={{ color: /submitted|copied/i.test(message) ? "#16a34a" : "#ef4444" }}>{message}</p>}
  </section>;
}
