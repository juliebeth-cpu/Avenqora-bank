import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, desc, count } from "drizzle-orm";
import { db } from "../db.js";
import { customers, accounts, transactions, shipments } from "../schema.js";
import { requireAdmin } from "../auth.js";

const router = Router();

// GET /api/portal/dashboard
router.get("/dashboard", requireAdmin, async (_req, res) => {
  try {
    const [{ value: customerCount }] = await db.select({ value: count() }).from(customers);
    const [{ value: accountCount }] = await db.select({ value: count() }).from(accounts);
    const [{ value: shipmentCount }] = await db.select({ value: count() }).from(shipments);
    res.json({ customerCount, accountCount, shipmentCount });
  } catch (err) {
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// GET /api/portal/customers
router.get("/customers", requireAdmin, async (_req, res) => {
  try {
    const list = await db.select({
      id: customers.id,
      username: customers.username,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      status: customers.status,
      createdAt: customers.createdAt,
    }).from(customers).orderBy(desc(customers.createdAt)).limit(200);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load customers" });
  }
});

// GET /api/portal/shipments
router.get("/shipments", requireAdmin, async (_req, res) => {
  try {
    const list = await db.select().from(shipments).orderBy(desc(shipments.createdAt)).limit(200);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load shipments" });
  }
});

// GET /api/portal/accounts
router.get("/accounts", requireAdmin, async (_req, res) => {
  try {
    const list = await db.select().from(accounts).orderBy(desc(accounts.createdAt)).limit(200);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

// GET /api/portal/transactions
router.get("/transactions", requireAdmin, async (_req, res) => {
  try {
    const list = await db.select().from(transactions).orderBy(desc(transactions.createdAt)).limit(500);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Failed to load transactions" });
  }
});

// PATCH /api/portal/customers/:id/status
router.patch("/customers/:id/status", requireAdmin, async (req, res) => {
  const customerId = Number(req.params.id);
  const { status } = req.body ?? {};
  if (!Number.isSafeInteger(customerId) || customerId < 1) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  if (!["active", "suspended", "rejected"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx.select().from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.websiteId, 10)))
        .limit(1).for("update");
      if (!customer) return { ok: false as const, error: "not_found" as const };

      if (status === "active") {
        if (customer.status !== "pending_approval" && customer.status !== "active") {
          return { ok: false as const, error: "not_pending" as const };
        }

        // Create the initial checking account once, within the same transaction
        // as approval, so repeated clicks cannot create duplicate accounts.
        const [existingAccount] = await tx.select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.customerId, customerId), eq(accounts.websiteId, 10)))
          .limit(1);
        if (!existingAccount) {
          await tx.insert(accounts).values({
            websiteId: 10,
            customerId,
            accountNumber: "AVQ" + randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase(),
            accountType: "checking",
            currency: "USD",
            status: "active",
          });
        }
      }

      const [updated] = await tx.update(customers)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(customers.id, customerId), eq(customers.websiteId, 10)))
        .returning({ id: customers.id, status: customers.status });
      return { ok: true as const, customer: updated };
    });

    if (!result.ok && result.error === "not_found") { res.status(404).json({ error: "Customer not found" }); return; }
    if (!result.ok && result.error === "not_pending") {
      res.status(409).json({ error: "Only pending registrations can be approved" });
      return;
    }
    if (!result.ok) { res.status(400).json({ error: "Customer status could not be updated" }); return; }
    res.json(result.customer);
  } catch (error) {
    console.error("[customer registration approval] failed", error);
    res.status(500).json({ error: "Failed to update customer registration" });
  }
});

// POST /api/portal/customers/:id/reset-password
router.post("/customers/:id/reset-password", requireAdmin, async (req, res) => {
  const { password } = req.body ?? {};
  if (typeof password !== "string" || password.length < 12) { res.status(400).json({ error: "Password must be at least 12 characters" }); return; }
  const [customer] = await db.update(customers).set({ passwordHash: await bcrypt.hash(password, 12), updatedAt: new Date() })
    .where(eq(customers.id, Number(req.params.id))).returning({ id: customers.id });
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ id: customer.id, passwordReset: true });
});

export default router;
