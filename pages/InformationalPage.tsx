import { useEffect, useRef, useState } from "react";
import { WEBSITE_CONFIG } from "../config";

type Kind = "privacy" | "terms" | "faq" | "custom";

const FAQS = [
  ["How do I open an account?", "Choose Customer Login from the homepage and complete registration. Some services may require identity verification."],
  ["How do I contact customer support?", "Use the support contact details provided by the website or the live chat widget when available."],
  ["How is my information protected?", "We use appropriate technical and organizational safeguards and process information as described in this website's Privacy Policy."],
  ["Where can I read the service terms?", "The complete Terms and Conditions are available on this website at /terms."],
];

const PRIVACY_SECTIONS = [
  ["Information We Collect", "We collect personal, contact, financial, KYC/AML, usage, and device information that you provide or that is generated while you use our services."],
  ["How We Use Your Information", "We use information to provide and maintain services, process transactions, verify identity, prevent fraud, provide support, send notices, improve the platform, and comply with legal obligations."],
  ["How We Share Information", "We do not sell personal information. We may share it with trusted service providers, authorities when legally required, fraud-prevention partners, or successors in a business transfer."],
  ["Data Retention and Security", "We retain information as needed for services, legal obligations, disputes, and agreements. We use industry-standard safeguards, but no online transmission or storage system is completely secure."],
  ["Your Rights", "Depending on your jurisdiction, you may request access, correction, deletion, restriction, portability, or object to processing. Contact the website using the details below."],
  ["Children's Privacy", "Our services are not directed to children under 18, and we do not knowingly collect their personal information without appropriate consent."],
  ["Changes and Contact", "We may update this policy by posting a revised version on this page. Questions may be sent to the contact email configured for this website."],
];

const TERMS_SECTIONS = [
  ["Acceptance of Terms", "By accessing or using this website and its services, you acknowledge that you have read and agree to these Terms and Conditions and the Privacy Policy."],
  ["Eligibility and Registration", "You must be at least 18 and legally able to enter a binding agreement. Registration information must be accurate and kept current, and account credentials must remain confidential."],
  ["Permitted Use", "Use the platform lawfully and do not attempt unauthorized access, impersonation, harmful interference, fraud, money laundering, or other prohibited activity."],
  ["Transactions and Verification", "Transactions are subject to applicable policies, limits, review, and law. We may require accurate identity documents for KYC/AML compliance."],
  ["Intellectual Property", "The website, its original content, features, and functionality belong to the website operator or its licensors and may not be copied or redistributed without permission."],
  ["Disclaimers and Liability", "Services are provided as available. To the extent permitted by law, the operator disclaims implied warranties and is not liable for indirect or consequential loss arising from use of the platform."],
  ["Suspension and Changes", "Access may be suspended for violations or security reasons. We may update these terms by posting a revised version; continued use after changes means acceptance."],
  ["Contact", "Questions about these terms may be sent to the contact email configured for this website."],
];

export default function InformationalPage({ kind, pageSlug, onBack }: { kind: Kind; pageSlug?: string; onBack: () => void }) {
  const cfg = WEBSITE_CONFIG;
  const [customPage, setCustomPage] = useState<any>(null);
  const [customPageError, setCustomPageError] = useState("");
  const [customPageLoading, setCustomPageLoading] = useState(false);
  useEffect(() => {
    if (kind !== "custom" || !pageSlug) return;
    let active = true;
    setCustomPage(null); setCustomPageError(""); setCustomPageLoading(true);
    fetch("/api/owner-content/public/pages/" + encodeURIComponent(pageSlug))
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? "Page not found");
        return data;
      })
      .then(data => { if (active) setCustomPage(data); })
      .catch(error => { if (active) setCustomPageError(error.message ?? "Page not found"); })
      .finally(() => { if (active) setCustomPageLoading(false); });
    return () => { active = false; };
  }, [kind, pageSlug]);
  useEffect(() => {
    if (kind !== "custom" || !customPage) return;
    document.title = customPage.seoTitle || customPage.title || cfg.name;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute("name", "description"); document.head.appendChild(meta); }
    if (customPage.seoDescription) meta.setAttribute("content", customPage.seoDescription);
    return () => { document.title = cfg.name; };
  }, [kind, customPage, cfg.name]);
  const title = kind === "privacy" ? "Privacy Policy" : kind === "terms" ? "Terms & Conditions" : kind === "faq" ? "Frequently Asked Questions" : customPage?.title ?? "Custom page";
  const sections = kind === "privacy" ? PRIVACY_SECTIONS : kind === "terms" ? TERMS_SECTIONS : [];
   const email = cfg.companyEmail || cfg.supportEmail || "";

  return <div style={{ minHeight: "100vh", background: "var(--theme-background)", color: "var(--theme-text)", fontFamily: "Inter, system-ui, sans-serif" }}>
    <header style={{ borderBottom: "1px solid var(--theme-border)", padding: "1rem 2rem" }}>
      <button onClick={onBack} style={{ background: "none", border: 0, color: cfg.primaryColor, cursor: "pointer", fontSize: "0.9rem" }}>Back to {cfg.name}</button>
    </header>
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <h1 style={{ color: "var(--theme-text)", fontSize: "2rem", marginBottom: "0.5rem" }}>{title}</h1>
       {kind !== "custom" && <p style={{ color: "var(--theme-mutedText)", marginBottom: "2.5rem" }}>{cfg.name} · Effective as of {new Date().getFullYear()}</p>}
       {kind === "custom"
         ? customPageLoading ? <p role="status">Loading page…</p>
           : customPageError ? <p role="alert">{customPageError}</p>
             : customPage && <p style={{ color: "var(--theme-text)", lineHeight: 1.75, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{customPage.content}</p>
         : kind === "faq" ? <div>{FAQS.map(([question, answer]) => <section key={question} style={{ borderBottom: "1px solid var(--theme-border)", padding: "1.25rem 0" }}><h2 style={{ color: "var(--theme-text)", fontSize: "1.05rem", margin: "0 0 .5rem" }}>{question}</h2><p style={{ color: "var(--theme-mutedText)", lineHeight: 1.7, margin: 0 }}>{answer}</p></section>)}</div> : <div>{sections.map(([heading, body], index) => <section key={heading} style={{ marginBottom: "2rem" }}><h2 style={{ color: "var(--theme-text)", fontSize: "1.15rem", marginBottom: ".6rem" }}>{index + 1}. {heading}</h2><p style={{ color: "var(--theme-text)", lineHeight: 1.75, margin: 0 }}>{body}</p></section>)}</div>}
      <div style={{ borderTop: "1px solid var(--theme-border)", marginTop: "3rem", paddingTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <a href="/" style={{ color: cfg.primaryColor }}>Home</a>
        {kind !== "privacy" && <a href="/privacy" style={{ color: cfg.primaryColor }}>Privacy Policy</a>}
        {kind !== "terms" && <a href="/terms" style={{ color: cfg.primaryColor }}>Terms &amp; Conditions</a>}
        {kind !== "faq" && <a href="/faq" style={{ color: cfg.primaryColor }}>FAQ</a>}
          {email && (email.includes("@")
            ? <a href={"mailto:" + email} style={{ color: cfg.primaryColor }}>Contact</a>
            : <span>Contact: {email}</span>)}
      </div>
    </main>
  </div>;
}
