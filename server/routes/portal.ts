import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, desc, count } from "drizzle-orm";
import { db, pool } from "../db.js";
import { customers, accounts, transactions, shipments, notifications } from "../schema.js";
import { requireAdmin } from "../auth.js";

const router = Router();

// The standalone database enforces digits-only account numbers.
const generateAccountNumber = () =>
  (BigInt("0x" + randomBytes(8).toString("hex")) % 1_000_000_000_000n)
    .toString()
    .padStart(12, "0");

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
router.get("/customers", requireAdmin, async (req, res) => {
  try {
    const region = String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase();
    if (!["ALL", "USA", "EUROPE"].includes(region)) {
      res.status(400).json({ error: "Invalid banking region" });
      return;
    }

    // Return the complete shape consumed by the Banking Customer Management page.
    // A customer may not have an account yet (for example, while registration is pending).
    const result = await pool.query(
      `SELECT
         c.id, c.username, c.first_name, c.last_name, c.email, c.phone,
         c.status, COALESCE(NULLIF(c.kyc_status, ''), 'not_submitted') AS kyc_status,
         c.banking_region, c.created_at, NULL::timestamptz AS last_login,
         a.account_number, a.currency, a.balance, a.status AS account_status
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT account_number, currency, balance, status
         FROM accounts
         WHERE customer_id = c.id AND website_id = c.website_id
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       ) a ON TRUE
       WHERE c.website_id = $1
         AND ($2 = 'ALL' OR c.banking_region = $2)
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [10, region],
    );

    res.json(result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      status: row.status ?? "unknown",
      kycStatus: row.kyc_status ?? "not_submitted",
      bankingRegion: row.banking_region ?? null,
      createdAt: row.created_at,
      lastLogin: row.last_login,
      account: row.account_number ? {
        accountNumber: row.account_number,
        currency: row.currency,
        balance: row.balance,
        status: row.account_status,
      } : null,
    })));
  } catch (err) {
    console.error("[portal customers] failed to load banking customer list", err);
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
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
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
            accountNumber: generateAccountNumber(),
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

      if (status === "rejected") {
        await tx.insert(notifications).values({
          websiteId: 10,
          userId: customerId,
          userType: "customer",
          title: "Registration declined",
          message: reason
            ? "Your registration was declined. Reason: " + reason
            : "Your registration was declined. Please contact support if you need assistance.",
          type: "warning",
          actionUrl: "/login",
        });
      }

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
