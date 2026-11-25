import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
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
  if (!identity.address) throw new Error("Main System Email is not configured");
  return identity.senderName ? '"' + identity.senderName.replace(/"/g, "") + '" <' + identity.address + '>' : identity.address;
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
      enabled: false,
      subject: input.event.replaceAll("_", " "),
      title: input.event.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()),
      message: input.values?.message ?? "There is an update to your account.",
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
        "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) SELECT $1,id,'website_admin',$2,$3,$4,NOW() FROM website_admins WHERE website_id=$1",
        [config.websiteId, "Customer notification: " + title, message, notificationType],
      ).catch((error) => console.error("[notifications] Admin alert could not be created:", error));
    }
    if (!template.enabled) return { inApp: "created", email: { status: "skipped", reason: "Email notification template is disabled" } };
    if (!config.email.mainSystem.verified || !config.email.mainSystem.address) {
      return { inApp: "created", email: { status: "skipped", reason: "Main System Email is not configured and verified" } };
    }
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return { inApp: "created", email: { status: "skipped", reason: "SMTP is not configured" } };
    }
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: sender(config.email.mainSystem),
      to: input.recipient,
      subject: render(template.subject, values),
      html: "<div style='font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px'><h2>" + escapeHtml(title) + "</h2><p>" + escapeHtml(message) + "</p></div>",
    });
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
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    await db.delete(websiteConfig).where(eq(websiteConfig.key, key));
    return { status: "skipped" as const, reason: "SMTP is not configured" };
  }
  try {
    const port = Number(process.env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
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
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const subject = `Reset your ${config.name} password`;
  const message = `Hello ${input.firstName || "there"}, use this one-time password reset token within 30 minutes: ${input.token}`;
  await transport.sendMail({
    from: sender(config.email.mainSystem),
    to: input.recipient,
    subject,
    text: message,
    html: "<div style='font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px'><h2>" + escapeHtml(subject) + "</h2><p>" + escapeHtml(message) + "</p></div>",
  });
}
