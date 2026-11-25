import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, pool } from "./db.js";
import { notifications, websiteConfig } from "./schema.js";
import { eq } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(process.cwd(), "database/website-config.json");

type EmailConfig = {
  websiteId: number;
  name: string;
  email: {
    mainSystem: { address: string | null; senderName: string | null; verified: boolean };
    customerSupport: { address: string | null; senderName: string | null; verified: boolean };
    templates: Record<string, { enabled: boolean; subject: string; title: string; message: string }>;
  };
};

let configPromise: Promise<EmailConfig> | undefined;
const paymentUpdateTemplate = { enabled: true, subject: "Payment status update", title: "Payment status update", message: "Your payment of {{amount}} {{currency}} ({{reference}}) is {{status}}. {{reviewNotes}}" };
function safeEmailSettings(email: EmailConfig["email"]): EmailConfig["email"] {
  const cleanTemplate = (template: any) => ({ enabled: Boolean(template?.enabled), subject: String(template?.subject ?? ""), title: String(template?.title ?? ""), message: String(template?.message ?? "") });
  return {
    mainSystem: { address: email?.mainSystem?.address ? String(email.mainSystem.address) : null, senderName: email?.mainSystem?.senderName ? String(email.mainSystem.senderName) : null, verified: Boolean(email?.mainSystem?.verified) },
    customerSupport: { address: email?.customerSupport?.address ? String(email.customerSupport.address) : null, senderName: email?.customerSupport?.senderName ? String(email.customerSupport.senderName) : null, verified: Boolean(email?.customerSupport?.verified) },
    templates: {
      ...Object.fromEntries(Object.entries(email?.templates ?? {}).map(([key, template]) => [key, cleanTemplate(template)])),
      payment_update: cleanTemplate(email?.templates?.payment_update ?? paymentUpdateTemplate),
      announcement: cleanTemplate(email?.templates?.announcement ?? { enabled: true, subject: "{{title}}", title: "{{title}}", message: "{{message}}" }),
      promotion: cleanTemplate(email?.templates?.promotion ?? { enabled: true, subject: "{{title}}", title: "{{title}}", message: "{{message}}" }),
    },
  };
}
async function getConfig(): Promise<EmailConfig> {
  configPromise ??= readFile(configPath, "utf8").then(async (raw) => {
    const config = JSON.parse(raw) as EmailConfig;
    config.email = safeEmailSettings(config.email);
    const [saved] = await db.select().from(websiteConfig).where(eq(websiteConfig.key, "email")).limit(1);
    if (saved?.value) {
      try { config.email = safeEmailSettings(JSON.parse(saved.value) as EmailConfig["email"]); } catch { /* retain exported defaults */ }
    }
    const mainAddress = process.env.MAIN_SYSTEM_EMAIL;
    const supportAddress = process.env.CUSTOMER_SUPPORT_EMAIL;
    if (mainAddress) config.email.mainSystem = { ...config.email.mainSystem, address: mainAddress, senderName: process.env.MAIN_SYSTEM_EMAIL_SENDER_NAME ?? config.email.mainSystem.senderName, verified: true };
    if (supportAddress) config.email.customerSupport = { ...config.email.customerSupport, address: supportAddress, senderName: process.env.CUSTOMER_SUPPORT_EMAIL_SENDER_NAME ?? config.email.customerSupport.senderName, verified: true };
    return config;
  });
  return configPromise;
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function sender(identity: { address: string | null; senderName: string | null }): string {
  if (!identity.address) throw new Error("Email sender address is not configured");
  return identity.senderName ? '"' + identity.senderName.replace(/"/g, "") + '" <' + identity.address + '>' : identity.address;
}

type GmailSenderKind = "notification" | "passwordReset";

function gmailCredentials(kind: GmailSenderKind) {
  const prefix = kind === "notification" ? "NOTIFICATION_GMAIL" : "PASSWORD_RESET_GMAIL";
  return {
    clientId: process.env[`${prefix}_CLIENT_ID`],
    clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
    refreshToken: process.env[`${prefix}_REFRESH_TOKEN`],
  };
}

function requiredHeader(value: string): string {
  return value.replace(/[\\r\\n]+/g, " ").trim();
}

function mimeBase64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/.{1,76}/g, "function smtpTransport(user: string, pass: string) {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
  });
}

function notificationSmtpCredentials() {
  return {
    user: process.env.NOTIFICATION_SMTP_USER ?? process.env.SMTP_USER,
    pass: process.env.NOTIFICATION_SMTP_PASS ?? process.env.SMTP_PASS,
  };
}

function passwordResetSmtpCredentials() {
  return {
    user: process.env.PASSWORD_RESET_SMTP_USER,
    pass: process.env.PASSWORD_RESET_SMTP_PASS,
  };
}\\r\\n");
}

async function sendWithGmailApi(kind: GmailSenderKind, input: {
  from: string; to: string; subject: string; text: string; html?: string;
}): Promise<void> {
  const credentials = gmailCredentials(kind);
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    throw new Error(kind === "notification"
      ? "Notification Gmail API OAuth credentials are not configured"
      : "Password-reset Gmail API OAuth credentials are not configured");
  }

  const timeout = AbortSignal.timeout(12_000);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: timeout,
  });
  if (!tokenResponse.ok) throw new Error(`Gmail OAuth token request failed (HTTP ${tokenResponse.status})`);
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) throw new Error("Gmail OAuth response did not include an access token");

  const boundary = "avenqora-" + randomUUID();
  const subject = "=?UTF-8?B?" + Buffer.from(requiredHeader(input.subject), "utf8").toString("base64") + "?=";
  const parts = [
    `From: ${requiredHeader(input.from)}`,
    `To: ${requiredHeader(input.to)}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    mimeBase64(input.text),
  ];
  if (input.html) parts.push(
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    mimeBase64(input.html),
  );
  parts.push(`--${boundary}--`, "");
  const raw = Buffer.from(parts.join("\\r\\n"), "utf8").toString("base64url");

  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!sendResponse.ok) throw new Error(`Gmail API message send failed (HTTP ${sendResponse.status})`);
}

export async function sendStandaloneNotification(input: {
  customerId: number;
  recipient: string;
  firstName: string;
  event: string;
  values?: Record<string, string>;
  inApp?: boolean;
}): Promise<{ inApp: "created" | "skipped" | "failed"; email: { status: "accepted" | "skipped" | "failed"; reason: string | null } }> {
  try {
    const config = await getConfig();
    const configuredTemplate = config.email.templates[input.event];
    const template = configuredTemplate ?? {
      enabled: true,
      subject: input.event.replaceAll("_", " "),
      title: input.event.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      message: input.values?.message ?? "There is an update to your account. Sign in to Avenqora Bank to review the latest details.",
    };
    const values = { websiteName: config.name, firstName: input.firstName, ...(input.values ?? {}) };
    const title = render(template.title, values);
    const message = render(template.message, values);
    const status = (input.values?.status ?? "").toLowerCase();
    const notificationType = /reject|declin|fail|cancel/.test(status) || input.event.includes("declined")
      ? "error"
      : /approv|complet|success/.test(status) || input.event.includes("success") ? "success" : "info";
    if (input.inApp !== false) {
      await db.insert(notifications).values({ websiteId: config.websiteId, userId: input.customerId, userType: "customer", title, message, type: notificationType });
      await pool.query(
        "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) SELECT $1,id,'website_admin',$2,$3,$4,NOW() FROM admins WHERE status='active'",
        [config.websiteId, "Customer notification: " + title, message, notificationType],
      ).catch((error) => console.error("[notifications] Admin alert could not be created:", error));
    }
    if (!template.enabled) return { inApp: "created", email: { status: "skipped", reason: "Email notification template is disabled" } };
    if (!config.email.mainSystem.verified || !config.email.mainSystem.address) {
      return { inApp: "created", email: { status: "skipped", reason: "Main System Email is not configured and verified" } };
    }
    const credentials = gmailCredentials("notification");
    if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
      return { inApp: "created", email: { status: "skipped", reason: "Notification Gmail API OAuth credentials are not configured" } };
    }
    const html = "<div style='font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px'><h2>" + escapeHtml(title) + "</h2><p>" + escapeHtml(message) + "</p></div>";
    void sendWithGmailApi("notification", {
      from: sender(config.email.mainSystem), to: input.recipient,
      subject: render(template.subject, values), text: title + "\\n\\n" + message, html,
    }).catch((error) => console.error("[email] Background notification delivery failed:", error));
    return { inApp: "created", email: { status: "accepted", reason: null } };
  } catch (error) {
    console.error("[email] Standalone notification was not accepted by SMTP:", error);
    return { inApp: "failed", email: { status: "failed", reason: "Notification could not be processed" } };
  }
}

export async function getStandaloneEmailSettings() {
  const config = await getConfig();
  const email = safeEmailSettings(config.email);
  return { mainSystem: email.mainSystem, customerSupport: email.customerSupport, templates: email.templates };
}

export async function updateStandaloneEmailSettings(email: EmailConfig["email"]): Promise<void> {
  const value = JSON.stringify(safeEmailSettings(email));
  const [existing] = await db.select().from(websiteConfig).where(eq(websiteConfig.key, "email")).limit(1);
  if (existing) await db.update(websiteConfig).set({ value, updatedAt: new Date() }).where(eq(websiteConfig.id, existing.id));
  else await db.insert(websiteConfig).values({ key: "email", value });
  configPromise = undefined;
}

export async function requestStandaloneIdentityVerification(identity: "main_system" | "customer_support") {
  const config = await getConfig();
  const target = identity === "main_system" ? config.email.mainSystem : config.email.customerSupport;
  if (!target.address) throw new Error("Configure an email address first");
  const token = randomUUID() + randomUUID().replaceAll("-", "");
  const key = "email_verification_" + identity;
  const value = JSON.stringify({ token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  const [existing] = await db.select().from(websiteConfig).where(eq(websiteConfig.key, key)).limit(1);
  if (existing) await db.update(websiteConfig).set({ value, updatedAt: new Date() }).where(eq(websiteConfig.id, existing.id));
  else await db.insert(websiteConfig).values({ key, value });
  const credentials = gmailCredentials("notification");
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    await db.delete(websiteConfig).where(eq(websiteConfig.key, key));
    return { status: "skipped" as const, reason: "Notification Gmail API OAuth credentials are not configured" };
  }
  try {
    await sendWithGmailApi("notification", {
      from: sender(target),
      to: target.address,
      subject: "Verify your website email identity",
      text: "Verify the " + (identity === "main_system" ? "Main System Email" : "Customer Support Email") + " for your website. Verification token: " + token,
    });
    return { status: "accepted" as const, reason: null };
  } catch (error) {
    await db.delete(websiteConfig).where(eq(websiteConfig.key, key));
    console.error("[email] Standalone identity verification was not accepted by SMTP:", error);
    return { status: "failed" as const, reason: "Verification email could not be sent" };
  }
}

export async function verifyStandaloneIdentity(token: string): Promise<boolean> {
  for (const identity of ["main_system", "customer_support"] as const) {
    const key = "email_verification_" + identity;
    const [saved] = await db.select().from(websiteConfig).where(eq(websiteConfig.key, key)).limit(1);
    if (!saved) continue;
    let value: { token?: string; expiresAt?: number };
    try { value = JSON.parse(saved.value); } catch { continue; }
    if (!value.token || value.token !== token || !value.expiresAt || value.expiresAt < Date.now()) continue;
    const config = await getConfig();
    const email = {
      ...config.email,
      [identity === "main_system" ? "mainSystem" : "customerSupport"]: {
        ...(identity === "main_system" ? config.email.mainSystem : config.email.customerSupport),
        verified: true,
      },
    };
    await updateStandaloneEmailSettings(email);
    await db.delete(websiteConfig).where(eq(websiteConfig.id, saved.id));
    return true;
  }
  return false;
}

export async function sendStandalonePasswordReset(input: {
  recipient: string;
  firstName: string;
  token: string;
}): Promise<void> {
  const config = await getConfig();
  const credentials = gmailCredentials("passwordReset");
  if (!credentials.clientId || !credentials.clientSecret || !credentials.refreshToken) {
    throw new Error("Password-reset Gmail API OAuth credentials are not configured");
  }
  const resetAddress = process.env.PASSWORD_RESET_EMAIL ?? config.email.customerSupport.address;
  if (!resetAddress) throw new Error("Password-reset sender email address is not configured");
  const subject = `Reset your ${config.name} password`;
  const message = `Hello ${input.firstName || "there"}, use this one-time password reset token within 30 minutes: ${input.token}`;
  const html = "<div style='font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px'><h2>" + escapeHtml(subject) + "</h2><p>" + escapeHtml(message) + "</p></div>";
  void sendWithGmailApi("passwordReset", {
    from: sender({ address: resetAddress, senderName: process.env.PASSWORD_RESET_EMAIL_SENDER_NAME ?? config.email.customerSupport.senderName }),
    to: input.recipient, subject, text: message, html,
  }).catch((error) => console.error("[email] Background password-reset delivery failed:", error));
}
