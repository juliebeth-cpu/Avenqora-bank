import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, desc, count } from "drizzle-orm";
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
  try {
    const { status } = req.body ?? {};
    if (!["active", "suspended"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    const [c] = await db.update(customers).set({ status }).where(eq(customers.id, Number(req.params.id))).returning();
    if (!c) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: c.id, status: c.status });
  } catch {
    res.status(500).json({ error: "Failed to update customer" });
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
