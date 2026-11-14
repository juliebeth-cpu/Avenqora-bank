import { useState, useEffect } from "react";
import { WEBSITE_CONFIG } from "../config";
import { BankingActionsAdmin } from "./BankingActions";
import BankingDepositsAdmin from "./BankingDepositsAdmin";
import OwnerContentManager from "./OwnerContentManager";

interface Props { onLogout: () => void; }

function authHeaders() {
  return { "Authorization": `Bearer ${localStorage.getItem("admin_token") ?? ""}` };
}

export default function AdminDashboard({ onLogout }: Props) {
  const [tab, setTab] = useState<"dashboard" | "customers" | "shipments" | "accounts" | "workflow" | "referrals" | "features" | "email" | "banking-actions" | "deposits" | "content">("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [shipments, setShipments] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
   const [featureData, setFeatureData] = useState<any>(null);
  const [emailSettings, setEmailSettings] = useState<any>(null);
   const [workflowOverview, setWorkflowOverview] = useState<any>(null);
   const [workflowRecords, setWorkflowRecords] = useState<any[]>([]);
   const [workflowPayments, setWorkflowPayments] = useState<any[]>([]);
   const [workflowKyc, setWorkflowKyc] = useState<any[]>([]);
   const [referralData, setReferralData] = useState<any>({ settings: { enabled: false, bonusType: "percentage", bonusValue: 0, minDeposit: 0, maxReward: 0, currency: "USD", rules: "" }, stats: {}, topReferrers: [], rewards: [] });
  const adminInfo = JSON.parse(localStorage.getItem("admin_info") ?? "{}");

  useEffect(() => {
    fetch("/api/portal/dashboard", { headers: authHeaders() }).then(r => r.json()).then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
     if (tab === "customers") fetch("/api/workflows/admin/customers", { headers: authHeaders() }).then(r => r.json()).then(data => setCustomers(Array.isArray(data) ? data : []));
    if (tab === "shipments") fetch("/api/portal/shipments", { headers: authHeaders() }).then(r => r.json()).then(setShipments);
    if (tab === "accounts") fetch("/api/portal/accounts", { headers: authHeaders() }).then(r => r.json()).then(setAccounts);
     if (tab === "workflow") Promise.all([
       fetch("/api/workflows/admin/overview", { headers: authHeaders() }).then(r => r.json()),
       fetch("/api/workflows/admin/records", { headers: authHeaders() }).then(r => r.json()),
       fetch("/api/workflows/admin/payments", { headers: authHeaders() }).then(r => r.json()),
       fetch("/api/workflows/admin/kyc", { headers: authHeaders() }).then(r => r.json()),
     ]).then(([overview, records, payments, kyc]) => { setWorkflowOverview(overview); setWorkflowRecords(Array.isArray(records) ? records : []); setWorkflowPayments(Array.isArray(payments) ? payments : []); setWorkflowKyc(Array.isArray(kyc) ? kyc : []); });
     if (tab === "features") fetch("/api/features/tables", { headers: authHeaders() }).then(r => r.json()).then(setFeatureData);
    if (tab === "email") fetch("/api/email/settings", { headers: authHeaders() }).then(r => r.json()).then(setEmailSettings);
    if (tab === "referrals") fetch("/api/workflows/admin/referrals", { headers: authHeaders() }).then(r => r.json()).then(data => { if (data && !data.error) setReferralData(data); });
  }, [tab]);

  async function saveEmailSettings() {
    const response = await fetch("/api/email/settings", { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ email: emailSettings }) });
    if (!response.ok) { alert((await response.json()).error ?? "Unable to save email settings"); return; }
    setEmailSettings((await response.json()));
    alert("Email settings saved");
  }

   async function resetCustomerPassword(customerId: number) {
     const password = window.prompt("Set a new password (12+ characters):");
     if (!password) return;
     const response = await fetch("/api/portal/customers/" + customerId + "/reset-password", {
       method: "POST",
       headers: { ...authHeaders(), "Content-Type": "application/json" },
       body: JSON.stringify({ password }),
     });
     const data = await response.json();
     if (!response.ok) { alert(data.error ?? "Unable to reset password"); return; }
     alert("Customer password reset successfully");
   }
   async function updateCustomerStatus(customerId: number, status: string) {
     const response = await fetch("/api/workflows/admin/customers/" + customerId, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
     const data = await response.json();
     if (!response.ok) { alert(data.error ?? "Unable to update customer"); return; }
     setCustomers(items => items.map(item => item.id === customerId ? { ...item, ...data } : item));
   }
   async function updateWorkflow(path: string, body: any) {
     const response = await fetch(path, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
     const data = await response.json();
     if (!response.ok) { alert(data.error ?? "Unable to update workflow"); return; }
     setWorkflowRecords(items => items.map(item => item.id === data.id ? data : item));
     setWorkflowPayments(items => items.map(item => item.id === data.id ? data : item));
     setWorkflowKyc(items => items.map(item => item.id === data.id ? data : item));
   }
   async function saveReferralSettings() {
     const response = await fetch("/api/workflows/admin/referrals/settings", { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(referralData.settings) });
     const data = await response.json();
     if (!response.ok) { alert(data.error ?? "Unable to save referral settings"); return; }
     setReferralData((current: any) => ({ ...current, settings: data }));
   }
   async function reviewReferral(item: any, status: string) {
     const response = await fetch("/api/workflows/admin/referrals/" + item.id, { method: "PATCH", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ status, source: item.source }) });
     const data = await response.json();
     if (!response.ok) { alert(data.error ?? "Unable to review referral"); return; }
     const updated = await fetch("/api/workflows/admin/referrals", { headers: authHeaders() }).then(r => r.json());
     if (!updated.error) setReferralData(updated);
   }
   async function downloadReferralReport() {
     const response = await fetch("/api/workflows/admin/referrals/export.csv", { headers: authHeaders() });
     if (!response.ok) { alert("Unable to export referral report"); return; }
     const url = URL.createObjectURL(await response.blob());
     const link = document.createElement("a"); link.href = url; link.download = "referral-report.csv"; link.click(); URL.revokeObjectURL(url);
   }
   async function openKycFile(id: number, slot: string) {
     const response = await fetch("/api/workflows/admin/kyc/" + id + "/file/" + slot, { headers: authHeaders() });
     if (!response.ok) { alert((await response.json()).error ?? "Document unavailable"); return; }
     const url = URL.createObjectURL(await response.blob()); window.open(url, "_blank", "noopener,noreferrer");
     window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
   }
    function privateEvidenceReference(metadata: any) {
      try {
        const value = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
        const reference = value?.evidenceObjectPath ?? value?.evidence_object_path ?? value?.proofObjectPath;
        return typeof reference === "string" && reference.startsWith("/_private-assets/") ? reference : null;
      } catch { return null; }
    }
    async function openPrivateAsset(reference: string) {
      const response = await fetch("/api/workflows/admin/private-asset?reference=" + encodeURIComponent(reference), { headers: authHeaders() });
      if (!response.ok) { alert((await response.json()).error ?? "Private document unavailable"); return; }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "payment-evidence"; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }

  const navBtnStyle = (active: boolean) => ({
    padding: "0.5rem 1rem", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600,
    fontSize: "0.875rem", background: active ? "#D4AF37" : "transparent", color: active ? "#fff" : "#94a3b8",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9" }}>
      {/* Header */}
      <header style={{ background: "#1e293b", borderBottom: "1px solid #334155", padding: "0 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {WEBSITE_CONFIG.logoUrl
            ? <img src={WEBSITE_CONFIG.logoUrl} alt="logo" style={{ height: 36, objectFit: "contain" }} />
            : <div style={{ width: 36, height: 36, borderRadius: 8, background: "#D4AF37", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16 }}>{WEBSITE_CONFIG.name.charAt(0)}</div>}
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{WEBSITE_CONFIG.name}</div>
            <div style={{ color: "#64748b", fontSize: "0.75rem" }}>Banking Portal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#64748b", fontSize: "0.875rem" }}>Welcome, {adminInfo.firstName ?? "Admin"}</span>
          <button onClick={onLogout} style={{ padding: "0.4rem 0.9rem", background: "#334155", border: "none", borderRadius: 6, color: "#f1f5f9", cursor: "pointer", fontSize: "0.875rem" }}>Logout</button>
        </div>
      </header>

      <div style={{ display: "flex", height: "calc(100vh - 64px)" }}>
        {/* Sidebar */}
        <aside style={{ width: 200, background: "#1e293b", borderRight: "1px solid #334155", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: 4 }}>
           {(["dashboard", "customers", "accounts", "shipments", "workflow", "features", "email"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={navBtnStyle(tab === t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
           {WEBSITE_CONFIG.type === "banking" && <button onClick={() => setTab("banking-actions")} style={navBtnStyle(tab === "banking-actions")}>Banking requests</button>}
           {WEBSITE_CONFIG.type === "banking" && <button onClick={() => setTab("deposits")} style={navBtnStyle(tab === "deposits")}>Deposits</button>}
           <button onClick={() => setTab("content")} style={navBtnStyle(tab === "content")}>Pages &amp; media</button>
          {["investment", "forex"].includes(WEBSITE_CONFIG.type) && <button onClick={() => setTab("referrals")} style={navBtnStyle(tab === "referrals")}>Referrals</button>}
        </aside>

        {/* Main */}
        <main style={{ flex: 1, overflow: "auto", padding: "2rem" }}>
          {tab === "dashboard" && (
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Dashboard Overview</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
                {[
                  { label: "Total Customers", value: stats?.customerCount ?? "—" },
                  { label: "Total Accounts", value: stats?.accountCount ?? "—" },
                  { label: "Total Shipments", value: stats?.shipmentCount ?? "—" },
                ].map(s => (
                  <div key={s.label} style={{ background: "#1e293b", borderRadius: 12, padding: "1.5rem", border: "1px solid #334155" }}>
                    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: "2rem", fontWeight: 700, color: "#D4AF37" }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#1e293b", borderRadius: 12, padding: "1.5rem", border: "1px solid #334155" }}>
                <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Website Information</h3>
                {[
                  ["Name", WEBSITE_CONFIG.name],
                  ["Type", "Banking Portal"],
                  ["Email", WEBSITE_CONFIG.companyEmail || "—"],
                  ["Phone", WEBSITE_CONFIG.companyPhone || "—"],
                  ["Address", WEBSITE_CONFIG.companyAddress || "—"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 12, padding: "0.5rem 0", borderBottom: "1px solid #334155" }}>
                    <span style={{ color: "#64748b", width: 120, flexShrink: 0 }}>{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "customers" && (
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Customers ({customers.length})</h2>
              <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "#0f172a" }}>
                       {["Name", "Email", "Phone", "Status", "Joined", "Actions"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={c.id} style={{ borderTop: "1px solid #334155", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>{c.firstName} {c.lastName}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{c.email}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{c.phone ?? "—"}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, background: c.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: c.status === "active" ? "#10b981" : "#ef4444" }}>
                            {c.status}
                          </span>
                        </td>
                         <td style={{ padding: "0.75rem 1rem", color: "#64748b" }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                         <td style={{ padding: "0.75rem 1rem" }}>
                           <select value={c.status} onChange={e => updateCustomerStatus(c.id, e.target.value)} style={{ marginRight: 6, padding: "0.35rem", background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 5, fontSize: ".75rem" }}>{["pending_approval","active","suspended","frozen","rejected"].map(status => <option key={status}>{status}</option>)}</select>
                           <button onClick={() => resetCustomerPassword(c.id)} style={{ padding: "0.35rem 0.6rem", background: "#334155", border: "none", borderRadius: 5, color: "#f1f5f9", cursor: "pointer", fontSize: "0.75rem" }}>Reset password</button>
                         </td>
                      </tr>
                    ))}
                     {customers.length === 0 && <tr><td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>No customers yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

           {tab === "workflow" && (
             <div>
               <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Workflow operations</h2>
               <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>Review and advance records created through this standalone website. Every list is scoped to this website's database.</p>
               <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
                 {Object.entries(workflowOverview?.counts ?? {}).map(([key, value]) => <div key={key} style={{ background: "#1e293b", borderRadius: 10, border: "1px solid #334155", padding: "1rem" }}><div style={{ color: "#64748b", fontSize: ".75rem" }}>{key.replaceAll("_", " ")}</div><strong style={{ color: "#D4AF37", fontSize: "1.5rem" }}>{String(value)}</strong></div>)}
               </div>
               <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: "1rem", marginBottom: 16 }}>
                 <h3 style={{ marginTop: 0 }}>Customer records</h3>
                 {workflowRecords.map(item => <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #334155", padding: ".75rem 0" }}><span>{item.title} <small style={{ color: "#94a3b8" }}>({item.category})</small></span><select value={item.status} onChange={e => updateWorkflow("/api/workflows/admin/records/" + item.id, { status: e.target.value })} style={{ background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6, padding: ".35rem" }}>{["pending","active","approved","rejected","completed","cancelled"].map(status => <option key={status}>{status}</option>)}</select></div>)}
                 {!workflowRecords.length && <p style={{ color: "#64748b" }}>No customer records yet.</p>}
               </div>
               <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: "1rem", marginBottom: 16 }}>
                 <h3 style={{ marginTop: 0 }}>Payment submissions</h3>
                  {workflowPayments.map(item => <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #334155", padding: ".75rem 0" }}><span>{item.payment_tracking_number ?? item.paymentTrackingNumber} · {item.amount} {item.currency}</span>{privateEvidenceReference(item.metadata) && <button onClick={() => openPrivateAsset(privateEvidenceReference(item.metadata)!)} style={{ background: "#334155", color: "#f1f5f9", border: 0, borderRadius: 6, padding: ".35rem .6rem", cursor: "pointer" }}>Download evidence</button>}<select value={item.status} onChange={e => updateWorkflow("/api/workflows/admin/payments/" + item.id, { status: e.target.value })} style={{ background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6, padding: ".35rem" }}>{["pending","approved","rejected"].map(status => <option key={status}>{status}</option>)}</select></div>)}
                 {!workflowPayments.length && <p style={{ color: "#64748b" }}>No payment submissions yet.</p>}
               </div>
               {WEBSITE_CONFIG.kyc?.enabled && <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", padding: "1rem" }}>
                 <h3 style={{ marginTop: 0 }}>KYC review</h3>
                 {workflowKyc.map(item => <div key={item.id} style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #334155", padding: ".75rem 0" }}><span>{item.full_name ?? item.fullName} · {item.document_type ?? item.documentType} <span style={{ display: "inline-flex", gap: 5, marginLeft: 8 }}>{item.document_front_url && <button onClick={() => openKycFile(item.id, "front")}>Front</button>}{item.document_back_url && <button onClick={() => openKycFile(item.id, "back")}>Back</button>}{item.selfie_url && <button onClick={() => openKycFile(item.id, "selfie")}>Selfie</button>}</span></span><select value={item.status} onChange={e => updateWorkflow("/api/workflows/admin/kyc/" + item.id, { status: e.target.value })} style={{ background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6, padding: ".35rem" }}>{["pending","approved","rejected","more_info_requested"].map(status => <option key={status}>{status}</option>)}</select></div>)}
                 {!workflowKyc.length && <p style={{ color: "#64748b" }}>No KYC submissions yet.</p>}
               </div>}
             </div>
           )}

           {tab === "referrals" && ["investment", "forex"].includes(WEBSITE_CONFIG.type) && (
             <div>
               <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>Referral program</h2>
               <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
                 {[
                   ["Referrals", referralData.stats?.totalReferrals ?? 0],
                   ["Pending bonuses", referralData.stats?.pendingAmount ?? "0.00"],
                   ["Approved bonuses", referralData.stats?.approvedAmount ?? "0.00"],
                   ["Rewards awaiting review", referralData.stats?.pendingRewards ?? 0],
                 ].map(([label, value]) => <div key={String(label)} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "1rem" }}><div style={{ color: "#94a3b8", fontSize: ".8rem" }}>{label}</div><strong style={{ fontSize: "1.4rem" }}>{value}</strong></div>)}
               </div>
               <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "1.25rem", marginBottom: 16 }}>
                 <h3 style={{ marginTop: 0 }}>Owner settings</h3>
                 <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><input type="checkbox" checked={Boolean(referralData.settings?.enabled)} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, enabled: e.target.checked } }))} />Enable referrals</label>
                 <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
                   <select value={referralData.settings?.bonusType ?? "percentage"} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, bonusType: e.target.value } }))}><option value="percentage">Percentage bonus</option><option value="fixed">Fixed bonus</option></select>
                   <input type="number" min="0" step="0.01" aria-label="Bonus value" value={referralData.settings?.bonusValue ?? 0} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, bonusValue: e.target.value } }))} placeholder="Bonus value" />
                   <input type="number" min="0" step="0.01" aria-label="Minimum qualifying deposit" value={referralData.settings?.minDeposit ?? 0} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, minDeposit: e.target.value } }))} placeholder="Minimum deposit" />
                   <input type="number" min="0" step="0.01" aria-label="Maximum referral reward" value={referralData.settings?.maxReward ?? 0} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, maxReward: e.target.value } }))} placeholder="Maximum reward (0 = no cap)" />
                   <input aria-label="Referral currency" value={referralData.settings?.currency ?? "USD"} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, currency: e.target.value } }))} placeholder="Currency" />
                 </div>
                 <textarea aria-label="Referral rules and conditions" value={referralData.settings?.rules ?? ""} onChange={e => setReferralData((v: any) => ({ ...v, settings: { ...v.settings, rules: e.target.value } }))} placeholder="Referral rules and conditions" maxLength={4000} style={{ display: "block", width: "100%", minHeight: 90, marginTop: 8 }} />
                 <button onClick={saveReferralSettings} style={{ marginTop: 10, padding: ".6rem 1rem", background: "#D4AF37", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer" }}>Save referral settings</button>
               </div>
               <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
                 <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "1rem" }}>
                   <h3 style={{ marginTop: 0 }}>Top referrers</h3>
                   {(referralData.topReferrers ?? []).map((item: any) => <p key={item.id} style={{ borderTop: "1px solid #334155", paddingTop: 8 }}>{item.first_name} {item.last_name} · {item.total_referrals} referrals · {item.approved_earnings} earned</p>)}
                   {!referralData.topReferrers?.length && <p style={{ color: "#94a3b8" }}>No referrals yet.</p>}
                 </div>
                 <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "1rem" }}>
                   <h3 style={{ marginTop: 0 }}>Referral rewards</h3>
                   <button onClick={downloadReferralReport} style={{ marginBottom: 8 }}>Export CSV report</button>
                   {(referralData.rewards ?? []).map((item: any) => <div key={item.source + "-" + item.id} style={{ borderTop: "1px solid #334155", padding: ".65rem 0" }}>
                     <div>{item.referrer_first_name ?? item.referrer_id} → {item.referred_first_name ?? item.referred_id} · {item.bonus_amount} {item.currency ?? "USD"} · {item.status}</div>
                     {item.status === "pending" && <div style={{ display: "flex", gap: 8, marginTop: 6 }}><button onClick={() => reviewReferral(item, "approved")}>Approve</button><button onClick={() => reviewReferral(item, "rejected")}>Reject</button></div>}
                   </div>)}
                   {!referralData.rewards?.length && <p style={{ color: "#94a3b8" }}>No referral rewards yet.</p>}
                 </div>
               </div>
             </div>
           )}

            {tab === "features" && (
             <div>
               <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Website Features</h2>
               <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
                 This standalone portal includes the exported website-specific capability contract and data available to this deployment.
               </p>
               <div style={{ background: "#1e293b", borderRadius: 12, padding: "1.25rem", border: "1px solid #334155", marginBottom: "1rem" }}>
                 <h3 style={{ marginTop: 0 }}>Supported customer functions</h3>
                 <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                   {(WEBSITE_CONFIG.capabilities?.customerFeatures ?? []).map((feature: string) => <span key={feature} style={{ padding: "0.35rem 0.6rem", borderRadius: 999, background: "#D4AF3722", color: "#D4AF37", fontSize: "0.8rem" }}>{feature.replaceAll("_", " ")}</span>)}
                 </div>
               </div>
               <div style={{ background: "#1e293b", borderRadius: 12, padding: "1.25rem", border: "1px solid #334155" }}>
                 <h3 style={{ marginTop: 0 }}>Exported data tables</h3>
                 {(featureData?.tables ?? []).map((table: any) => (
                   <div key={table.table} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "0.65rem 0", borderBottom: "1px solid #334155" }}>
                     <span style={{ fontFamily: "monospace", color: "#cbd5e1" }}>{table.table}</span>
                     <span style={{ color: "#94a3b8" }}>{table.count} records</span>
                   </div>
                 ))}
                 {!featureData?.tables?.length && <p style={{ color: "#64748b" }}>No optional feature records were exported for this website.</p>}
               </div>
             </div>
           )}

            {tab === "banking-actions" && WEBSITE_CONFIG.type === "banking" && <BankingActionsAdmin />}
            {tab === "deposits" && WEBSITE_CONFIG.type === "banking" && <BankingDepositsAdmin />}
            {tab === "content" && <OwnerContentManager />}

          {tab === "email" && emailSettings && (
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Email Identity & Notifications</h2>
              <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>This website's email configuration is stored in its own database. SMTP credentials are deployment secrets and are never shown here.</p>
              {(["mainSystem", "customerSupport"] as const).map(identity => (
                <div key={identity} style={{ background: "#1e293b", borderRadius: 12, padding: "1.25rem", border: "1px solid #334155", marginBottom: "1rem" }}>
                  <h3 style={{ marginTop: 0 }}>{identity === "mainSystem" ? "Main System Email" : "Customer Support Email"}</h3>
                  <p style={{ color: "#64748b", fontSize: "0.8rem" }}>{identity === "mainSystem" ? "Automated notification sender" : "Customer inquiry address only"}</p>
                  <input value={emailSettings[identity]?.address ?? ""} onChange={e => setEmailSettings({ ...emailSettings, [identity]: { ...emailSettings[identity], address: e.target.value, verified: false } })} placeholder="email@example.com" style={{ display: "block", width: "100%", padding: "0.65rem", marginBottom: "0.65rem", background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6 }} />
                  <input value={emailSettings[identity]?.senderName ?? ""} onChange={e => setEmailSettings({ ...emailSettings, [identity]: { ...emailSettings[identity], senderName: e.target.value } })} placeholder="Sender name" style={{ display: "block", width: "100%", padding: "0.65rem", background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6 }} />
                </div>
              ))}
              <div style={{ background: "#1e293b", borderRadius: 12, padding: "1.25rem", border: "1px solid #334155", marginBottom: "1rem" }}>
                <h3 style={{ marginTop: 0 }}>Notification Templates</h3>
                {Object.entries(emailSettings.templates ?? {}).map(([event, template]: [string, any]) => <div key={event} style={{ borderTop: "1px solid #334155", padding: "0.75rem 0" }}><label style={{ display: "flex", gap: 8, alignItems: "center", textTransform: "capitalize" }}><input type="checkbox" checked={template.enabled} onChange={e => setEmailSettings({ ...emailSettings, templates: { ...emailSettings.templates, [event]: { ...template, enabled: e.target.checked } } })} />{event.replaceAll("_", " ")}</label><input value={template.subject} onChange={e => setEmailSettings({ ...emailSettings, templates: { ...emailSettings.templates, [event]: { ...template, subject: e.target.value } } })} style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6 }} /><textarea value={template.message} onChange={e => setEmailSettings({ ...emailSettings, templates: { ...emailSettings.templates, [event]: { ...template, message: e.target.value } } })} style={{ display: "block", width: "100%", minHeight: 70, padding: "0.5rem", marginTop: "0.5rem", background: "#0f172a", color: "#f1f5f9", border: "1px solid #475569", borderRadius: 6 }} /></div>)}
              </div>
              <button onClick={saveEmailSettings} style={{ padding: "0.65rem 1rem", background: "#D4AF37", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", fontWeight: 700 }}>Save email settings</button>
            </div>
          )}

          {tab === "accounts" && (
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Accounts ({accounts.length})</h2>
              <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "#0f172a" }}>
                      {["Account #", "Type", "Balance", "Currency", "Status"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a, i) => (
                      <tr key={a.id} style={{ borderTop: "1px solid #334155", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace" }}>{a.accountNumber}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", textTransform: "capitalize" }}>{a.accountType}</td>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 600 }}>{parseFloat(a.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#94a3b8" }}>{a.currency}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, background: a.status === "active" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)", color: a.status === "active" ? "#10b981" : "#ef4444" }}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                    {accounts.length === 0 && <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>No accounts yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "shipments" && (
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>Shipments ({shipments.length})</h2>
              <div style={{ background: "#1e293b", borderRadius: 12, border: "1px solid #334155", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                  <thead>
                    <tr style={{ background: "#0f172a" }}>
                      {["Tracking #", "Sender", "Recipient", "Status", "Date"].map(h => (
                        <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", color: "#64748b", fontWeight: 600, fontSize: "0.75rem", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: "1px solid #334155", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#D4AF37" }}>{s.trackingNumber}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{s.senderName}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>{s.recipientName}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={{ padding: "0.2rem 0.6rem", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600, background: "rgba(99,102,241,0.15)", color: "#818cf8", textTransform: "capitalize" }}>{s.status.replace(/_/g, " ")}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#64748b" }}>{new Date(s.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {shipments.length === 0 && <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>No shipments yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
