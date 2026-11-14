import { useEffect, useState } from "react";

const headers = () => ({ Authorization: "Bearer " + (localStorage.getItem("admin_token") ?? "") });
export default function BankingDepositsAdmin() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  async function refresh() {
    const response = await fetch("/api/banking/admin/deposits", { headers: headers() });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to load deposits");
    setDeposits(Array.isArray(data) ? data : []);
  }
  useEffect(() => { void refresh().catch((reason) => setError(reason.message)); }, []);
  async function review(item: any, status: "approved" | "rejected") {
    setError("");
    const adminNotes = notes[item.id] ?? "";
    const response = await fetch("/api/banking/admin/deposits/" + item.id, { method: "PATCH", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify({ status, adminNotes }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Unable to review deposit"); return; }
    await refresh();
  }
  async function openReceipt(item: any) {
    const response = await fetch("/api/banking/admin/deposits/" + item.id + "/receipt-file", { headers: headers() });
    if (!response.ok) { setError((await response.json()).error ?? "Receipt unavailable"); return; }
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  return <section style={{ color: "#e2e8f0" }}><h2>Deposit review</h2>{error && <p role="alert" style={{ color: "#f87171" }}>{error}</p>}
    {!deposits.length && <p style={{ color: "#94a3b8" }}>No deposit requests.</p>}
    {deposits.map((item) => <article key={item.id} style={{ borderTop: "1px solid #334155", padding: "14px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><strong>{item.customer_name} · {item.reference}</strong><span>{item.status} · {item.currency} {Number(item.amount).toFixed(4)}</span></div>
      <p style={{ color: "#94a3b8" }}>Fee {Number(item.fee ?? 0).toFixed(4)} · Net {Number(item.net_amount ?? item.amount).toFixed(4)} · {item.method}</p>
      {item.receipt_url && <button type="button" onClick={() => void openReceipt(item)}>View receipt</button>}
      {!["approved", "rejected", "expired", "cancelled"].includes(item.status) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <input aria-label={"Review note for " + item.reference} maxLength={1000} value={notes[item.id] ?? ""} onChange={(event) => setNotes((value) => ({ ...value, [item.id]: event.target.value }))} placeholder="Rejection reason (required to reject)" />
        <button type="button" onClick={() => void review(item, "approved")}>Approve</button>
        <button type="button" onClick={() => void review(item, "rejected")} disabled={!(notes[item.id] ?? "").trim()}>Reject</button>
      </div>}
    </article>)}
  </section>;
}
