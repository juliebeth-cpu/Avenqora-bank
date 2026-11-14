import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, pool } from "../db.js";
import { customers, notifications } from "../schema.js";
import { requireAdmin, requireCustomer } from "../auth.js";
import {
  getStandaloneEmailSettings,
  requestStandaloneIdentityVerification,
  sendStandaloneNotification,
  updateStandaloneEmailSettings,
  verifyStandaloneIdentity,
} from "../email.js";

const router = Router();

router.get("/settings", requireAdmin, async (_req, res) => {
  res.json(await getStandaloneEmailSettings());
});

router.patch("/settings", requireAdmin, async (req, res) => {
  const email = req.body?.email;
  if (!email?.mainSystem || !email?.customerSupport || !email?.templates) {
    res.status(400).json({ error: "Complete email settings are required" });
    return;
  }
  if (email.mainSystem.address === email.customerSupport.address) {
    res.status(400).json({ error: "Main System Email and Customer Support Email must be different" });
    return;
  }
  await updateStandaloneEmailSettings(email);
  res.json(await getStandaloneEmailSettings());
});

router.post("/broadcast", requireAdmin, async (req, res) => {
  const { event, message } = req.body ?? {};
  if (!["announcement", "promotion"].includes(event) || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "event and message are required" });
    return;
  }
  const customersList = await db.select({ id: customers.id, email: customers.email, firstName: customers.firstName }).from(customers);
  const outcomes = await Promise.all(customersList.map((customer) => sendStandaloneNotification({ customerId: customer.id, recipient: customer.email, firstName: customer.firstName, event, values: { message: message.trim() } })));
  res.json({
    success: true,
    recipientCount: customersList.length,
    email: {
      accepted: outcomes.filter((outcome) => outcome.email.status === "accepted").length,
      skipped: outcomes.filter((outcome) => outcome.email.status === "skipped").length,
      failed: outcomes.filter((outcome) => outcome.email.status === "failed").length,
    },
  });
});

router.get("/customer", requireCustomer, async (req, res) => {
  const customer = (req as any).customer;
  const rows = await db.select().from(notifications).where(eq(notifications.userId, customer.userId)).orderBy(notifications.createdAt);
  res.json(rows);
});

export default router;
