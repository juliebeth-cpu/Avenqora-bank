import { Router } from "express";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, desc, count } from "drizzle-orm";
import { db, pool } from "../db.js";
import { customers, accounts, transactions, shipments, notifications } from "../schema.js";
import { requireAdmin } from "../auth.js";

const router = Router();

// Generate a unique 12-digit account number with a random, non-zero four-digit ending.
const generateAccountNumber = async (tx: any) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate =
      String(randomInt(10_000_000, 100_000_000)) +
      String(randomInt(1_000, 10_000));
    const [existing] = await tx.select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.accountNumber, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Unable to generate a unique Banking account number");
};

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
         c.status, c.suspension_reason, COALESCE(NULLIF(c.kyc_status, ''), 'not_submitted') AS kyc_status,
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
      suspensionReason: row.suspension_reason ?? null,
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

// DELETE /api/portal/customers/:id
// Permanently removes one customer and their customer/account-linked banking records.
router.delete("/customers/:id", requireAdmin, async (req, res) => {
  const customerId = Number(req.params.id);
  if (!Number.isSafeInteger(customerId) || customerId < 1) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT id FROM customers WHERE id = $1 AND website_id = $2 FOR UPDATE",
      [customerId, 10],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const accountResult = await client.query(
      "SELECT id FROM accounts WHERE customer_id = $1 AND website_id = $2",
      [customerId, 10],
    );
    const accountIds = accountResult.rows.map((row: any) => Number(row.id));

    // Remove rows that reference this customer's accounts before deleting accounts.
    if (accountIds.length) {
      const accountTables = await client.query(
        `SELECT DISTINCT table_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'account_id'`,
      );
      for (const row of accountTables.rows) {
        const tableName = String(row.table_name);
        if (tableName === "accounts") continue;
        const safeTable = '"' + tableName.replace(/"/g, '""') + '"';
        await client.query(
          `DELETE FROM public.${safeTable} WHERE account_id = ANY($1::int[])`,
          [accountIds],
        );
      }
    }

    // Remove every public-table row directly owned by this customer.
    const customerTables = await client.query(
      `SELECT table_name,
              BOOL_OR(column_name = 'website_id') AS has_website_id
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('customer_id', 'website_id')
       GROUP BY table_name
       HAVING BOOL_OR(column_name = 'customer_id')`,
    );
    for (const row of customerTables.rows) {
      const tableName = String(row.table_name);
      if (tableName === "customers") continue;
      const safeTable = '"' + tableName.replace(/"/g, '""') + '"';
      const hasWebsiteId = row.has_website_id === true;
      await client.query(
        `DELETE FROM public.${safeTable} WHERE customer_id = $1${hasWebsiteId ? " AND website_id = $2" : ""}`,
        hasWebsiteId ? [customerId, 10] : [customerId],
      );
    }

    // These tables identify customers through user_id rather than customer_id.
    await client.query(
      "DELETE FROM sessions WHERE user_id = $1 AND user_type = 'customer'",
      [customerId],
    );
    await client.query("DELETE FROM password_reset_tokens WHERE user_id = $1", [customerId]);
    await client.query(
      "DELETE FROM notifications WHERE user_id = $1 AND user_type = 'customer' AND website_id = $2",
      [customerId, 10],
    );

    const deleted = await client.query(
      "DELETE FROM customers WHERE id = $1 AND website_id = $2 RETURNING id",
      [customerId, 10],
    );
    if (!deleted.rows[0]) throw new Error("Customer could not be deleted");

    await client.query("COMMIT");
    res.json({ success: true, id: customerId });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[portal customer delete] failed", error);
    res.status(500).json({ error: "Failed to delete customer and linked records" });
  } finally {
    client.release();
  }
});

// GET /api/portal/customers/:id
// Supplies the complete customer profile and real account IDs required by the edit screen.
router.get("/customers/:id", requireAdmin, async (req, res) => {
  const customerId = Number(req.params.id);
  const region = String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase();
  if (!Number.isSafeInteger(customerId) || customerId < 1) {
    res.status(400).json({ error: "Invalid customer id" });
    return;
  }
  if (!["ALL", "USA", "EUROPE"].includes(region)) {
    res.status(400).json({ error: "Invalid banking region" });
    return;
  }

  try {
    const customerResult = await pool.query(
      `SELECT
         c.id, c.username, c.email, c.first_name, c.last_name, c.phone,
         c.address, c.city, c.country, c.status,
         COALESCE(NULLIF(c.kyc_status, ''), 'not_submitted') AS kyc_status,
         c.created_at, NULL::timestamptz AS last_login,
         c.banking_region, c.suspension_reason AS rejection_reason
       FROM customers c
       WHERE c.id = $1 AND c.website_id = $2
         AND ($3 = 'ALL' OR c.banking_region = $3)
       LIMIT 1`,
      [customerId, 10, region],
    );
    const row = customerResult.rows[0];
    if (!row) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const accountResult = await pool.query(
      `SELECT id, account_number, account_type, balance, ledger_balance,
              currency, status, created_at
       FROM accounts
       WHERE customer_id = $1 AND website_id = $2
       ORDER BY created_at DESC, id DESC`,
      [customerId, 10],
    );

    res.json({
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      address: row.address,
      city: row.city,
      country: row.country,
      status: row.status ?? "unknown",
      kycStatus: row.kyc_status ?? "not_submitted",
      createdAt: row.created_at,
      lastLogin: row.last_login,
      bankingRegion: row.banking_region ?? null,
      rejectionReason: row.rejection_reason ?? null,
      accounts: accountResult.rows.map((account: any) => ({
        id: account.id,
        accountNumber: account.account_number,
        accountType: account.account_type,
        balance: account.balance,
        ledgerBalance: account.ledger_balance,
        currency: account.currency,
        status: account.status,
        createdAt: account.created_at,
      })),
    });
  } catch (err) {
    console.error("[portal customer] failed to load customer details", err);
    res.status(500).json({ error: "Failed to load customer details" });
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
        // Reactivation is allowed for suspended customers. Approval remains
        // limited to pending registrations, and an existing account is reused.
        if (
          customer.status !== "pending_approval" &&
          customer.status !== "suspended" &&
          customer.status !== "active"
        ) {
          return { ok: false as const, error: "not_pending" as const };
        }

        // Create the initial checking account once, within the same transaction
        // as approval, so repeated clicks or reactivation cannot create duplicates.
        const [existingAccount] = await tx.select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.customerId, customerId), eq(accounts.websiteId, 10)))
          .limit(1);
        if (!existingAccount) {
          await tx.insert(accounts).values({
            websiteId: 10,
            customerId,
            accountNumber: await generateAccountNumber(tx),
            accountType: "checking",
            currency: "USD",
            status: "active",
          });
        }
      }

      const [updated] = await tx.update(customers)
        .set({ status, suspensionReason: status === "suspended" ? (reason || null) : null, updatedAt: new Date() })
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
