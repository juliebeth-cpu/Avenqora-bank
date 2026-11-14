import { Fragment, useEffect, useState } from "react";
import { WEBSITE_CONFIG } from "../config";

const panelStyle: React.CSSProperties = { background: "var(--theme-background)", border: "1px solid var(--theme-border)", borderRadius: 12, padding: "1rem", marginBottom: 12 };
const fieldStyle: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: ".7rem .8rem", marginBottom: 8, borderRadius: 8, border: "1px solid var(--theme-border)", background: "var(--theme-input-background)", color: "var(--theme-text)" };

function customerHeaders() {
  return { Authorization: "Bearer " + (localStorage.getItem("customer_token") ?? "") };
}

function adminHeaders() {
  return { Authorization: "Bearer " + (localStorage.getItem("admin_token") ?? "") };
}

export function BankingCustomerPanel() {
  const [info, setInfo] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [credit, setCredit] = useState<any>(null);
  const [actionType, setActionType] = useState("bill_payment");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({});
  const [transactionPin, setTransactionPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const paths = [
      "/api/banking/customer/info",
      "/api/workflows/customer/accounts",
      "/api/banking/customer/actions",
      "/api/banking/customer/credit-score",
    ];
    const responses = await Promise.all(paths.map(path => fetch(path, { headers: customerHeaders() })));
    const payloads = await Promise.all(responses.map(response => response.json().catch(() => null)));
    setInfo(responses[0].ok ? payloads[0] : null);
    setAccounts(responses[1].ok && Array.isArray(payloads[1]) ? payloads[1] : []);
    setActions(responses[2].ok && Array.isArray(payloads[2]) ? payloads[2] : []);
    setCredit(responses[3].ok ? payloads[3] : null);
    const firstAccount = responses[1].ok && Array.isArray(payloads[1]) ? payloads[1][0] : null;
    if (firstAccount && !accountId) setAccountId(String(firstAccount.id));
    if (payloads[0]?.bankingRegion === "EUROPE") setActionType("sending_order");
    if (!responses[0].ok) setError(payloads[0]?.error ?? "Banking actions could not be loaded.");
  }

  useEffect(() => { void load().catch(() => setError("Banking actions could not be loaded.")); }, []);

  const types = info?.bankingRegion === "USA"
    ? ["bill_payment", "zelle"]
    : info?.bankingRegion === "EUROPE" ? ["sending_order"] : [];
  const fields: Record<string, Array<{ key: string; label: string; required?: boolean }>> = {
    bill_payment: [
      { key: "billerName", label: "Biller name", required: true },
      { key: "billAccountReference", label: "Bill account reference", required: true },
      { key: "note", label: "Note (optional)" },
    ],
    zelle: [
      { key: "recipientName", label: "Recipient name", required: true },
      { key: "recipientContact", label: "Recipient email or phone", required: true },
      { key: "note", label: "Note (optional)" },
    ],
    sending_order: [
      { key: "recipientName", label: "Recipient name", required: true },
      { key: "bankName", label: "Bank name", required: true },
      { key: "recipientIban", label: "IBAN or account number", required: true },
      { key: "recipientCountry", label: "Recipient country", required: true },
      { key: "swiftBic", label: "SWIFT / BIC (optional)" },
      { key: "note", label: "Note (optional)" },
    ],
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const detailsForType = Object.fromEntries(
      (fields[actionType] ?? []).filter(field => details[field.key]?.trim()).map(field => [field.key, details[field.key].trim()]),
    );
    try {
      const response = await fetch("/api/banking/customer/actions", {
        method: "POST",
        headers: { ...customerHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType,
          accountId: Number(accountId),
          amount: Number(amount),
          details: detailsForType,
          transactionPin,
          ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Request could not be submitted.");
      setAmount("");
      setDueAt("");
      setDetails({});
      setTransactionPin("");
      setError("Request submitted for review.");
      await load();
    } catch (failure: any) {
      setError(failure?.message ?? "Request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return <section style={panelStyle} aria-label="Banking actions and credit score">
    <h3 style={{ color: "var(--theme-text)", margin: "0 0 .4rem" }}>Banking actions</h3>
    <p style={{ color: "var(--theme-mutedText)", margin: "0 0 1rem", fontSize: ".85rem" }}>
      {info?.bankingRegion ? "Available for your " + info.bankingRegion + " banking region. Requests are reviewed before processing." : "Checking banking availability…"}
    </p>
    {info?.transactionPinSet === false && <p role="status" style={{ color: "#b45309" }}>Set a transaction PIN above before submitting an action.</p>}
    {types.length > 0 ? <form onSubmit={submit}>
      <label style={{ display: "block", color: "var(--theme-mutedText)", fontSize: ".8rem" }}>Action
        <select aria-label="Banking action type" value={actionType} onChange={event => { setActionType(event.target.value); setDetails({}); }} style={fieldStyle}>
          {types.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label style={{ display: "block", color: "var(--theme-mutedText)", fontSize: ".8rem" }}>Account
        <select aria-label="Account" value={accountId} onChange={event => setAccountId(event.target.value)} required style={fieldStyle}>
          <option value="">Choose an account</option>
          {accounts.map(account => <option key={account.id} value={account.id}>{account.account_number ?? account.accountNumber ?? ("Account " + account.id)} · {account.currency} · {account.status}</option>)}
        </select>
      </label>
      <input aria-label="Amount" type="number" min="0.0001" step="0.0001" max="1000000000" placeholder="Amount" value={amount} onChange={event => setAmount(event.target.value)} required style={fieldStyle} />
      {(fields[actionType] ?? []).map(field => <input
        key={field.key}
        aria-label={field.label}
        placeholder={field.label}
        required={Boolean(field.required)}
        maxLength={field.key === "note" ? 500 : field.key === "recipientIban" ? 34 : 254}
        value={details[field.key] ?? ""}
        onChange={event => setDetails(current => ({ ...current, [field.key]: event.target.value }))}
        style={fieldStyle}
      />)}
      {actionType === "bill_payment" && <label style={{ display: "block", color: "var(--theme-mutedText)", fontSize: ".8rem" }}>Due date (optional)
        <input aria-label="Due date" type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} style={fieldStyle} />
      </label>}
      <input aria-label="Transaction PIN" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4,6}" minLength={4} maxLength={6} placeholder="Transaction PIN" value={transactionPin} onChange={event => setTransactionPin(event.target.value)} required style={fieldStyle} />
      {actionType !== "bill_payment" && <p style={{ color: "var(--theme-mutedText)", fontSize: ".8rem" }}>This request is for internal review only; approval does not send an external payment.</p>}
      <button type="submit" disabled={busy || !accounts.length} style={{ padding: ".7rem 1rem", background: WEBSITE_CONFIG.primaryColor, color: "#fff", border: 0, borderRadius: 8, cursor: busy ? "wait" : "pointer" }}>{busy ? "Submitting…" : "Submit banking request"}</button>
    </form> : <p style={{ color: "var(--theme-mutedText)" }}>{info?.bankingRegion ? "No banking actions are available for this region." : "Banking region is not configured for this customer."}</p>}
    {error && <p role="status" style={{ color: error.includes("submitted") ? "#059669" : "#dc2626" }}>{error}</p>}
    <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--theme-border)", paddingTop: "1rem" }}>
      <h4 style={{ color: "var(--theme-text)", margin: "0 0 .5rem" }}>Your requests</h4>
      {actions.length ? actions.map(action => <article key={action.id} style={{ borderBottom: "1px solid var(--theme-border)", padding: ".65rem 0", color: "var(--theme-text)" }}>
        <strong>{action.actionType.replaceAll("_", " ")} · {action.amount} {action.currency}</strong>
        <div style={{ color: "var(--theme-mutedText)", fontSize: ".8rem" }}>{action.reference} · {action.status} · {new Date(action.createdAt).toLocaleString()}</div>
        {action.adminNotes && <div style={{ color: "var(--theme-mutedText)", fontSize: ".8rem" }}>Review note: {action.adminNotes}</div>}
      </article>) : <p style={{ color: "var(--theme-mutedText)" }}>No banking requests yet.</p>}
    </div>
    <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--theme-border)", paddingTop: "1rem" }}>
      <h4 style={{ color: "var(--theme-text)", margin: "0 0 .5rem" }}>Credit score</h4>
      {credit ? <><p style={{ color: "var(--theme-text)", fontSize: "1.4rem", fontWeight: 700, margin: ".3rem 0" }}>{credit.score}</p><p style={{ color: "var(--theme-mutedText)", fontSize: ".8rem", margin: "0 0 .5rem" }}>Baseline: {credit.baseline}. Score changes reflect successful reviewed payments.</p>
        {(credit.history ?? []).map((entry: any) => <div key={entry.id} style={{ borderTop: "1px solid var(--theme-border)", padding: ".55rem 0", color: "var(--theme-mutedText)", fontSize: ".82rem" }}>{entry.description} · +{entry.pointsDelta} · {entry.scoreBefore} → {entry.scoreAfter}</div>)}
      </> : <p style={{ color: "var(--theme-mutedText)" }}>Credit score history is not available.</p>}
    </div>
  </section>;
}

export function BankingActionsAdmin() {
  const [actions, setActions] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const response = await fetch("/api/banking/admin/actions", { headers: adminHeaders() });
    const payload = await response.json().catch(() => []);
    if (!response.ok) throw new Error(payload?.error ?? "Banking requests could not be loaded.");
    setActions(Array.isArray(payload) ? payload : []);
  }
  useEffect(() => { void load().catch(failure => setError(failure.message)); }, []);

  async function review(action: any, status: "approved" | "rejected" | "refunded") {
    const adminNotes = status === "rejected" || status === "refunded"
      ? window.prompt(status === "rejected" ? "Reason for rejection (required)" : "Reason for refund (required)")?.trim()
      : "";
    if ((status === "rejected" || status === "refunded") && !adminNotes) return;
    setBusyId(action.id); setError("");
    try {
      const response = await fetch("/api/banking/admin/actions/" + action.id, {
        method: "PATCH",
        headers: { ...adminHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Request review failed.");
      await load();
    } catch (failure: any) {
      setError(failure.message ?? "Request review failed.");
    } finally {
      setBusyId(null);
    }
  }

  return <section aria-label="Review banking requests">
    <h2 style={{ fontSize: "1.5rem", margin: "0 0 .5rem" }}>Banking requests</h2>
    <p style={{ color: "#94a3b8", marginTop: 0 }}>Review tenant-scoped customer requests. Zelle and sending orders are internal review requests; approval does not send an external payment.</p>
    {error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
    {!actions.length && !error && <p style={{ color: "#94a3b8" }}>No banking requests yet.</p>}
    {actions.map(action => <article key={action.id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "1rem", marginBottom: ".75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <strong>{action.actionType.replaceAll("_", " ")} · {action.amount} {action.currency}</strong>
        <span>{action.status}</span>
      </div>
      <p style={{ color: "#94a3b8", margin: ".45rem 0" }}>{action.customerName} · {action.accountLabel ?? "Account"} · {action.bankingRegion} · {action.reference}</p>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: ".25rem .75rem", margin: ".5rem 0", color: "#cbd5e1", fontSize: ".85rem" }}>
        {Object.entries(action.details ?? {}).map(([key, value]) => <Fragment key={key}><dt>{key.replaceAll(/([A-Z])/g, " $1")}</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}>{String(value)}</dd></Fragment>)}
      </dl>
      {action.adminNotes && <p style={{ color: "#cbd5e1" }}>Review note: {action.adminNotes}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {action.status === "pending" && <><button type="button" disabled={busyId === action.id} onClick={() => void review(action, "approved")}>Approve</button><button type="button" disabled={busyId === action.id} onClick={() => void review(action, "rejected")}>Reject</button></>}
        {action.status === "approved" && <button type="button" disabled={busyId === action.id} onClick={() => void review(action, "refunded")}>Refund</button>}
      </div>
    </article>)}
  </section>;
}
