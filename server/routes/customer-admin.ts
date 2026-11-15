import { Router } from "express";
import { randomInt } from "node:crypto";
import { pool } from "../db.js";
import { requireAdmin } from "../auth.js";

const router = Router();
const websiteId = 10;
const allowedStatuses = new Set(["pending_approval", "active", "inactive", "suspended", "frozen", "rejected"]);
const allowedAccountTypes = new Set(["checking", "savings", "money_market", "fixed_deposit"]);

type AccountRow = {
  id: number;
  account_number: string;
  account_type: string;
  balance: string | number;
  currency: string;
  status: string;
};

function shapeAccount(row: AccountRow | null | undefined) {
  if (!row) return null;
  return {
    id: Number(row.id),
    accountNumber: row.account_number,
    accountType: row.account_type,
    balance: row.balance,
    currency: row.currency,
    status: row.status,
  };
}

async function changeCustomerStatus(req: any, res: any) {
  const customerId = Number(req.params.id);
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  const suppliedReason = req.body?.reason ?? req.body?.rejectionReason;
  const reason = typeof suppliedReason === "string" ? suppliedReason.trim().slice(0, 1000) : "";

  if (!Number.isSafeInteger(customerId) || customerId < 1 || !allowedStatuses.has(status)) {
    res.status(400).json({ error: "Invalid customer or status" });
    return;
  }

  const adminId = Number(req.admin?.userId) || null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT id,first_name,last_name,email,status,banking_region,requested_account_type FROM customers WHERE id=$1 AND website_id=$2 FOR UPDATE",
      [customerId, websiteId],
    );
    const customer = selected.rows[0];
    if (!customer) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const existing = await client.query(
      "SELECT id,account_number,account_type,balance,currency,status FROM accounts WHERE website_id=$1 AND customer_id=$2 ORDER BY id LIMIT 1",
      [websiteId, customerId],
    );
    let account: AccountRow | null = existing.rows[0] ?? null;

    // Activating a registration must also ensure its first bank account exists.
    // Keep this in the same transaction so a failed account creation cannot
    // leave the customer active without an account.
    if (status === "active" && !account) {
      const accountType = allowedAccountTypes.has(String(customer.requested_account_type))
        ? String(customer.requested_account_type)
        : "checking";
      const currency = customer.banking_region === "EUROPE" ? "EUR" : "USD";

      for (let attempt = 0; attempt < 12 && !account; attempt++) {
        const accountNumber = String(randomInt(1_000_000_000, 9_999_999_999));
        const created = await client.query(
          `INSERT INTO accounts
             (website_id,customer_id,account_number,account_type,balance,ledger_balance,currency,status,created_at,updated_at)
           VALUES ($1,$2,$3,$4,0,0,$5,'active',NOW(),NOW())
           ON CONFLICT (account_number) DO NOTHING
           RETURNING id,account_number,account_type,balance,currency,status`,
          [websiteId, customerId, accountNumber, accountType, currency],
        );
        account = created.rows[0] ?? null;
      }
      if (!account) throw new Error("Unable to generate a unique customer account number");
    }

    const updated = await client.query(
      `UPDATE customers
       SET status=$1,
           approved_at=CASE WHEN $1='active' THEN COALESCE(approved_at,NOW()) ELSE approved_at END,
           approved_by=CASE WHEN $1='active' THEN COALESCE(approved_by,$2) ELSE approved_by END,
           rejection_reason=CASE
             WHEN $1='rejected' THEN NULLIF($3,'')
             WHEN $1='active' THEN NULL
             ELSE rejection_reason
           END,
           updated_at=NOW()
       WHERE id=$4 AND website_id=$5
       RETURNING id,status`,
      [status, adminId, reason, customerId, websiteId],
    );
    if (!updated.rows[0]) throw new Error("Customer status update did not complete");

    if (customer.status !== status && (status === "active" || status === "rejected")) {
      const notificationTable = await client.query("SELECT to_regclass('public.notifications') AS name");
      if (notificationTable.rows[0]?.name) {
        const title = status === "active" ? "Registration approved" : "Registration declined";
        const message = status === "active"
          ? "Your Avenqora Bank registration has been approved. Your account is now active."
          : reason
            ? "Your Avenqora Bank registration was declined. Reason: " + reason
            : "Your Avenqora Bank registration was declined. Please contact customer support for more information.";
        await client.query(
          "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) VALUES ($1,$2,'customer',$3,$4,$5,NOW())",
          [websiteId, customerId, title, message, status === "active" ? "success" : "error"],
        );
      }
    }

    const auditTable = await client.query("SELECT to_regclass('public.audit_logs') AS name");
    if (auditTable.rows[0]?.name && customer.status !== status) {
      const action = status === "active" && customer.status === "pending_approval"
        ? "customer_registration_approved"
        : status === "rejected"
          ? "customer_registration_rejected"
          : "customer_status_changed";
      await client.query(
        "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,resource_id,details,created_at) VALUES ($1,$2,'website_admin',$3,'customer',$4,$5::jsonb,NOW())",
        [websiteId, adminId, action, customerId, JSON.stringify({
          previousStatus: customer.status,
          status,
          reason: reason || null,
          accountId: account ? Number(account.id) : null,
        })],
      );
    }

    await client.query("COMMIT");
    res.json({
      id: Number(updated.rows[0].id),
      status: updated.rows[0].status,
      account: shapeAccount(account),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[customer approval]", error);
    res.status(500).json({ error: "Unable to update customer status" });
  } finally {
    client.release();
  }
}

// The portal's /website/customers/:id/status alias and the main admin
// dashboard's /workflows/admin/customers/:id both reach these handlers.
router.patch("/admin/customers/:id/status", requireAdmin, changeCustomerStatus);
router.patch("/admin/customers/:id", requireAdmin, changeCustomerStatus);

export default router;
