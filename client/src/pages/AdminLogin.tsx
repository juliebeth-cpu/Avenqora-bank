import { useState } from "react";
import { WEBSITE_CONFIG } from "../config";

interface Props {
  onLogin: () => void;
  onCustomerPortal: () => void;
  onBack?: () => void;
}

export default function AdminLogin({ onLogin, onCustomerPortal, onBack }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(requiresTwoFactor ? "/api/auth/admin/login/2fa" : "/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requiresTwoFactor
          ? { preAuthToken: localStorage.getItem("admin_pre_auth"), code: twoFactorCode }
          : { username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Login failed"); return; }
      if (data.requiresTwoFactor) {
        localStorage.setItem("admin_pre_auth", data.preAuthToken);
        setRequiresTwoFactor(true);
        setError("Enter the six-digit code from your authenticator app.");
        return;
      }
      localStorage.removeItem("admin_pre_auth");
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_info", JSON.stringify(data.admin));
      onLogin();
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: "2rem", background: "#1e293b", borderRadius: 16, boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>
        {/* Logo / Name */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          {WEBSITE_CONFIG.logoUrl ? (
            <img src={WEBSITE_CONFIG.logoUrl} alt="logo" style={{ height: 56, objectFit: "contain", marginBottom: 16 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#D4AF37", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24, fontWeight: 700, color: "#fff" }}>
              {WEBSITE_CONFIG.name.charAt(0)}
            </div>
          )}
          <h1 style={{ color: "#f1f5f9", fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{WEBSITE_CONFIG.name}</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: 4 }}>Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit}>
          {!requiresTwoFactor && <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              style={{ width: "100%", padding: "0.75rem 1rem", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
              placeholder="Enter your username"
            />
          </div>}
          {!requiresTwoFactor && <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: "0.75rem 1rem", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
              placeholder="••••••••••"
            />
          </div>}
          {requiresTwoFactor && <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", color: "#94a3b8", fontSize: "0.8rem", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Authenticator code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={twoFactorCode}
              onChange={e => setTwoFactorCode(e.target.value)}
              required
              style={{ width: "100%", padding: "0.75rem 1rem", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: "0.95rem", outline: "none", boxSizing: "border-box" }}
              placeholder="000000"
            />
          </div>}
          {error && <p style={{ color: "#f87171", fontSize: "0.875rem", marginBottom: "1rem", padding: "0.5rem 0.75rem", background: "rgba(248,113,113,0.1)", borderRadius: 6 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "0.85rem", background: "#D4AF37", border: "none", borderRadius: 8, color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Signing in…" : requiresTwoFactor ? "Verify and sign in" : "Sign In to Portal"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", borderTop: "1px solid #334155", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {onBack ? (
            <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.85rem", cursor: "pointer" }}>
              ← Home
            </button>
          ) : <span />}
          <button
            onClick={onCustomerPortal}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: "0.85rem", cursor: "pointer", textDecoration: "underline" }}
          >
            Customer Portal →
          </button>
        </div>
      </div>
    </div>
  );
}
