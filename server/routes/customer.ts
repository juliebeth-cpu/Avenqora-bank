import { Router } from "express";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db.js";
import { customers, accounts, transactions, shipments, trackingEvents } from "../schema.js";
import { requireCustomer } from "../auth.js";

const router = Router();
const websiteId = 10;

const ensureActiveCustomer = async (customerId: number, res: any) => {
  const result = await pool.query("SELECT status FROM customers WHERE id=$1 AND website_id=$2 LIMIT 1", [customerId, websiteId]);
  const customer = result.rows[0];
  if (!customer) { res.status(404).json({ error: "Not found" }); return false; }
  if (customer.status !== "active") { res.status(403).json({ error: "Customer account is not active" }); return false; }
  return true;
};


// GET /api/customer/profile
router.get("/profile", requireCustomer, async (req, res) => {
  try {
    const { userId } = (req as any).customer;
    if (!await ensureActiveCustomer(userId, res)) return;
    const result = await pool.query(
      "SELECT id, username, first_name AS \"firstName\", last_name AS \"lastName\", email, phone, status FROM customers WHERE id=$1 AND ($2::integer IS NULL OR website_id=$2) LIMIT 1",
      [userId, websiteId],
    );
    const c = result.rows[0];
    if (!c) { res.status(404).json({ error: "Not found" }); return; }
    res.json(c);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/customer/accounts
router.get("/accounts", requireCustomer, async (req, res) => {
  try {
    const { userId } = (req as any).customer;
    if (!await ensureActiveCustomer(userId, res)) return;
    const accountScope = websiteId === null
      ? eq(accounts.customerId, userId)
      : and(eq(accounts.customerId, userId), eq(accounts.websiteId, websiteId));
    const list = await db.select().from(accounts).where(accountScope);
    res.json(list);
  } catch (error) {
    console.error("[standalone customer accounts] request failed", error);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/customer/transactions
router.get("/transactions", requireCustomer, async (req, res) => {
  try {
    const { userId } = (req as any).customer;
    if (!await ensureActiveCustomer(userId, res)) return;
    const myAccounts = await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.customerId, userId), eq(accounts.websiteId, websiteId)));
    const ids = myAccounts.map(a => a.id);
    if (ids.length === 0) { res.json([]); return; }
    const list = await db.select().from(transactions)
      .where(and(inArray(transactions.accountId, ids), eq(transactions.websiteId, websiteId)))
      .orderBy(desc(transactions.createdAt)).limit(100);
    res.json(list);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/customer/shipments
router.get("/shipments", requireCustomer, async (req, res) => {
  try {
    const { userId } = (req as any).customer;
     const list = await db.select().from(shipments)
       .where(sql`${shipments.customerId} = ${userId} AND (${websiteId} IS NULL OR ${shipments.websiteId} = ${websiteId})`)
      .orderBy(desc(shipments.createdAt));
    res.json(list);
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/customer/tracking/:trackingNumber
 router.get("/tracking/:trackingNumber", requireCustomer, async (req, res) => {
  try {
    const normalizedTrackingNumber = String(req.params.trackingNumber ?? "").trim().toLowerCase();
    if (!normalizedTrackingNumber) { res.status(400).json({ error: "Tracking number required" }); return; }
     const [shipment] = await db.select().from(shipments).where(
       sql`lower(btrim(${shipments.trackingNumber})) = ${normalizedTrackingNumber} AND (${websiteId} IS NULL OR ${shipments.websiteId} = ${websiteId})`,
    ).limit(1);
    if (!shipment) { res.status(404).json({ error: "Shipment not found" }); return; }
     const events = await db.select().from(trackingEvents).where(eq(trackingEvents.shipmentId, shipment.id)).orderBy(desc(trackingEvents.eventTime));
     res.json({ shipment, events: events.map(event => ({ ...event, timestamp: event.eventTime })) });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
