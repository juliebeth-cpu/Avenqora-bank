import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import portalRouter from "./routes/portal.js";
import customerRouter from "./routes/customer.js";
import emailRouter from "./routes/email.js";
 import featureRouter from "./routes/features.js";
 import workflowRouter from "./routes/workflows.js";
import bankingRouter from "./routes/banking.js";
import depositsRouter from "./routes/deposits.js";
import ownerContentRouter from "./routes/owner-content.js";
 import { startStandaloneTrackingAutomation } from "./tracking.js";
import { mkdir, open, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const publicBaseUrlValue = process.env.PUBLIC_BASE_URL?.trim();
let publicOrigin = "";
if (publicBaseUrlValue) {
  const publicBaseUrl = new URL(publicBaseUrlValue);
  if (publicBaseUrl.pathname !== "/" || publicBaseUrl.search || publicBaseUrl.hash) {
    throw new Error("PUBLIC_BASE_URL must be an origin without a path, query, or fragment");
  }
  if (process.env.NODE_ENV === "production" && publicBaseUrl.protocol !== "https:") {
    throw new Error("PUBLIC_BASE_URL must use HTTPS in production");
  }
  publicOrigin = publicBaseUrl.origin;
}
if (process.env.NODE_ENV === "production" && !publicOrigin) {
  throw new Error("Set PUBLIC_BASE_URL to the canonical HTTPS origin before starting in production");
}
if (process.env.NODE_ENV === "production" && !process.env.UPLOAD_DIR?.trim()) {
  throw new Error("Set UPLOAD_DIR to a durable mounted volume path before starting in production");
}
const allowedOrigins = new Set([
  publicOrigin,
  ...(process.env.CORS_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"]),
].filter(Boolean));

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ── API Routes ────────────────────────────────────────────────────────────

app.use((req, res, next) => {
  const aliases: Array<[string, string]> = [
    ["/api/website/auth/login/2fa", "/api/auth/admin/login/2fa"],
    ["/api/website/auth/login", "/api/auth/admin/login"],
    ["/api/website/auth/2fa/status", "/api/auth/admin/2fa/status"],
    ["/api/website/auth/2fa/setup", "/api/auth/admin/2fa/setup"],
    ["/api/website/auth/2fa/verify", "/api/auth/admin/2fa/verify"],
    ["/api/website/auth/2fa/disable", "/api/auth/admin/2fa/disable"],
    ["/api/website/auth/me", "/api/auth/admin/me"],
    ["/api/website/auth/change-password", "/api/auth/admin/change-password"],
    ["/api/customer/auth/forgot-password", "/api/auth/customer/request-password-reset"],
    ["/api/customer/auth/reset-password", "/api/auth/customer/reset-password"],
    ["/api/website/banking/actions", "/api/banking/admin/actions"],
    ["/api/website/banking/messages", "/api/banking/admin/messages"],
    ["/api/website/banking/dashboard", "/api/banking/admin/dashboard"],
    ["/api/website/banking/transactions", "/api/banking/admin/transactions"],
    ["/api/website/banking/audit-logs", "/api/banking/admin/audit-logs"],
    ["/api/website/banking-settings", "/api/banking/admin/settings"],
    ["/api/website/live-chat-widget", "/api/banking/admin/live-chat-widget"],
    ["/api/website/deposit-bank-accounts", "/api/banking/admin/deposit-bank-accounts"],
    ["/api/website/customer-localization", "/api/banking/admin/customer-localization"],
    ["/api/website/analytics", "/api/banking/admin/analytics"],
    ["/api/website/information-change-requests", "/api/workflows/website/information-change-requests"],
    ["/api/website/accounts", "/api/banking/admin/accounts"],
    ["/api/website/cards", "/api/banking/admin/cards"],
    ["/api/website/receipts", "/api/banking/admin/receipts"],
    ["/api/website/customers", "/api/portal/customers"],
    ["/api/website/kyc", "/api/admin/kyc"],
    ["/api/website/deposits", "/api/banking/admin/deposits"],
    ["/api/website/withdrawals", "/api/banking/admin/withdrawals"],
    ["/api/website/transfers", "/api/banking/admin/transfers"],
    ["/api/website/loans", "/api/banking/admin/loans"],
    ["/api/website/dashboard", "/api/admin/overview"],
  ];
  const url = new URL(req.url, "http://standalone.local");
  const alias = aliases.find(([prefix]) => url.pathname === prefix || url.pathname.startsWith(prefix + "/"));
  if (alias) {
    url.pathname = alias[1] + url.pathname.slice(alias[0].length);
    req.url = url.pathname + url.search;
    if (alias[0] === "/api/website/auth/login" && req.body && typeof req.body === "object") {
      req.body.username ??= req.body.identifier;
    }
    if (alias[0] === "/api/customer/auth/reset-password" && req.body && typeof req.body === "object") {
      req.body.password ??= req.body.newPassword;
    }
  }
  if (url.pathname === "/api/customer/banking-actions" || url.pathname.startsWith("/api/customer/banking-actions/")) {
    req.url = "/api/banking/customer/actions" + url.pathname.slice("/api/customer/banking-actions".length) + url.search;
  } else if (url.pathname === "/api/customer/credit-score") {
    req.url = "/api/banking/customer/credit-score" + url.search;
  } else if (url.pathname === "/api/customer/banking/messages" || url.pathname.startsWith("/api/customer/banking/messages/")) {
    req.url = "/api/banking/customer/messages" + url.pathname.slice("/api/customer/banking/messages".length) + url.search;
  }
  next();
});
app.use("/api", authRouter);
app.use("/api/portal", portalRouter);
app.use("/api/customer", customerRouter);
app.use("/api", depositsRouter);
app.use("/api/email", emailRouter);
 app.use("/api/features", featureRouter);
 app.use("/api/workflows", workflowRouter);
 app.use("/api/public", workflowRouter);
app.use("/api/banking", bankingRouter);
app.use("/api/banking", depositsRouter);
app.use("/api/owner-content", ownerContentRouter);
app.use("/api", workflowRouter);

// ── Health Check ──────────────────────────────────────────────────────────
// Root-level: for Railway, Render, Fly.io, and other platform health checkers
app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", website: "Avenqora Bank ", type: "banking" });
});
// API-namespaced alias (backward compat with tools that probe /api/healthz)
app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok", website: "Avenqora Bank ", type: "banking" });
});

app.get("/readyz", async (_req, res) => {
  const checks = { database: false, storage: false };
  try { await pool.query("SELECT 1"); checks.database = true; } catch {}
  let probePath = "";
  try {
    const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? "data/uploads");
    await mkdir(uploadRoot, { recursive: true });
    probePath = path.join(uploadRoot, ".readyz-" + randomUUID());
    const probe = await open(probePath, "wx", 0o600);
    await probe.close();
    await unlink(probePath);
    checks.storage = true;
  } catch {
    if (probePath) await unlink(probePath).catch(() => undefined);
  }
  const ready = checks.database && checks.storage;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks });
});


// ── Serve Frontend in Production ──────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const clientDir = path.join(__dirname, "../../dist/client");
  app.use(express.static(clientDir));
  // Express 5 requires named wildcards — "/*path" matches all routes for SPA fallback
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Avenqora Bank  server running on http://localhost:${PORT}`);
   startStandaloneTrackingAutomation();
});
