import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAdmin, requireCustomer } from "../auth.js";
import { sendStandaloneNotification } from "../email.js";

const router = Router();
const websiteId = 10;
const websiteUid = "192eeaa7-9632-45b9-ac55-aea0f7e173db";
const bankingEnabled = true;
const textValue = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() : fallback;
const tableExists = async (table: string) => {
  const result = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1", [table]);
  return Number(result.rowCount ?? 0) > 0;
};
const trackingNumber = () => "DGL-" + new Date().toISOString().slice(0,10).replaceAll("-","") + "-" + randomUUID().replace(/-/g,"").slice(0,12).toUpperCase();
const createFinancialTracker = async (client: any, kind: "withdrawal" | "transfer", request: any) => {
  if (!await tableExists("global_payment_tracking")) return request.reference;
  const sourceKey = kind + ":" + request.id;
  const existing = await client.query("SELECT tracking_number FROM global_payment_tracking WHERE source_key=$1 LIMIT 1", [sourceKey]);
  if (existing.rows[0]) return existing.rows[0].tracking_number;
  const number = trackingNumber();
  const inserted = await client.query(
    "INSERT INTO global_payment_tracking (tracking_number,website_id,source_key,source_type,source_id,originating_reference,payment_type,payment_method,currency,amount,fee,net_amount,status,submitted_at,last_status_at) VALUES ($1,$2,$3,$4,$5,$6,$4,$7,$8,$9,$10,$11,'PENDING_VERIFICATION',NOW(),NOW()) RETURNING id",
    [number,websiteId,sourceKey,kind,request.id,request.reference,kind === "withdrawal" ? request.destination_type : request.transfer_type,request.currency,request.amount,request.fee ?? "0",request.net_amount ?? request.amount],
  );
  await client.query("UPDATE " + kind + "s SET global_payment_tracking_number=$1 WHERE id=$2 AND website_id=$3", [number,request.id,websiteId]);
  for (const [index,status] of ["CREATED","PAYMENT_SUBMITTED","PENDING_VERIFICATION"].entries()) {
    await client.query(
      "INSERT INTO global_payment_status_history (tracking_record_id,event_key,status,occurred_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (event_key) DO NOTHING",
      [inserted.rows[0].id,"standalone:"+sourceKey+":initial:"+index,status],
    );
  }
  return number;
};
const syncFinancialTracker = async (client: any, kind: "withdrawal" | "transfer", id: number, status: string, message: string | null) => {
  if (!await tableExists("global_payment_tracking")) return;
  const sourceKey = kind + ":" + id;
  const nextStatus = status === "approved" ? "APPROVED" : status === "completed" ? "COMPLETED"
    : status === "rejected" ? "REJECTED" : status === "cancelled" ? "CANCELLED"
      : status === "pending" ? "PAYMENT_SUBMITTED" : "PENDING_VERIFICATION";
  const current = await client.query("SELECT id,status FROM global_payment_tracking WHERE website_id=$1 AND source_key=$2 LIMIT 1 FOR UPDATE", [websiteId,sourceKey]);
  if (!current.rows[0] || current.rows[0].status === nextStatus) return;
  const updated = await client.query(
    "UPDATE global_payment_tracking SET status=$1,last_status_at=NOW(),completed_at=CASE WHEN $1='COMPLETED' THEN NOW() ELSE completed_at END WHERE id=$2 AND status=$3 RETURNING id",
    [nextStatus,current.rows[0].id,current.rows[0].status],
  );
  if (!updated.rows[0]) return;
  await client.query(
    "INSERT INTO global_payment_status_history (tracking_record_id,event_key,status,occurred_at,public_message) VALUES ($1,$2,$3,NOW(),$4) ON CONFLICT (event_key) DO NOTHING",
    [current.rows[0].id,"standalone:"+sourceKey+":"+nextStatus.toLowerCase(),nextStatus,message],
  );
};
const ensureReceiptVerification = async (client: any, receipt: any) => {
  if (!await tableExists("receipt_verifications")) return;
  const existing = await client.query(
    "SELECT id FROM receipt_verifications WHERE website_id=$1 AND customer_id=$2 AND source_type='financial' AND source_id=$3 LIMIT 1",
    [websiteId,receipt.customer_id,receipt.id],
  );
  if (existing.rowCount) return;
  await client.query(
    "INSERT INTO receipt_verifications (website_id,customer_id,receipt_number,verification_token,source_type,source_id,service_type,status,issued_at) VALUES ($1,$2,$3,$4,'financial',$5,'banking','valid',NOW()) ON CONFLICT (source_type,source_id) DO NOTHING",
    [websiteId,receipt.customer_id,receipt.receipt_number,"rv_"+randomUUID().replace(/-/g,""),receipt.id],
  );
};
const camelizeRow = (row: any) => Object.fromEntries(Object.entries(row).map(([key,value]) => [
  key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()),value,
]));
const actionAvailable = (region: unknown, type: string) =>
  (type === "bill_payment" || type === "zelle") ? region === "USA"
    : type === "sending_order" ? region === "EUROPE" : false;
const requireBanking = (res: any) => {
  if (!bankingEnabled) { res.status(404).json({ error: "Online Banking is not available for this website" }); return false; }
  return true;
};
const customerFor = async (req: any, res: any) => {
  const id = Number(req.customer?.userId);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(401).json({ error: "Customer session is invalid" }); return null; }
  const result = await pool.query("SELECT * FROM customers WHERE id=$1 AND website_id=$2 LIMIT 1", [id, websiteId]);
  const customer = result.rows[0];
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return null; }
  if (customer.status !== "active") { res.status(403).json({ error: "Customer account is not active" }); return null; }
  return customer;
};
const shapeAction = (row: any) => ({
  id: row.id, customerId: row.customer_id, accountId: row.account_id,
  customerName: row.customer_name, accountLabel: row.account_label, bankingRegion: row.banking_region,
  actionType: row.action_type, amount: row.amount, currency: row.currency, details: row.details ?? {},
  dueAt: row.due_at, status: row.status, reference: row.reference, adminNotes: row.admin_notes,
  reviewedAt: row.reviewed_at, settledAt: row.settled_at, refundedAt: row.refunded_at, createdAt: row.created_at,
});
const validDetails = (type: string, raw: any): { value?: Record<string, string>; error?: string } => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "Recipient details are invalid" };
  const allowed: Record<string, string[]> = {
    bill_payment: ["billerName", "billAccountReference", "note"],
    zelle: ["recipientName", "recipientContact", "note"],
    sending_order: ["recipientName", "bankName", "recipientIban", "recipientCountry", "swiftBic", "note"],
  };
  if (!allowed[type] || Object.keys(raw).some((key) => !allowed[type].includes(key))) return { error: "Recipient details are invalid" };
  const result: Record<string, string> = {};
  const required: Record<string, Record<string, number>> = {
    bill_payment: { billerName: 120, billAccountReference: 128 },
    zelle: { recipientName: 120, recipientContact: 254 },
    sending_order: { recipientName: 120, bankName: 120, recipientIban: 34, recipientCountry: 80 },
  };
  for (const [key, max] of Object.entries(required[type] ?? {})) {
    if (typeof raw[key] !== "string" || !raw[key].trim() || raw[key].trim().length > max) return { error: "Enter all required recipient details" };
    result[key] = raw[key].trim();
  }
  if (type === "zelle") {
    const contact = result.recipientContact;
    if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^\+?[0-9().\s-]{7,24}$/.test(contact))) {
      return { error: "Enter a valid recipient email address or phone number" };
    }
  }
  if (type === "sending_order") {
    const iban = result.recipientIban.replace(/\s+/g, "").toUpperCase();
    if (iban.length < 8 || !/^[A-Z0-9]+$/.test(iban)) return { error: "Enter a valid IBAN or account number" };
    result.recipientIban = iban;
    if (typeof raw.swiftBic === "string" && raw.swiftBic.trim()) {
      const swift = raw.swiftBic.trim().replace(/\s+/g, "").toUpperCase();
      if (swift.length > 11) return { error: "SWIFT / BIC must be 11 characters or fewer" };
      result.swiftBic = swift;
    }
  }
  if (raw.note !== undefined) {
    if (typeof raw.note !== "string" || raw.note.trim().length > 500) return { error: "Note must be 500 characters or fewer" };
    if (raw.note.trim()) result.note = raw.note.trim();
  }
  return { value: result };
};
const reference = (prefix: string) => prefix + "-" + randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
const audit = async (action: string, id: number, actorId: number | null, details: Record<string, unknown> = {}) => {
  if (!await tableExists("audit_logs")) return;
  await pool.query(
    "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,resource_id,details,created_at) VALUES ($1,$2,$3,$4,'banking_customer_action',$5,$6::jsonb,NOW())",
    [websiteId, actorId, actorId === null ? "customer" : "website_admin", action, id, JSON.stringify(details)],
  ).catch(() => undefined);
};
const ensureScore = async (client: any, customerId: number) => {
  await client.query(
    "INSERT INTO customer_credit_scores (website_id,customer_id,score,created_at,updated_at) VALUES ($1,$2,165,NOW(),NOW()) ON CONFLICT (website_id,customer_id) DO NOTHING",
    [websiteId, customerId],
  );
  const result = await client.query(
    "SELECT id,score FROM customer_credit_scores WHERE website_id=$1 AND customer_id=$2 FOR UPDATE",
    [websiteId, customerId],
  );
  if (!result.rows[0]) throw new Error("Unable to initialize the customer credit score");
  return result.rows[0];
};
const recordScoreOutcome = async (client: any, action: any, status: string, settledAt: Date) => {
  if (status !== "approved" && status !== "completed") return;
  const score = await ensureScore(client, Number(action.customer_id));
  const exists = await client.query(
    "SELECT id FROM customer_credit_score_events WHERE website_id=$1 AND source_type='banking_customer_action' AND source_id=$2 AND event_type='payment_outcome' LIMIT 1",
    [websiteId, action.id],
  );
  if (exists.rowCount) return;
  const before = Number(score.score);
  const after = Math.min(850, before + 2);
  const delta = after - before;
  if (delta <= 0) return;
  const result = await client.query(
    "INSERT INTO customer_credit_score_events (website_id,customer_id,credit_score_id,source_type,source_id,event_type,payment_status,points_delta,score_before,score_after,description,created_at) VALUES ($1,$2,$3,'banking_customer_action',$4,'payment_outcome',$5,$6,$7,$8,$9,$10) ON CONFLICT (website_id,source_type,source_id,event_type) DO NOTHING RETURNING id",
    [websiteId, action.customer_id, score.id, action.id, status, delta, before, after, "Payment request " + action.reference + " settled successfully.", settledAt],
  );
  if (result.rowCount) {
    await client.query("UPDATE customer_credit_scores SET score=$1,updated_at=$2 WHERE id=$3 AND website_id=$4", [after, settledAt, score.id, websiteId]);
  }
};
const reverseScoreOutcome = async (client: any, action: any, refundedAt: Date) => {
  const score = await ensureScore(client, Number(action.customer_id));
  const originalResult = await client.query(
    "SELECT points_delta FROM customer_credit_score_events WHERE website_id=$1 AND customer_id=$2 AND source_type='banking_customer_action' AND source_id=$3 AND event_type='payment_outcome' LIMIT 1",
    [websiteId, action.customer_id, action.id],
  );
  if (!originalResult.rows[0]) return;
  const existing = await client.query(
    "SELECT id FROM customer_credit_score_events WHERE website_id=$1 AND source_type='banking_customer_action' AND source_id=$2 AND event_type='reversal' LIMIT 1",
    [websiteId, action.id],
  );
  if (existing.rowCount) return;
  const before = Number(score.score);
  const after = Math.max(165, Math.min(850, before - Number(originalResult.rows[0].points_delta)));
  const delta = after - before;
  const result = await client.query(
    "INSERT INTO customer_credit_score_events (website_id,customer_id,credit_score_id,source_type,source_id,event_type,payment_status,points_delta,score_before,score_after,description,created_at) VALUES ($1,$2,$3,'banking_customer_action',$4,'reversal','refunded',$5,$6,$7,$8,$9) ON CONFLICT (website_id,source_type,source_id,event_type) DO NOTHING RETURNING id",
    [websiteId, action.customer_id, score.id, action.id, delta, before, after, "Score adjustment for " + action.reference + " reversed after refund.", refundedAt],
  );
  if (result.rowCount) {
    await client.query("UPDATE customer_credit_scores SET score=$1,updated_at=$2 WHERE id=$3 AND website_id=$4", [after, refundedAt, score.id, websiteId]);
  }
};

router.get("/customer/info", requireCustomer, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customer = await customerFor(req, res);
  if (!customer) return;
  res.json({ bankingRegion: customer.banking_region ?? null, transactionPinSet: Boolean(customer.transaction_pin_hash) });
});
router.get("/customer/actions", requireCustomer, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customer = await customerFor(req, res);
  if (!customer) return;
  if (!await tableExists("banking_customer_actions")) { res.json([]); return; }
  const result = await pool.query(
    "SELECT * FROM banking_customer_actions WHERE website_id=$1 AND customer_id=$2 ORDER BY created_at DESC",
    [websiteId, customer.id],
  );
  res.json(result.rows.map((row: any) => shapeAction(row)));
});
router.post("/customer/actions", requireCustomer, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customer = await customerFor(req, res);
  if (!customer) return;
  if (!await tableExists("banking_customer_actions") || !await tableExists("customer_credit_scores")) {
    res.status(503).json({ error: "Online Banking actions are not configured" }); return;
  }
  const type = String(req.body?.actionType ?? "");
  if (!actionAvailable(customer.banking_region, type)) { res.status(403).json({ error: "This action is not available in your banking region" }); return; }
  const details = validDetails(type, req.body?.details);
  if (!details.value) { res.status(400).json({ error: details.error ?? "Recipient details are invalid" }); return; }
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000 || Math.abs(amount * 10000 - Math.round(amount * 10000)) > 0.00001) {
    res.status(400).json({ error: "Amount must be positive and use no more than four decimal places" }); return;
  }
  if (!customer.transaction_pin_hash || typeof req.body?.transactionPin !== "string"
    || !await bcrypt.compare(req.body.transactionPin, customer.transaction_pin_hash)) {
    res.status(403).json({ error: "A valid transaction PIN is required" }); return;
  }
  const accountId = Number(req.body?.accountId);
  if (!Number.isSafeInteger(accountId) || accountId < 1) { res.status(400).json({ error: "Choose a valid account" }); return; }
  let dueAt: Date | null = null;
  if (req.body?.dueAt !== undefined && req.body?.dueAt !== null && req.body?.dueAt !== "") {
    dueAt = new Date(req.body.dueAt);
    if (!Number.isFinite(dueAt.getTime())) { res.status(400).json({ error: "Due date is invalid" }); return; }
  }
  const client = await pool.connect();
  let created: any;
  try {
    await client.query("BEGIN");
    const accountResult = await client.query(
      "SELECT id,balance,currency,status FROM accounts WHERE id=$1 AND website_id=$2 AND customer_id=$3 FOR UPDATE",
      [accountId, websiteId, customer.id],
    );
    const account = accountResult.rows[0];
    if (!account) { await client.query("ROLLBACK"); res.status(404).json({ error: "Account not found" }); return; }
    if (account.status === "frozen") { await client.query("ROLLBACK"); res.status(403).json({ error: "This account is frozen" }); return; }
    if (account.status !== "active") { await client.query("ROLLBACK"); res.status(403).json({ error: "This action requires an active account" }); return; }
    if (!String(account.currency ?? "").trim()) { await client.query("ROLLBACK"); res.status(400).json({ error: "The account currency is not configured" }); return; }
    if (Number(account.balance) < amount) { await client.query("ROLLBACK"); res.status(400).json({ error: "Insufficient balance" }); return; }
    const ref = reference("ACT");
    const label = type === "bill_payment" ? "bill payment" : type === "zelle" ? "Zelle request" : "sending order";
    const internalOnly = type === "zelle" || type === "sending_order";
    const actionResult = await client.query(
      "INSERT INTO banking_customer_actions (website_id,customer_id,account_id,action_type,amount,currency,details,due_at,status,reference,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'pending',$9,NOW(),NOW()) RETURNING *",
      [websiteId, customer.id, account.id, type, amount.toFixed(4), String(account.currency).trim().toUpperCase(), JSON.stringify(details.value), dueAt, ref],
    );
    created = actionResult.rows[0];
    await client.query(
      "INSERT INTO transactions (website_id,account_id,transaction_type,amount,gross_amount,fee,net_amount,direction,payment_method,currency,description,reference,status,metadata) VALUES ($1,$2,'debit',$3,$3,0,$3,'outgoing',$4,$5,$6,$7,'pending',$8::jsonb)",
      [websiteId, account.id, amount.toFixed(4), type, String(account.currency).trim().toUpperCase(),
        label + " " + ref + (internalOnly ? " — pending internal review; no external payment will be sent" : " — pending review"),
        ref, JSON.stringify({ requestKind: "banking_customer_action", sourceType: "banking_customer_action", sourceId: created.id, actionType: type, requestStatus: "pending" })],
    );
    if (await tableExists("notifications")) {
      const message = internalOnly
        ? "Your " + label + " " + ref + " is pending internal review. No external payment will be sent."
        : "Your " + label + " " + ref + " is pending review.";
      await client.query(
        "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,action_url,created_at) VALUES ($1,$2,'customer','Payment request submitted',$3,'transaction',$4,NOW())",
        [websiteId, customer.id, message, "/customer"],
      );
      if (await tableExists("website_admins")) {
        await client.query(
          "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,action_url,created_at) SELECT $1,id,'website_admin',$2,$3,'transaction',$4,NOW() FROM website_admins WHERE website_id=$1",
          [websiteId, "New " + label + " request", String(customer.first_name ?? "") + " " + String(customer.last_name ?? "") + " submitted " + amount.toFixed(2) + " " + account.currency + " (" + ref + ").", "/admin"],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  await audit("banking_customer_action_submitted", Number(created.id), null, { actionType: type, amount: created.amount, currency: created.currency, reference: created.reference, requestStatus: "pending" });
  res.status(201).json(shapeAction(created));
});
router.get("/customer/credit-score", requireCustomer, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customer = await customerFor(req, res);
  if (!customer) return;
  if (!await tableExists("customer_credit_scores") || !await tableExists("customer_credit_score_events")) {
    res.status(503).json({ error: "Credit score history is not configured" }); return;
  }
  const client = await pool.connect();
  let score: any;
  try {
    await client.query("BEGIN");
    score = await ensureScore(client, Number(customer.id));
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
  const history = await pool.query(
    "SELECT id,event_type,payment_status,points_delta,score_before,score_after,description,created_at FROM customer_credit_score_events WHERE website_id=$1 AND customer_id=$2 AND event_type='payment_outcome' AND payment_status IN ('approved','completed') AND points_delta>0 ORDER BY created_at DESC,id DESC LIMIT 30",
    [websiteId, customer.id],
  );
  res.json({ score: Number(score.score), baseline: 165, history: history.rows.map((row: any) => ({
    id: row.id, eventType: row.event_type, paymentStatus: row.payment_status, pointsDelta: row.points_delta,
    scoreBefore: row.score_before, scoreAfter: row.score_after, description: row.description, createdAt: row.created_at,
  })) });
});

const supportMessageShape = (row: any, customerName?: string) => ({
  id: Number(row.id),
  customerId: Number(row.customer_id),
  ...(customerName ? { customerName } : {}),
  senderType: row.sender_type,
  body: row.body,
  customerReadAt: row.customer_read_at ? new Date(row.customer_read_at).toISOString() : null,
  adminReadAt: row.admin_read_at ? new Date(row.admin_read_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});
router.get("/customer/messages", requireCustomer, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customer = await customerFor(req, res);
  if (!customer) return;
  if (customer.banking_region !== "EUROPE") { res.status(403).json({ error: "Customer messaging is available only in the Europe banking region" }); return; }
  if (!await tableExists("banking_support_messages")) { res.json([]); return; }
  await pool.query(
    "UPDATE banking_support_messages SET customer_read_at=NOW() WHERE website_id=$1 AND customer_id=$2 AND sender_type='website_admin' AND customer_read_at IS NULL",
    [websiteId, customer.id],
  );
  const result = await pool.query(
    "SELECT * FROM banking_support_messages WHERE website_id=$1 AND customer_id=$2 ORDER BY created_at,id",
    [websiteId, customer.id],
  );
  res.json(result.rows.map((row: any) => ({
    ...supportMessageShape(row),
    senderName: row.sender_type === "website_admin" ? "Customer service" : customer.first_name + " " + customer.last_name,
  })));
});
router.post("/customer/messages", requireCustomer, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customer = await customerFor(req, res);
  if (!customer) return;
  if (customer.banking_region !== "EUROPE") { res.status(403).json({ error: "Customer messaging is available only in the Europe banking region" }); return; }
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!body || body.length > 5000) { res.status(400).json({ error: "Message must be between 1 and 5,000 characters" }); return; }
  if (!await tableExists("banking_support_messages")) { res.status(503).json({ error: "Customer service messaging is not configured" }); return; }
  const inserted = await pool.query(
    "INSERT INTO banking_support_messages (website_id,customer_id,sender_type,body,customer_read_at,created_at) VALUES ($1,$2,'customer',$3,NOW(),NOW()) RETURNING *",
    [websiteId, customer.id, body],
  );
  if (await tableExists("notifications") && await tableExists("website_admins")) {
    await pool.query(
      "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,action_url,created_at) SELECT $1,id,'website_admin','New customer message',$2,'info','/admin',NOW() FROM website_admins WHERE website_id=$1",
      [websiteId, customer.first_name + " " + customer.last_name + " sent a support message."],
    );
  }
  res.status(201).json(supportMessageShape(inserted.rows[0], customer.first_name + " " + customer.last_name));
});

router.get("/admin/messages", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("banking_support_messages")) { res.json([]); return; }
  const region = String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase();
  if (!["ALL", "USA", "EUROPE"].includes(region)) { res.status(400).json({ error: "Invalid banking region" }); return; }
  if (region === "USA") { res.json([]); return; }
  const customers = await pool.query(
    "SELECT id,first_name,last_name FROM customers WHERE website_id=$1 AND banking_region='EUROPE'",
    [websiteId],
  );
  const ids = customers.rows.map((row: any) => Number(row.id));
  if (!ids.length) { res.json([]); return; }
  await pool.query(
    "UPDATE banking_support_messages SET admin_read_at=NOW() WHERE website_id=$1 AND customer_id=ANY($2::int[]) AND sender_type='customer' AND admin_read_at IS NULL",
    [websiteId, ids],
  );
  const result = await pool.query(
    "SELECT * FROM banking_support_messages WHERE website_id=$1 AND customer_id=ANY($2::int[]) ORDER BY created_at,id",
    [websiteId, ids],
  );
  const names = new Map(customers.rows.map((row: any) => [Number(row.id), row.first_name + " " + row.last_name]));
  res.json(result.rows.map((row: any) => supportMessageShape(row, names.get(Number(row.customer_id)) ?? "Customer")));
});
router.post("/admin/messages", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const customerId = Number(req.body?.customerId);
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!Number.isSafeInteger(customerId) || customerId < 1 || !body || body.length > 5000) {
    res.status(400).json({ error: "A customer and a message of 1 to 5,000 characters are required" }); return;
  }
  const customerResult = await pool.query(
    "SELECT id,first_name,last_name,banking_region FROM customers WHERE id=$1 AND website_id=$2 AND banking_region='EUROPE' LIMIT 1",
    [customerId, websiteId],
  );
  const customer = customerResult.rows[0];
  if (!customer) { res.status(404).json({ error: "Customer conversation not found" }); return; }
  if (!await tableExists("banking_support_messages")) { res.status(503).json({ error: "Customer service messaging is not configured" }); return; }
  const inserted = await pool.query(
    "INSERT INTO banking_support_messages (website_id,customer_id,sender_type,sender_admin_id,body,admin_read_at,created_at) VALUES ($1,$2,'website_admin',$3,$4,NOW(),NOW()) RETURNING *",
    [websiteId, customerId, Number(req.admin?.userId) || null, body],
  );
  if (await tableExists("notifications")) {
    await pool.query(
      "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,action_url,created_at) VALUES ($1,$2,'customer','New customer service reply','Customer service replied to your message.','info',$3,NOW())",
      [websiteId, customerId, "/banking/" + encodeURIComponent(websiteUid) + "/messages"],
    );
  }
  res.status(201).json(supportMessageShape(inserted.rows[0], customer.first_name + " " + customer.last_name));
});

const adminRegionCustomerIds = async (req: any) => {
  const raw = String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase();
  if (!["ALL", "USA", "EUROPE"].includes(raw)) return { invalid: true as const, ids: [] as number[] };
  if (raw === "ALL") return { invalid: false as const, ids: null as number[] | null };
  const result = await pool.query("SELECT id FROM customers WHERE website_id=$1 AND banking_region=$2", [websiteId, raw]);
  return { invalid: false as const, ids: result.rows.map((row: any) => Number(row.id)) };
};
const countScopedRecords = async (table: string, customerIds: number[] | null, status?: string) => {
  if (!await tableExists(table)) return 0;
  const entityColumn = table === "customers" ? "id" : "customer_id";
  const where = customerIds === null ? "website_id=$1" : "website_id=$1 AND " + entityColumn + "=ANY($2::int[])";
  const values: unknown[] = customerIds === null ? [websiteId] : [websiteId, customerIds];
  const statusClause = status ? " AND status=$" + (values.length + 1) : "";
  if (status) values.push(status);
  const result = await pool.query("SELECT COUNT(*)::int AS count FROM " + table + " WHERE " + where + statusClause, values);
  return Number(result.rows[0]?.count ?? 0);
};
const scopedFinancialRows = async (req: any, table: "withdrawals" | "transfers") => {
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { return { invalid: true, rows: [] }; }
  if (!await tableExists(table) || scope.ids?.length === 0) return { invalid: false, rows: [] };
  const where = scope.ids === null ? "website_id=$1" : "website_id=$1 AND customer_id=ANY($2::int[])";
  const values: unknown[] = scope.ids === null ? [websiteId] : [websiteId,scope.ids];
  const status = textValue(req.query?.status);
  if (status && !["pending","approved","completed","rejected","cancelled","hold","processing","expired"].includes(status)) {
    return { invalid:true,rows:[] };
  }
  const statusFilter = status ? " AND r.status=$" + (values.length + 1) : "";
  if (status) values.push(status);
  const rows = await pool.query("SELECT r.*,c.first_name,c.last_name,c.banking_region FROM " + table + " r JOIN customers c ON c.id=r.customer_id AND c.website_id=r.website_id WHERE " + where.replaceAll("website_id","r.website_id").replaceAll("customer_id","r.customer_id") + statusFilter + " ORDER BY r.created_at DESC LIMIT 500",values);
  return { invalid:false,rows:rows.rows };
};
router.get("/admin/withdrawals", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const result = await scopedFinancialRows(req,"withdrawals");
  if (result.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  res.json(result.rows.map((row: any) => ({
    id:Number(row.id),websiteId:Number(row.website_id),customerId:Number(row.customer_id),customerName:row.first_name+" "+row.last_name,
    bankingRegion:row.banking_region,accountId:Number(row.account_id),amount:row.amount,currency:row.currency,
    destinationType:row.destination_type,fee:row.fee,netAmount:row.net_amount,direction:row.direction,
    balanceBefore:row.balance_before,balanceAfter:row.balance_after,completedAt:row.completed_at,
    destinationDetails:row.destination_details ?? {},status:row.status,adminNotes:row.admin_notes,
    reference:row.reference,paymentTrackingNumber:row.global_payment_tracking_number ?? row.reference,
    createdAt:row.created_at,updatedAt:row.updated_at,
  })));
});
router.get("/admin/transfers", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const result = await scopedFinancialRows(req,"transfers");
  if (result.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  res.json(result.rows.map((row: any) => ({
    id:Number(row.id),websiteId:Number(row.website_id),customerId:Number(row.customer_id),customerName:row.first_name+" "+row.last_name,
    bankingRegion:row.banking_region,fromAccountId:Number(row.from_account_id),toAccountId:row.to_account_id ?? null,
    transferType:row.transfer_type,beneficiaryDetails:row.beneficiary_details ?? {},amount:row.amount,currency:row.currency,
    fee:row.fee,netAmount:row.net_amount,direction:row.direction,balanceBefore:row.balance_before,balanceAfter:row.balance_after,
    completedAt:row.completed_at,status:row.status,adminNotes:row.admin_notes,reference:row.reference,
    paymentTrackingNumber:row.global_payment_tracking_number ?? row.reference,createdAt:row.created_at,updatedAt:row.updated_at,
  })));
});
const settleBankingRequest = async (kind: "withdrawal" | "transfer", id: number, status: string, adminNotes: string | null, reviewerId: number) => {
  const table = kind === "withdrawal" ? "withdrawals" : "transfers";
  const moneyUnits = (value: unknown) => {
    const text = String(value).trim();
    if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new Error("Invalid financial amount");
    const [whole,fraction=""] = text.split(".");
    return BigInt(whole)*10000n+BigInt((fraction+"0000").slice(0,4));
  };
  const formatUnits = (units: bigint) => (units/10000n).toString()+"."+((units%10000n).toString().padStart(4,"0"));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const requestResult = await client.query("SELECT * FROM " + table + " WHERE id=$1 AND website_id=$2 FOR UPDATE",[id,websiteId]);
    const request = requestResult.rows[0];
    if (!request) throw Object.assign(new Error(kind === "withdrawal" ? "Withdrawal not found" : "Transfer not found"),{statusCode:404});
    if (["approved","completed","rejected","cancelled"].includes(request.status)) throw Object.assign(new Error(kind+" already "+request.status),{statusCode:409});
    const accountId = kind === "withdrawal" ? Number(request.account_id) : Number(request.from_account_id);
    const accountResult = await client.query("SELECT * FROM accounts WHERE id=$1 AND website_id=$2 AND customer_id=$3 FOR UPDATE",[accountId,websiteId,request.customer_id]);
    const account = accountResult.rows[0];
    if (!account) throw Object.assign(new Error("Financial request account ownership could not be verified"),{statusCode:403});
    const amount = moneyUnits(request.amount);
    let fee = moneyUnits(request.fee ?? 0);
    let netAmount = request.net_amount == null ? amount-fee : moneyUnits(request.net_amount);
    if (kind === "transfer") {
      let transferFeePercent = 0.05;
      const setting = await client.query("SELECT setting_value FROM website_settings WHERE website_id=$1 AND setting_key='banking_settings' LIMIT 1", [websiteId]).catch(() => ({ rows: [] }));
      try {
        const parsed = JSON.parse(setting.rows[0]?.setting_value ?? "{}");
        const configured = Number(parsed.transferFeePercent ?? 0.05);
        if (Number.isFinite(configured) && configured >= 0 && configured <= 100) transferFeePercent = configured;
      } catch {}
      if (String(request.transfer_type ?? "").toLowerCase() === "international") {
        const rateUnits = BigInt(Math.round(transferFeePercent * 10000));
        fee = (amount * rateUnits + 500000n) / 1000000n;
      } else {
        fee = 0n;
      }
      netAmount = amount - fee;
    }
    const approved = status === "approved" || status === "completed";
    const balanceBefore = moneyUnits(account.balance);
    let balanceAfter = balanceBefore;
    if (approved) {
      if (account.status !== "active") throw Object.assign(new Error("Only an active source account can be debited"),{statusCode:403});
      const totalDebit = amount + fee;
      if (balanceBefore < totalDebit) throw Object.assign(new Error("Insufficient balance"),{statusCode:400});
      balanceAfter = balanceBefore-totalDebit;
      await client.query("UPDATE accounts SET balance=$1,updated_at=NOW() WHERE id=$2 AND website_id=$3",[formatUnits(balanceAfter),accountId,websiteId]);
    }
    const ledgerStatus = approved ? "completed" : status === "hold" || status === "pending" ? "pending" : status === "processing" ? "processing" : status;
    const requestUpdate = kind === "withdrawal"
      ? "UPDATE withdrawals SET status=$1,admin_notes=$2,reviewed_by=$3,reviewed_at=NOW(),completed_at=CASE WHEN $4 THEN NOW() ELSE NULL END,balance_before=$5,balance_after=$6,updated_at=NOW() WHERE id=$7 AND website_id=$8 RETURNING *"
      : "UPDATE transfers SET status=$1,admin_notes=$2,reviewed_by=$3,reviewed_at=NOW(),completed_at=CASE WHEN $4 THEN NOW() ELSE NULL END,balance_before=$5,balance_after=$6,fee=$9,net_amount=$10,updated_at=NOW() WHERE id=$7 AND website_id=$8 RETURNING *";
    const updateValues = [status,adminNotes,reviewerId,approved,formatUnits(balanceBefore),formatUnits(balanceAfter),id,websiteId];
    if (kind === "transfer") updateValues.push(formatUnits(fee),formatUnits(netAmount));
    const updatedResult = await client.query(requestUpdate,updateValues);
    const reference = request.reference;
    const ledger = await client.query(
      "UPDATE transactions SET status=$1,reviewer_id=$2,completed_at=CASE WHEN $3 THEN NOW() ELSE NULL END,balance_before=$4,balance_after=$5,fee=CASE WHEN $10::boolean THEN $11 ELSE fee END,net_amount=CASE WHEN $10::boolean THEN $12 ELSE net_amount END,metadata=COALESCE(metadata,'{}'::jsonb)||$6::jsonb,updated_at=NOW() WHERE website_id=$7 AND account_id=$8 AND reference=$9 AND status='pending' RETURNING id",
      [ledgerStatus,reviewerId,approved,formatUnits(balanceBefore),formatUnits(balanceAfter),JSON.stringify({requestKind:kind,sourceId:id,requestStatus:status}),websiteId,accountId,reference,kind === "transfer",formatUnits(fee),formatUnits(netAmount)],
    );
    if (!ledger.rowCount) throw Object.assign(new Error(kind+" ledger was already settled"),{statusCode:409});
    if (approved && kind === "transfer" && request.transfer_type === "internal" && request.to_account_id) {
      const destinationResult = await client.query("SELECT * FROM accounts WHERE id=$1 AND website_id=$2 FOR UPDATE",[request.to_account_id,websiteId]);
      const destination = destinationResult.rows[0];
      if (!destination || destination.status !== "active" || String(destination.currency).toUpperCase() !== String(request.currency).toUpperCase()) {
        throw Object.assign(new Error("The internal transfer destination is no longer available"),{statusCode:409});
      }
      const destinationBefore = moneyUnits(destination.balance);
      const destinationAfter = destinationBefore+netAmount;
      await client.query("UPDATE accounts SET balance=$1,updated_at=NOW() WHERE id=$2 AND website_id=$3",[formatUnits(destinationAfter),destination.id,websiteId]);
      await client.query("INSERT INTO transactions (website_id,account_id,transaction_type,amount,gross_amount,fee,net_amount,direction,currency,description,reference,status,completed_at,created_at,updated_at,metadata,balance_before,balance_after) VALUES ($1,$2,'transfer',$3,$4,0,$3,'incoming',$5,$6,$7,'completed',NOW(),NOW(),NOW(),$8::jsonb,$9,$10)",[websiteId,destination.id,formatUnits(netAmount),formatUnits(amount),request.currency,"Transfer "+reference+" in", "TXN-"+randomUUID().replace(/-/g,"").slice(0,12).toUpperCase(),JSON.stringify({requestKind:"transfer",sourceId:id,direction:"incoming"}),formatUnits(destinationBefore),formatUnits(destinationAfter)]);
    }
    await syncFinancialTracker(client,kind,id,status,adminNotes);
    if (await tableExists("receipts") && (kind === "transfer" || approved)) {
      const existing = await client.query("SELECT id,receipt_number,customer_id FROM receipts WHERE website_id=$1 AND customer_id=$2 AND transaction_kind=$3 AND source_id=$4 AND deleted_at IS NULL LIMIT 1",[websiteId,request.customer_id,kind,id]);
      if (existing.rowCount) {
        await client.query("UPDATE receipts SET status=$1,amount=$2,gross_amount=$2,fee=$3,net_amount=$4,direction='outgoing',currency=$5,reference=$6,payment_method=$7 WHERE id=$8 AND website_id=$9",[status,formatUnits(amount),formatUnits(fee),formatUnits(netAmount),request.currency,reference,kind === "withdrawal" ? request.destination_type : request.transfer_type,existing.rows[0].id,websiteId]);
        await ensureReceiptVerification(client,existing.rows[0]);
      } else {
        const insertedReceipt = await client.query("INSERT INTO receipts (website_id,customer_id,receipt_number,transaction_kind,source_id,amount,gross_amount,fee,net_amount,direction,currency,status,payment_method,reference,issued_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,'outgoing',$9,$10,$11,$12,NOW(),NOW()) RETURNING id,receipt_number,customer_id",[websiteId,request.customer_id,"RCPT-"+randomUUID().replace(/-/g,"").slice(0,12).toUpperCase(),kind,id,formatUnits(amount),formatUnits(fee),formatUnits(netAmount),request.currency,status,kind === "withdrawal" ? request.destination_type : request.transfer_type,reference]);
        await ensureReceiptVerification(client,insertedReceipt.rows[0]);
      }
    }
    await client.query("COMMIT");
    const notificationCustomer = await pool.query("SELECT email,first_name FROM customers WHERE id=$1 AND website_id=$2 LIMIT 1",[request.customer_id,websiteId]);
    if (notificationCustomer.rows[0]) {
      const event = kind === "transfer" ? "transfer_update"
        : approved ? "withdrawal_success"
          : status === "processing" || status === "confirming" ? "withdrawal_processing"
            : status === "rejected" || status === "cancelled" ? "withdrawal_declined" : "withdrawal_requested";
      await sendStandaloneNotification({
        customerId:Number(request.customer_id),recipient:notificationCustomer.rows[0].email,
        firstName:notificationCustomer.rows[0].first_name,event,
        values:{ amount:formatUnits(amount),currency:request.currency,status:approved?"completed":status,reference,adminNotes:adminNotes ?? "" },
      });
    }
    return updatedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
};
router.patch("/admin/withdrawals/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const id = Number(req.params.id), status = textValue(req.body?.status), notes = textValue(req.body?.adminNotes) || null;
  if (!Number.isInteger(id) || id < 1 || !["approved","rejected","hold","cancelled","pending"].includes(status)) { res.status(400).json({ error:"Invalid withdrawal review" }); return; }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const owned = await pool.query("SELECT customer_id FROM withdrawals WHERE id=$1 AND website_id=$2 LIMIT 1",[id,websiteId]);
  if (!owned.rowCount || (scope.ids && !scope.ids.includes(Number(owned.rows[0].customer_id)))) { res.status(404).json({ error:"Withdrawal not found" }); return; }
  try {
    const updated = await settleBankingRequest("withdrawal",id,status,notes,Number(req.admin?.userId));
    await audit("transaction_status_"+status,id,Number(req.admin?.userId)||null,{ status,adminNotes:notes });
    res.json({ id:Number(updated.id),websiteId:Number(updated.website_id),customerId:Number(updated.customer_id),accountId:Number(updated.account_id),amount:updated.amount,currency:updated.currency,destinationType:updated.destination_type,fee:updated.fee,netAmount:updated.net_amount,direction:updated.direction,balanceBefore:updated.balance_before,balanceAfter:updated.balance_after,completedAt:updated.completed_at,destinationDetails:updated.destination_details ?? {},status:updated.status,adminNotes:updated.admin_notes,reference:updated.reference,paymentTrackingNumber:updated.global_payment_tracking_number ?? updated.reference,createdAt:updated.created_at,updatedAt:updated.updated_at });
  } catch (error: any) { if (error?.statusCode) { res.status(error.statusCode).json({ error:error.message }); return; } throw error; }
});
router.patch("/admin/transfers/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const id = Number(req.params.id), status = textValue(req.body?.status), notes = textValue(req.body?.adminNotes) || null;
  if (!Number.isInteger(id) || id < 1 || !["approved","rejected","completed","cancelled"].includes(status)) { res.status(400).json({ error:"Invalid transfer review" }); return; }
  if (status === "rejected" && !notes) { res.status(400).json({ error:"A rejection reason is required" }); return; }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const owned = await pool.query("SELECT customer_id FROM transfers WHERE id=$1 AND website_id=$2 LIMIT 1",[id,websiteId]);
  if (!owned.rowCount || (scope.ids && !scope.ids.includes(Number(owned.rows[0].customer_id)))) { res.status(404).json({ error:"Transfer not found" }); return; }
  try {
    const updated = await settleBankingRequest("transfer",id,status,notes,Number(req.admin?.userId));
    await audit("transaction_status_"+status,id,Number(req.admin?.userId)||null,{ status,adminNotes:notes });
    res.json({ id:Number(updated.id),websiteId:Number(updated.website_id),customerId:Number(updated.customer_id),fromAccountId:Number(updated.from_account_id),toAccountId:updated.to_account_id ?? null,transferType:updated.transfer_type,beneficiaryDetails:updated.beneficiary_details ?? {},amount:updated.amount,currency:updated.currency,fee:updated.fee,netAmount:updated.net_amount,direction:updated.direction,balanceBefore:updated.balance_before,balanceAfter:updated.balance_after,completedAt:updated.completed_at,status:updated.status,adminNotes:updated.admin_notes,reference:updated.reference,paymentTrackingNumber:updated.global_payment_tracking_number ?? updated.reference,createdAt:updated.created_at,updatedAt:updated.updated_at });
  } catch (error: any) { if (error?.statusCode) { res.status(error.statusCode).json({ error:error.message }); return; } throw error; }
});
router.get("/admin/loans", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  if (!await tableExists("loans") || scope.ids?.length === 0) { res.json([]); return; }
  const filter = scope.ids === null ? "" : " AND l.customer_id=ANY($2::int[])";
  const values: unknown[] = scope.ids === null ? [websiteId] : [websiteId,scope.ids];
  const status = textValue(req.query?.status);
  if (status && !["pending","active","rejected","completed","cancelled"].includes(status)) { res.status(400).json({ error:"Invalid loan status" }); return; }
  const statusFilter = status ? " AND l.status=$" + (values.length + 1) : "";
  if (status) values.push(status);
  const result = await pool.query("SELECT l.*,c.first_name,c.last_name FROM loans l JOIN customers c ON c.id=l.customer_id AND c.website_id=l.website_id WHERE l.website_id=$1"+filter+statusFilter+" ORDER BY l.created_at DESC",values);
  res.json(result.rows.map((row: any) => ({ ...camelizeRow(row),customerName:row.first_name+" "+row.last_name })));
});
router.patch("/admin/loans/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const id = Number(req.params.id), status = textValue(req.body?.status), notes = textValue(req.body?.adminNotes) || null;
  const hasInterestRate = req.body?.interestRate !== undefined;
  const updatesInterestRate = status === "approved" && hasInterestRate;
  const interestRate = hasInterestRate ? Number(req.body.interestRate) : null;
  if (!Number.isInteger(id) || id < 1 || !["approved","rejected"].includes(status)
      || (hasInterestRate && !Number.isFinite(interestRate))) {
    res.status(400).json({ error:"Invalid loan review" }); return;
  }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const owned = await pool.query("SELECT customer_id FROM loans WHERE id=$1 AND website_id=$2 LIMIT 1",[id,websiteId]);
  if (!owned.rowCount || (scope.ids && !scope.ids.includes(Number(owned.rows[0].customer_id)))) { res.status(404).json({ error:"Loan not found" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT * FROM loans WHERE id=$1 AND website_id=$2 FOR UPDATE",[id,websiteId]);
    const loan = selected.rows[0];
    if (!loan) { await client.query("ROLLBACK"); res.status(404).json({ error:"Loan not found" }); return; }
    if (loan.status !== "pending") { await client.query("ROLLBACK"); res.status(400).json({ error:"Loan already "+loan.status }); return; }
    const accountResult = await client.query("SELECT * FROM accounts WHERE id=$1 AND website_id=$2 AND customer_id=$3 FOR UPDATE",[loan.account_id,websiteId,loan.customer_id]);
    const account = accountResult.rows[0];
    if (!account) { await client.query("ROLLBACK"); res.status(404).json({ error:"Loan account not found" }); return; }
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setMonth(dueDate.getMonth()+Number(loan.term_months));
    let monthlyPayment: number | null = null;
    let totalRepayable: number | null = null;
    if (updatesInterestRate) {
      const monthlyRate = Number(interestRate)/100/12;
      const principal = Number(loan.principal_amount);
      monthlyPayment = monthlyRate === 0 ? principal/Number(loan.term_months) : principal*monthlyRate*Math.pow(1+monthlyRate,Number(loan.term_months))/(Math.pow(1+monthlyRate,Number(loan.term_months))-1);
      totalRepayable = monthlyPayment*Number(loan.term_months);
    }
    const approved = status === "approved";
    const moneyUnits = (value: unknown) => {
      const text = String(value).trim();
      if (!/^\d+(?:\.\d{1,4})?$/.test(text)) throw new Error("Invalid financial amount");
      const [whole,fraction=""] = text.split(".");
      return BigInt(whole)*10000n+BigInt((fraction+"0000").slice(0,4));
    };
    const formatUnits = (units: bigint) => (units/10000n).toString()+"."+((units%10000n).toString().padStart(4,"0"));
    const balanceBeforeUnits = moneyUnits(account.balance);
    const balanceAfterUnits = approved ? balanceBeforeUnits+moneyUnits(loan.principal_amount) : balanceBeforeUnits;
    if (approved) await client.query("UPDATE accounts SET balance=$1,updated_at=NOW() WHERE id=$2 AND website_id=$3",[formatUnits(balanceAfterUnits),account.id,websiteId]);
    const loanUpdate = updatesInterestRate
      ? "UPDATE loans SET status=$1,admin_notes=$2,reviewed_by=$3,reviewed_at=NOW(),disbursed_at=CASE WHEN $4 THEN NOW() ELSE disbursed_at END,due_date=CASE WHEN $4 THEN $5 ELSE due_date END,interest_rate=$6,monthly_payment=$7,total_repayable=$8,updated_at=NOW() WHERE id=$9 AND website_id=$10 RETURNING *"
      : "UPDATE loans SET status=$1,admin_notes=$2,reviewed_by=$3,reviewed_at=NOW(),disbursed_at=CASE WHEN $4 THEN NOW() ELSE disbursed_at END,due_date=CASE WHEN $4 THEN $5 ELSE due_date END,updated_at=NOW() WHERE id=$6 AND website_id=$7 RETURNING *";
    const loanValues = updatesInterestRate
      ? [approved?"active":"rejected",notes,Number(req.admin?.userId)||null,approved,approved?dueDate:null,Number(interestRate).toFixed(4),Number(monthlyPayment).toFixed(4),Number(totalRepayable).toFixed(4),id,websiteId]
      : [approved?"active":"rejected",notes,Number(req.admin?.userId)||null,approved,approved?dueDate:null,id,websiteId];
    const updated = await client.query(loanUpdate, loanValues);
    const ledgerStatus = approved ? "completed" : "rejected";
    const ledger = await client.query("UPDATE transactions SET status=$1,reviewer_id=$2,completed_at=CASE WHEN $3 THEN NOW() ELSE NULL END,direction='incoming',balance_before=$4,balance_after=$5,metadata=COALESCE(metadata,'{}'::jsonb)||$6::jsonb,updated_at=NOW() WHERE website_id=$7 AND account_id=$8 AND reference=$9 AND status='pending' RETURNING id",[ledgerStatus,Number(req.admin?.userId)||null,approved,formatUnits(balanceBeforeUnits),formatUnits(balanceAfterUnits),JSON.stringify({requestKind:"loan",sourceId:id,requestStatus:status}),websiteId,account.id,loan.reference]);
    if (!ledger.rowCount) throw Object.assign(new Error("Loan ledger was already settled"),{statusCode:409});
    if (approved && await tableExists("receipts")) {
      const receipt = await client.query("INSERT INTO receipts (website_id,customer_id,receipt_number,transaction_kind,source_id,amount,gross_amount,fee,net_amount,direction,currency,status,reference,issued_at,created_at) VALUES ($1,$2,$3,'loan',$4,$5,$5,0,$5,'incoming',$6,'approved',$7,NOW(),NOW()) ON CONFLICT DO NOTHING RETURNING id,receipt_number,customer_id",[websiteId,loan.customer_id,"RCPT-"+randomUUID().replace(/-/g,"").slice(0,12).toUpperCase(),id,loan.principal_amount,loan.currency,loan.reference]);
      if (receipt.rows[0]) await ensureReceiptVerification(client,receipt.rows[0]);
    }
    if (await tableExists("notifications")) {
      await client.query("INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) VALUES ($1,$2,'customer','Loan application update',$3,$4,NOW())",[websiteId,loan.customer_id,"Your loan application of "+loan.principal_amount+" "+loan.currency+" has been "+(approved?"approved":"rejected")+".",approved?"success":"error"]);
    }
    await client.query("COMMIT");
    await audit("loan_reviewed",id,Number(req.admin?.userId)||null,{ status });
    res.json(camelizeRow(updated.rows[0]));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
});

router.get("/admin/dashboard", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error: "Invalid banking region" }); return; }
  const ids = scope.ids;
  const customerWhere = ids === null ? "website_id=$1" : "website_id=$1 AND id=ANY($2::int[])";
  const customerValues = ids === null ? [websiteId] : [websiteId, ids];
  const recordWhere = (alias = "") => ids === null ? "website_id=$1" : "website_id=$1 AND customer_id=ANY($2::int[])";
  const countCustomers = await pool.query("SELECT COUNT(*)::int AS count FROM customers WHERE " + customerWhere, customerValues);
  const activeCustomers = await pool.query("SELECT COUNT(*)::int AS count FROM customers WHERE " + customerWhere + " AND status='active'", customerValues);
  const accountWhere = ids === null ? "website_id=$1" : "website_id=$1 AND customer_id=ANY($2::int[])";
  const accounts = await pool.query("SELECT COUNT(*)::int AS count FROM accounts WHERE " + accountWhere, customerValues);
  const activeAccounts = await pool.query("SELECT COUNT(*)::int AS count FROM accounts WHERE " + accountWhere + " AND status='active'", customerValues);
  const balances = await pool.query("SELECT currency,COALESCE(SUM(balance),0)::text AS amount FROM accounts WHERE " + accountWhere + " GROUP BY currency", customerValues);
  const pendingCustomerResult = await pool.query("SELECT COUNT(*)::int AS count FROM customers WHERE " + customerWhere + " AND status='pending_approval'", customerValues);
  const [pendingDeposits,pendingWithdrawals,pendingTransfers,pendingCards,pendingKyc,pendingLoans] = await Promise.all([
    countScopedRecords("deposits", ids, "pending"),
    countScopedRecords("withdrawals", ids, "pending"),
    countScopedRecords("transfers", ids, "pending"),
    countScopedRecords("bank_cards", ids, "pending"),
    countScopedRecords("kyc_submissions", ids, "pending"),
    countScopedRecords("loans", ids, "pending"),
  ]);
  const pendingCustomers = Number(pendingCustomerResult.rows[0]?.count ?? 0);
  const pendingTransactions = await pool.query(
    "SELECT COUNT(*)::int AS count FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.website_id=t.website_id WHERE t.website_id=$1 AND t.status='pending'" +
    (ids === null ? "" : " AND a.customer_id=ANY($2::int[])"),
    customerValues,
  );
  const todayTransactions = await pool.query(
    "SELECT COUNT(*)::int AS count FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.website_id=t.website_id WHERE t.website_id=$1 AND t.created_at>=date_trunc('day',NOW())" +
    (ids === null ? "" : " AND a.customer_id=ANY($2::int[])"),
    customerValues,
  );
  res.json({
    region: String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase(),
    totalCustomers: Number(countCustomers.rows[0]?.count ?? 0),
    activeCustomers: Number(activeCustomers.rows[0]?.count ?? 0),
    activeAccounts: Number(activeAccounts.rows[0]?.count ?? 0),
    totalAccounts: Number(accounts.rows[0]?.count ?? 0),
    pendingApprovals: pendingCustomers + pendingDeposits + pendingWithdrawals + pendingTransfers + pendingCards + pendingKyc + pendingLoans,
    pendingCustomers, pendingDeposits, pendingWithdrawals, pendingTransfers, pendingCards, pendingKyc, pendingLoans,
    pendingTransactions: Number(pendingTransactions.rows[0]?.count ?? 0),
    todayTransactions: Number(todayTransactions.rows[0]?.count ?? 0),
    balancesByCurrency: balances.rows,
  });
});

router.get("/admin/transactions", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error: "Invalid banking region" }); return; }
  const filter = scope.ids === null ? "" : " AND a.customer_id=ANY($2::int[])";
  const values = scope.ids === null ? [websiteId] : [websiteId, scope.ids];
  const result = await pool.query(
    "SELECT t.id,t.reference AS transaction_id,c.id AS customer_id,c.first_name || ' ' || c.last_name AS customer_name,a.id AS account_id,a.account_number,t.transaction_type,t.amount,t.currency,c.banking_region AS region,t.created_at,t.status,t.reference,t.description FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.website_id=t.website_id JOIN customers c ON c.id=a.customer_id AND c.website_id=a.website_id WHERE t.website_id=$1" + filter + " ORDER BY t.created_at DESC LIMIT 500",
    values,
  );
  res.json(result.rows);
});

router.get("/admin/audit-logs", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("audit_logs")) { res.json([]); return; }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error: "Invalid banking region" }); return; }
  const result = await pool.query("SELECT * FROM audit_logs WHERE website_id=$1 ORDER BY created_at DESC", [websiteId]);
  let visibleLogs = result.rows;
  if (scope.ids !== null) {
    const customerIds = new Set(scope.ids);
    const scopedIds = async (table: string) => {
      if (!scope.ids?.length || !await tableExists(table)) return new Set<number>();
      const rows = await pool.query("SELECT id FROM " + table + " WHERE website_id=$1 AND customer_id=ANY($2::int[])", [websiteId,scope.ids]);
      return new Set<number>(rows.rows.map((row: any) => Number(row.id)));
    };
    const [accounts,deposits,withdrawals,transfers,cards,kyc,loans] = await Promise.all([
      scopedIds("accounts"),scopedIds("deposits"),scopedIds("withdrawals"),
      scopedIds("transfers"),scopedIds("bank_cards"),scopedIds("kyc_submissions"),scopedIds("loans"),
    ]);
    const accountIds = [...accounts];
    const transactions = new Set<number>();
    if (accountIds.length && await tableExists("transactions")) {
      const rows = await pool.query("SELECT id FROM transactions WHERE website_id=$1 AND account_id=ANY($2::int[])", [websiteId,accountIds]);
      for (const row of rows.rows) transactions.add(Number(row.id));
    }
    const resourceIds: Record<string, Set<number>> = {
      customer: customerIds, account: accounts, deposit: deposits, withdrawal: withdrawals,
      transfer: transfers, bank_card: cards, kyc_submission: kyc, loan: loans, transaction: transactions,
    };
    visibleLogs = visibleLogs.filter((log: any) =>
      log.resource_id !== null && Boolean(resourceIds[log.resource_type ?? ""]?.has(Number(log.resource_id))),
    );
  }
  visibleLogs = visibleLogs.slice(0,500);
  const adminIds = [...new Set(visibleLogs.filter((log: any) => log.user_type === "website_admin" && log.user_id !== null).map((log: any) => Number(log.user_id)))];
  const customerActorIds = [...new Set(visibleLogs.filter((log: any) => log.user_type === "customer" && log.user_id !== null).map((log: any) => Number(log.user_id)))];
  const [adminActors,customerActors] = await Promise.all([
    adminIds.length && await tableExists("admins")
      ? pool.query("SELECT id,username FROM admins WHERE id=ANY($1::int[])",[adminIds])
      : { rows: [] },
    customerActorIds.length && await tableExists("customers")
      ? pool.query("SELECT id,first_name,last_name FROM customers WHERE website_id=$1 AND id=ANY($2::int[])" + (scope.ids === null ? "" : " AND id=ANY($3::int[])"),
          scope.ids === null ? [websiteId,customerActorIds] : [websiteId,customerActorIds,scope.ids])
      : { rows: [] },
  ]);
  const actorNames = new Map<string,string>([
    ...adminActors.rows.map((actor: any) => ["website_admin:"+actor.id,actor.username] as [string,string]),
    ...customerActors.rows.map((actor: any) => ["customer:"+actor.id,[actor.first_name,actor.last_name].filter(Boolean).join(" ")] as [string,string]),
  ]);
  res.json(visibleLogs.map((log: any) => ({
    id:Number(log.id),
    actor:log.user_id === null ? log.user_type : actorNames.get(log.user_type+":"+log.user_id) ?? log.user_type,
    action:log.action,resourceType:log.resource_type,resourceId:log.resource_id,
    status:typeof log.details?.status === "string" ? log.details.status : null,
    createdAt:log.created_at?.toISOString?.() ?? log.created_at,
  })));
});

router.get("/admin/analytics", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error: "Invalid banking region" }); return; }
  const ids = scope.ids;
  const filter = ids === null ? "website_id=$1" : "website_id=$1 AND customer_id=ANY($2::int[])";
  const values = ids === null ? [websiteId] : [websiteId, ids];
  const aggregate = async (table: string) => {
    if (!await tableExists(table)) return { count: 0, total: "0" };
    const result = await pool.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(amount),0)::text AS total FROM " + table + " WHERE " + filter, values);
    return { count: Number(result.rows[0]?.count ?? 0), total: result.rows[0]?.total ?? "0" };
  };
  const [customers,activeCustomers,deposits,pendingDeposits,withdrawals,pendingWithdrawals,transfers,pendingTransfers,totalLoans,activeLoans] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM customers WHERE " + (ids === null ? "website_id=$1" : "website_id=$1 AND id=ANY($2::int[])"), values),
    pool.query("SELECT COUNT(*)::int AS count FROM customers WHERE " + (ids === null ? "website_id=$1" : "website_id=$1 AND id=ANY($2::int[])") + " AND status='active'", values),
    aggregate("deposits"), countScopedRecords("deposits", ids, "pending"),
    aggregate("withdrawals"), countScopedRecords("withdrawals", ids, "pending"),
    aggregate("transfers"), countScopedRecords("transfers", ids, "pending"),
    countScopedRecords("loans", ids), countScopedRecords("loans", ids, "active"),
  ]);
  const accounts = await pool.query("SELECT COALESCE(SUM(balance),0)::text AS total FROM accounts WHERE " + (ids === null ? "website_id=$1" : "website_id=$1 AND customer_id=ANY($2::int[])"), values);
  const recentTransactionFilter = ids === null ? "" : ids.length ? " AND a.customer_id=ANY($2::int[])" : " AND false";
  const recentTransactions = await pool.query(
    "SELECT t.id,t.transaction_type,t.amount,t.currency,t.description,t.status,t.created_at FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.website_id=t.website_id WHERE t.website_id=$1 AND t.created_at>=NOW()-INTERVAL '30 days'" + recentTransactionFilter + " ORDER BY t.created_at DESC LIMIT 20",
    values,
  );
  const recentCustomerFilter = ids === null ? "" : ids.length ? " AND id=ANY($2::int[])" : " AND false";
  const recentCustomers = await pool.query(
    "SELECT id,first_name,last_name,email,status,created_at FROM customers WHERE website_id=$1" + recentCustomerFilter + " ORDER BY created_at DESC LIMIT 10",
    values,
  );
  res.json({
    overview: {
      totalCustomers: Number(customers.rows[0]?.count ?? 0), activeCustomers: Number(activeCustomers.rows[0]?.count ?? 0),
      totalDeposits: deposits.count, totalDepositAmount: deposits.total, pendingDeposits,
      totalWithdrawals: withdrawals.count, totalWithdrawalAmount: withdrawals.total, pendingWithdrawals,
      totalTransfers: transfers.count, totalTransferAmount: transfers.total, pendingTransfers,
      totalLoans, activeLoans, totalAccountBalance: accounts.rows[0]?.total ?? "0",
    },
    recentTransactions: recentTransactions.rows.map((row: any) => ({
      id: Number(row.id), transactionType: row.transaction_type, amount: row.amount,
      currency: row.currency, description: row.description ?? null, status: row.status,
      createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    })),
    recentCustomers: recentCustomers.rows.map((row: any) => ({
      id: Number(row.id), name: row.first_name + " " + row.last_name, email: row.email,
      status: row.status, createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    })),
  });
});

const readSetting = async (key: string) => {
  if (!await tableExists("website_settings")) return null;
  const result = await pool.query("SELECT setting_value FROM website_settings WHERE website_id=$1 AND setting_key=$2 LIMIT 1", [websiteId, key]);
  return result.rows[0]?.setting_value ?? null;
};
const writeSetting = async (key: string, value: unknown) => {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  const existing = await pool.query("SELECT id FROM website_settings WHERE website_id=$1 AND setting_key=$2 LIMIT 1", [websiteId, key]);
  if (existing.rows[0]) {
    await pool.query("UPDATE website_settings SET setting_value=$1,updated_at=NOW() WHERE id=$2 AND website_id=$3", [serialized, existing.rows[0].id, websiteId]);
  } else {
    await pool.query("INSERT INTO website_settings (website_id,setting_key,setting_value,created_at,updated_at) VALUES ($1,$2,$3,NOW(),NOW())", [websiteId, key, serialized]);
  }
};
router.get("/public/support-widget", async (_req, res) => {
  if (!requireBanking(res)) return;
  let settings: any = {};
  try { settings = JSON.parse((await readSetting("banking_settings")) ?? "{}"); }
  catch (error) { console.error("[support widget] invalid saved setting", error); }
  res.setHeader("Cache-Control", "no-store");
  res.json({
    enabled: settings.supportWidgetEnabled === true,
    smartsuppKey: settings.supportWidgetEnabled === true ? String(settings.smartsuppKey ?? "") : "",
  });
});

router.get("/admin/live-chat-widget", requireAdmin, async (_req: any, res) => {
  if (!requireBanking(res)) return;
  let settings: any = {};
  try { settings = JSON.parse((await readSetting("banking_settings")) ?? "{}"); }
  catch (error) { console.error("[support widget] invalid saved setting", error); }
  const key = String(settings.smartsuppKey ?? "");
  const liveChatCode = String(settings.liveChatCode ?? (key
    ? `<script type="text/javascript">var _smartsupp = _smartsupp || {}; _smartsupp.key = '${key}';</script>`
    : ""));
  const enabled = settings.supportWidgetEnabled === true;
  res.json({
    liveChatCode,
    liveChatEnabled: enabled,
    liveChatStatus: enabled ? (settings.liveChatStatus ?? "pending") : "disabled",
  });
});

router.patch("/admin/live-chat-widget", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "Invalid live chat settings" });
    return;
  }
  let current: any = {};
  try { current = JSON.parse((await readSetting("banking_settings")) ?? "{}"); }
  catch (error) { console.error("[support widget] invalid saved setting", error); }
  const patch = req.body;
  if (patch.liveChatEnabled !== undefined && typeof patch.liveChatEnabled !== "boolean") {
    res.status(400).json({ error: "Invalid live chat enabled setting" });
    return;
  }
  if (patch.liveChatCode !== undefined && (typeof patch.liveChatCode !== "string" || patch.liveChatCode.length > 20000)) {
    res.status(400).json({ error: "Live chat embed code is invalid or too long" });
    return;
  }
  const code = patch.liveChatCode === undefined ? String(current.liveChatCode ?? "") : patch.liveChatCode.trim();
  let key = String(current.smartsuppKey ?? "");
  if (patch.liveChatCode !== undefined) {
    const match = code.match(/_smartsupp\.key\s*=\s*['"]([^'"]+)['"]/i);
    if (code && !match) {
      res.status(422).json({ code: "INVALID_SCRIPT", error: "Only a valid Smartsupp embed code can be connected to this banking customer widget." });
      return;
    }
    key = match?.[1]?.trim() ?? "";
  }
  const removing = patch.liveChatCode !== undefined && !code;
  const enabled = removing ? false : (patch.liveChatEnabled ?? current.supportWidgetEnabled ?? false);
  if (enabled && !key) {
    res.status(400).json({ error: "Enter your Smartsupp API key before enabling the live chat widget" });
    return;
  }
  const next = {
    ...current,
    liveChatCode: code,
    supportWidgetEnabled: Boolean(enabled && key),
    smartsuppKey: key,
    liveChatStatus: enabled && key ? "pending" : "disabled",
  };
  await writeSetting("banking_settings", next);
  res.json({
    liveChatCode: next.liveChatCode,
    liveChatEnabled: next.supportWidgetEnabled,
    liveChatStatus: next.liveChatStatus,
  });
});

router.post("/public/support-widget/status", async (req, res) => {
  if (!requireBanking(res)) return;
  const status = req.body?.status;
  if (status !== "active" && status !== "failed") {
    res.status(400).json({ error: "Invalid support widget status" });
    return;
  }
  let settings: any = {};
  try { settings = JSON.parse((await readSetting("banking_settings")) ?? "{}"); }
  catch (error) { console.error("[support widget] invalid saved setting", error); }
  if (settings.supportWidgetEnabled !== true || !String(settings.smartsuppKey ?? "").trim()) {
    res.status(409).json({ error: "Support widget is not enabled" });
    return;
  }
  settings.liveChatStatus = status;
  await writeSetting("banking_settings", settings);
  res.json({ success: true, status });
});


router.get("/admin/settings", requireAdmin, async (_req, res) => {
  if (!requireBanking(res)) return;
  let settings: any = {};
  try { settings = JSON.parse((await readSetting("banking_settings")) ?? "{}"); } catch (error) { console.error("[banking settings] invalid saved setting", error); }
  res.json({
    kycMode: settings.kycMode ?? "optional",
    transferFeePercent: Number(settings.transferFeePercent ?? 0.05),
    supportWidgetEnabled: settings.supportWidgetEnabled === true,
    smartsuppKey: String(settings.smartsuppKey ?? ""),
    transfersEnabled: { internal: true, national: true, international: true, crypto: true, ...(settings.transfersEnabled ?? {}) },
    bankInstructions: settings.bankInstructions ?? null,
    cryptoInstructions: settings.cryptoInstructions ?? null,
    depositMethods: Array.isArray(settings.depositMethods) ? settings.depositMethods : [
      { id: "bank_transfer", label: "Bank Transfer", enabled: true, instructions: null },
      { id: "crypto", label: "Cryptocurrency", enabled: true, instructions: null },
      { id: "cash_app", label: "Cash App", enabled: false, instructions: null },
      { id: "paypal", label: "PayPal", enabled: false, instructions: null },
      { id: "other", label: "Other", enabled: false, instructions: null },
    ],
  });
});
router.patch("/admin/settings", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  let current: any = {};
  try { current = JSON.parse((await readSetting("banking_settings")) ?? "{}"); }
  catch (error) { console.error("[banking settings] invalid saved setting", error); }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) { res.status(400).json({ error:"Invalid banking settings" }); return; }
  const patch = req.body;
  if (patch.kycMode !== undefined && !["required","optional","disabled"].includes(patch.kycMode)) {
    res.status(400).json({ error:"Invalid KYC mode" }); return;
  }
  if (patch.transfersEnabled !== undefined && (!patch.transfersEnabled || typeof patch.transfersEnabled !== "object"
      || Array.isArray(patch.transfersEnabled) || Object.entries(patch.transfersEnabled).some(([key,value]) =>
        !["internal","national","international","crypto"].includes(key) || typeof value !== "boolean"))) {
    res.status(400).json({ error:"Invalid transfer settings" }); return;
  }
  if (["bankInstructions","cryptoInstructions"].some((key) => patch[key] !== undefined && typeof patch[key] !== "string")) {
    res.status(400).json({ error:"Banking instructions must be text" }); return;
  }
  if (patch.depositMethods !== undefined && (!Array.isArray(patch.depositMethods) || patch.depositMethods.some((method: any) =>
    !method || typeof method.id !== "string" || !method.id.trim() || typeof method.label !== "string" || !method.label.trim()
    || typeof method.enabled !== "boolean" || (method.instructions !== undefined && method.instructions !== null && typeof method.instructions !== "string")))) {
    res.status(400).json({ error:"Invalid deposit methods" }); return;
  }
  if (patch.supportWidgetEnabled !== undefined && typeof patch.supportWidgetEnabled !== "boolean") {
    res.status(400).json({ error:"Invalid customer support widget setting" }); return;
  }
  if (patch.smartsuppKey !== undefined && (typeof patch.smartsuppKey !== "string" || patch.smartsuppKey.trim().length > 128)) {
    res.status(400).json({ error:"Smartsupp key must be text no longer than 128 characters" }); return;
  }
  if (patch.supportWidgetEnabled === true && !(String(patch.smartsuppKey ?? current.smartsuppKey ?? "").trim())) {
    res.status(400).json({ error:"Enter your Smartsupp key before enabling the customer chat widget" }); return;
  }
  const fee = patch.transferFeePercent === undefined ? current.transferFeePercent ?? 0.05 : Number(patch.transferFeePercent);
  if (!Number.isFinite(fee) || fee < 0 || fee > 100) { res.status(400).json({ error: "Transfer fee must be between 0 and 100 percent" }); return; }
  const next = {
    kycMode: patch.kycMode ?? current.kycMode ?? "optional",
    transferFeePercent: fee,
    supportWidgetEnabled: patch.supportWidgetEnabled ?? current.supportWidgetEnabled ?? false,
    smartsuppKey: patch.smartsuppKey === undefined ? current.smartsuppKey ?? "" : patch.smartsuppKey.trim(),
    transfersEnabled: { internal: true, national: true, international: true, crypto: true, ...(current.transfersEnabled ?? {}), ...(patch.transfersEnabled ?? {}) },
    bankInstructions: patch.bankInstructions ?? current.bankInstructions ?? null,
    cryptoInstructions: patch.cryptoInstructions ?? current.cryptoInstructions ?? null,
    depositMethods: patch.depositMethods?.map((method: any) => ({
      id:method.id.trim(),label:method.label.trim(),enabled:method.enabled,instructions:method.instructions ?? null,
    })) ?? current.depositMethods ?? [
      { id:"bank_transfer",label:"Bank Transfer",enabled:true,instructions:null },
      { id:"crypto",label:"Cryptocurrency",enabled:true,instructions:null },
      { id:"cash_app",label:"Cash App",enabled:false,instructions:null },
      { id:"paypal",label:"PayPal",enabled:false,instructions:null },
      { id:"other",label:"Other",enabled:false,instructions:null },
    ],
  };
  await writeSetting("banking_settings", next);
  if (await tableExists("audit_logs")) {
    await pool.query(
      "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,details,created_at) VALUES ($1,$2,'website_admin','banking_settings_update','website_settings',$3::jsonb,NOW())",
      [websiteId,Number(req.admin?.userId)||null,JSON.stringify(patch)],
    );
  }
  res.json(next);
});

router.get("/admin/customer-localization", requireAdmin, async (_req, res) => {
  if (!requireBanking(res)) return;
  let value: any = {};
  try { value = JSON.parse((await readSetting("customer_localization")) ?? "{}"); } catch (error) { console.error("[banking localization] invalid saved setting", error); }
  res.json({ enabled: false, defaultLocale: "en", supportedLocales: ["en"], countryAutoDetect: false, allowCustomerOverride: false, ...value });
});
router.patch("/admin/customer-localization", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const supportedLocales = Array.isArray(body.supportedLocales) ? body.supportedLocales.filter((locale: unknown) => typeof locale === "string") : ["en"];
  if (!supportedLocales.length || (body.defaultLocale && !supportedLocales.includes(body.defaultLocale))) {
    res.status(400).json({ error: "Select at least one supported language and a matching default language" }); return;
  }
  const value = {
    enabled: body.enabled === true,
    defaultLocale: String(body.defaultLocale ?? "en"),
    supportedLocales,
    countryAutoDetect: body.countryAutoDetect === true,
    allowCustomerOverride: body.allowCustomerOverride === true,
  };
  await writeSetting("customer_localization", value);
  if (await tableExists("audit_logs")) {
    await pool.query(
      "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,details,created_at) VALUES ($1,$2,'website_admin','customer_localization_update','website_settings',$3::jsonb,NOW())",
      [websiteId,Number(req.admin?.userId)||null,JSON.stringify(value)],
    );
  }
  res.json(value);
});

router.get("/admin/deposit-bank-accounts", requireAdmin, async (_req, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("deposit_bank_accounts")) { res.json([]); return; }
  const result = await pool.query("SELECT * FROM deposit_bank_accounts WHERE website_id=$1 ORDER BY sort_order,id", [websiteId]);
  res.json(result.rows);
});
router.post("/admin/deposit-bank-accounts", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const body = req.body ?? {};
  const required = ["displayName", "bankName", "accountName", "accountNumber", "currency"];
  if (required.some((key) => typeof body[key] !== "string" || !body[key].trim())) { res.status(400).json({ error: "Bank name, account name, account number, currency, and display name are required" }); return; }
  const result = await pool.query(
    "INSERT INTO deposit_bank_accounts (website_id,display_name,bank_name,account_name,account_number,currency,country,region,routing_number,iban,swift_bic,bank_address,instructions,enabled,sort_order,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()) RETURNING *",
    [websiteId, body.displayName.trim(), body.bankName.trim(), body.accountName.trim(), body.accountNumber.trim(), body.currency.trim().toUpperCase(),
      body.country ?? null, body.region ?? null, body.routingNumber ?? null, body.iban ?? null, body.swiftBic ?? null, body.bankAddress ?? null,
      body.instructions ?? null, body.enabled === true, Number(body.sortOrder ?? 0)],
  );
  res.status(201).json(result.rows[0]);
});
router.patch("/admin/deposit-bank-accounts/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const body = req.body ?? {};
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(400).json({ error: "Invalid receiving bank account id" }); return; }
  const updated = await pool.query(
    "UPDATE deposit_bank_accounts SET display_name=COALESCE($1,display_name),bank_name=COALESCE($2,bank_name),account_name=COALESCE($3,account_name),account_number=COALESCE($4,account_number),currency=COALESCE($5,currency),country=$6,region=$7,routing_number=$8,iban=$9,swift_bic=$10,bank_address=$11,instructions=$12,enabled=COALESCE($13,enabled),sort_order=COALESCE($14,sort_order),updated_at=NOW() WHERE id=$15 AND website_id=$16 RETURNING *",
    [body.displayName ?? null, body.bankName ?? null, body.accountName ?? null, body.accountNumber ?? null, body.currency ?? null,
      body.country ?? null, body.region ?? null, body.routingNumber ?? null, body.iban ?? null, body.swiftBic ?? null,
      body.bankAddress ?? null, body.instructions ?? null, typeof body.enabled === "boolean" ? body.enabled : null,
      Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : null, id, websiteId],
  );
  if (!updated.rows[0]) { res.status(404).json({ error: "Receiving bank account not found" }); return; }
  res.json(updated.rows[0]);
});

router.get("/admin/accounts", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error: "Invalid banking region" }); return; }
  const filter = scope.ids === null ? "" : " AND a.customer_id=ANY($2::int[])";
  const values = scope.ids === null ? [websiteId] : [websiteId, scope.ids];
  const result = await pool.query("SELECT a.*,c.first_name,c.last_name,c.email,c.banking_region FROM accounts a JOIN customers c ON c.id=a.customer_id AND c.website_id=a.website_id WHERE a.website_id=$1" + filter + " ORDER BY a.created_at DESC LIMIT 1000", values);
  res.json(result.rows.map((row: any) => ({ ...row, accountNumber: row.account_number, accountType: row.account_type, customerName: row.first_name + " " + row.last_name, bankingRegion: row.banking_region })));
});
router.get("/admin/accounts/:id/transactions", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const id = Number(req.params.id);
  const scope = await adminRegionCustomerIds(req);
  if (!Number.isSafeInteger(id) || id < 1 || scope.invalid) { res.status(400).json({ error: "Invalid account id or region" }); return; }
  const account = await pool.query("SELECT customer_id FROM accounts WHERE id=$1 AND website_id=$2 LIMIT 1", [id, websiteId]);
  if (!account.rows[0] || (scope.ids !== null && !scope.ids.includes(Number(account.rows[0].customer_id)))) { res.status(404).json({ error: "Account not found" }); return; }
  const result = await pool.query("SELECT * FROM transactions WHERE account_id=$1 AND website_id=$2 ORDER BY created_at DESC LIMIT 500", [id, websiteId]);
  res.json(result.rows);
});
router.patch("/admin/accounts/:id/status", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const status = String(req.body?.status ?? "");
  if (!["active", "frozen"].includes(status)) { res.status(400).json({ error: "Invalid account status" }); return; }
  const result = await pool.query("UPDATE accounts SET status=$1,updated_at=NOW() WHERE id=$2 AND website_id=$3 RETURNING *", [status, Number(req.params.id), websiteId]);
  if (!result.rows[0]) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(result.rows[0]);
});
router.patch("/admin/accounts/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const { status, accountType, currency } = req.body ?? {};
  if (status !== undefined && !["active", "frozen"].includes(String(status))) { res.status(400).json({ error: "Invalid account status" }); return; }
  if (accountType !== undefined && !["checking", "savings", "money_market", "fixed_deposit"].includes(String(accountType))) { res.status(400).json({ error: "Invalid account type" }); return; }
  if (currency !== undefined && (typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency))) { res.status(400).json({ error: "Currency must be a three-letter code" }); return; }
  const result = await pool.query(
    "UPDATE accounts SET status=COALESCE($1,status),account_type=COALESCE($2,account_type),currency=COALESCE($3,currency),updated_at=NOW() WHERE id=$4 AND website_id=$5 RETURNING *",
    [status ?? null, accountType ?? null, typeof currency === "string" ? currency.toUpperCase() : null, Number(req.params.id), websiteId],
  );
  if (!result.rows[0]) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(result.rows[0]);
});
for (const [action, direction, transactionType] of [
  ["fund", "incoming", "credit"],
  ["debit", "outgoing", "debit"],
] as const) {
  router.post("/admin/accounts/:id/" + action, requireAdmin, async (req: any, res) => {
    if (!requireBanking(res)) return;
    const accountId = Number(req.params.id);
    const amount = Number(req.body?.amount);
    if (!Number.isSafeInteger(accountId) || accountId < 1 || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      res.status(400).json({ error: "A valid account and positive amount are required" }); return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query("SELECT * FROM accounts WHERE id=$1 AND website_id=$2 FOR UPDATE", [accountId, websiteId]);
      const account = locked.rows[0];
      if (!account) { await client.query("ROLLBACK"); res.status(404).json({ error: "Account not found" }); return; }
      if (account.status !== "active") { await client.query("ROLLBACK"); res.status(409).json({ error: "Only active accounts can be adjusted" }); return; }
      if (action === "debit" && Number(account.balance) < amount) { await client.query("ROLLBACK"); res.status(400).json({ error: "Insufficient balance" }); return; }
      const delta = action === "fund" ? amount : -amount;
      const referenceValue = reference("ADM");
      const updated = await client.query(
        "UPDATE accounts SET balance=balance+$1::numeric,ledger_balance=COALESCE(ledger_balance,balance)+$1::numeric,updated_at=NOW() WHERE id=$2 AND website_id=$3 RETURNING balance-$1::numeric AS balance_before,balance AS balance_after",
        [delta, accountId, websiteId],
      );
      const overrideTimestamp = typeof req.body?.overrideTimestamp === "string" ? req.body.overrideTimestamp : "";
      const overrideDate = typeof req.body?.overrideDate === "string" ? req.body.overrideDate : "";
      const overrideTime = typeof req.body?.overrideTime === "string" ? req.body.overrideTime : "";
      if (overrideTimestamp && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(overrideTimestamp)) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Invalid timezone-aware transaction timestamp" });
        return;
      }
      if (!overrideTimestamp && ((overrideDate && !/^\d{4}-\d{2}-\d{2}$/.test(overrideDate)) ||
          (overrideTime && !/^\d{2}:\d{2}$/.test(overrideTime)))) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Invalid transaction date or time" });
        return;
      }
      const selectedTimestamp = overrideTimestamp
        ? new Date(overrideTimestamp)
        : overrideDate || overrideTime
          ? new Date((overrideDate || new Date().toISOString().slice(0, 10)) + "T" + (overrideTime || "00:00") + ":00")
          : null;
      if (selectedTimestamp && !Number.isFinite(selectedTimestamp.getTime())) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Invalid transaction date or time" });
        return;
      }
      if (selectedTimestamp && Number.isNaN(selectedTimestamp.getTime())) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Invalid transaction date or time" });
        return;
      }
      await client.query(
        "INSERT INTO transactions (website_id,account_id,transaction_type,amount,gross_amount,fee,net_amount,direction,balance_before,balance_after,currency,description,reference,status,created_at,completed_at,updated_at) VALUES ($1,$2,$3,$4,$4,0,$4,$5,$6,$7,$8,$9,$10,'completed',COALESCE($11::timestamptz,NOW()),COALESCE($11::timestamptz,NOW()),NOW())",
        [websiteId, accountId, transactionType, amount, direction, updated.rows[0].balance_before, updated.rows[0].balance_after,
          account.currency, typeof req.body?.description === "string" ? req.body.description.trim() || "Admin account " + action : "Admin account " + action,
          referenceValue, selectedTimestamp],
      );
      await client.query("COMMIT");
      res.json({ accountId, balanceBefore: updated.rows[0].balance_before, balanceAfter: updated.rows[0].balance_after, reference: referenceValue });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  });
}
router.patch("/admin/accounts/:id/balance", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const current = Number(req.body?.currentBalance);
  const ledger = req.body?.ledgerBalance == null ? current : Number(req.body.ledgerBalance);
  if (!Number.isFinite(current) || current < 0 || !Number.isFinite(ledger) || ledger < 0) { res.status(400).json({ error: "Balances must be non-negative numbers" }); return; }
  const result = await pool.query("UPDATE accounts SET balance=$1,ledger_balance=$2,updated_at=NOW() WHERE id=$3 AND website_id=$4 RETURNING *", [current, ledger, Number(req.params.id), websiteId]);
  if (!result.rows[0]) { res.status(404).json({ error: "Account not found" }); return; }
  res.json(result.rows[0]);
});

router.get("/admin/cards", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("bank_cards")) { res.json([]); return; }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error: "Invalid banking region" }); return; }
  const filter = scope.ids === null ? "" : " AND c.customer_id=ANY($2::int[])";
  const values: unknown[] = scope.ids === null ? [websiteId] : [websiteId, scope.ids];
  const status = textValue(req.query?.status);
  if (status && !["pending","approved","declined"].includes(status)) { res.status(400).json({ error:"Invalid card status" }); return; }
  const statusFilter = status ? " AND c.status=$" + (values.length + 1) : "";
  if (status) values.push(status);
  const result = await pool.query("SELECT c.*,u.first_name || ' ' || u.last_name AS customer_name,u.banking_region FROM bank_cards c JOIN customers u ON u.id=c.customer_id AND u.website_id=c.website_id WHERE c.website_id=$1" + filter + statusFilter + " ORDER BY c.created_at DESC LIMIT 500", values);
  res.json(result.rows);
});
router.patch("/admin/cards/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const status = String(req.body?.status ?? "");
  const declineReason = typeof req.body?.declineReason === "string" ? req.body.declineReason.trim() : "";
  if (!["approved", "declined"].includes(status) || (status === "declined" && !declineReason)) {
    res.status(400).json({ error: "Choose an approval decision and provide a decline reason when declining" }); return;
  }
  const id = Number(req.params.id);
  const scope = await adminRegionCustomerIds(req);
  if (!Number.isSafeInteger(id) || id < 1 || scope.invalid) { res.status(400).json({ error:"Invalid card id or banking region" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT b.*,c.first_name,c.last_name,c.banking_region FROM bank_cards b JOIN customers c ON c.id=b.customer_id AND c.website_id=b.website_id WHERE b.id=$1 AND b.website_id=$2 AND ($3::text='ALL' OR c.banking_region=$3) FOR UPDATE OF b",
      [id,websiteId,String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase()],
    );
    const card = selected.rows[0];
    if (!card || (scope.ids && !scope.ids.includes(Number(card.customer_id)))) {
      await client.query("ROLLBACK"); res.status(404).json({ error:"Pending card request not found" }); return;
    }
    if (card.status !== "pending") {
      await client.query("ROLLBACK"); res.status(409).json({ error:"This card request has already been reviewed" }); return;
    }
    const updated = await client.query(
      "UPDATE bank_cards SET status=$1,decline_reason=$2,reviewed_by=$3,reviewed_at=NOW() WHERE id=$4 AND website_id=$5 AND status='pending' RETURNING *",
      [status,status === "declined" ? declineReason : null,Number(req.admin?.userId) || null,id,websiteId],
    );
    if (!updated.rows[0]) { await client.query("ROLLBACK"); res.status(409).json({ error:"This card request has already been reviewed" }); return; }
    await client.query(
      "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) VALUES ($1,$2,'customer',$3,$4,$5,NOW())",
      [websiteId,card.customer_id,status === "approved" ? "Card approved" : "Card declined",
        status === "approved" ? "Your card ending in " + card.last_four_digits + " was approved and linked."
          : "Your card ending in " + card.last_four_digits + " was declined. Reason: " + declineReason,
        status === "approved" ? "success" : "error"],
    );
    await client.query(
      "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,resource_id,details,created_at) VALUES ($1,$2,'website_admin','card_review','bank_card',$3,$4::jsonb,NOW())",
      [websiteId,Number(req.admin?.userId) || null,id,JSON.stringify({ status,declineReason:status === "declined" ? declineReason : null })],
    );
    await client.query("COMMIT");
    res.json({ ...camelizeRow(updated.rows[0]),customerName:card.first_name+" "+card.last_name,bankingRegion:card.banking_region });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
});
router.delete("/admin/cards/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const id = Number(req.params.id);
  const scope = await adminRegionCustomerIds(req);
  if (!Number.isSafeInteger(id) || id < 1 || scope.invalid) { res.status(400).json({ error:"Invalid card id or banking region" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT b.*,c.banking_region FROM bank_cards b JOIN customers c ON c.id=b.customer_id AND c.website_id=b.website_id WHERE b.id=$1 AND b.website_id=$2 FOR UPDATE OF b",
      [id,websiteId],
    );
    const card = selected.rows[0];
    if (!card || (scope.ids && !scope.ids.includes(Number(card.customer_id)))) {
      await client.query("ROLLBACK"); res.status(404).json({ error:"Card not found" }); return;
    }
    await client.query("DELETE FROM bank_cards WHERE id=$1 AND website_id=$2", [id,websiteId]);
    await client.query(
      "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) VALUES ($1,$2,'customer','Card removed',$3,'info',NOW())",
      [websiteId,card.customer_id,"Your card ending in " + card.last_four_digits + " was removed by the website admin."],
    );
    await client.query(
      "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,resource_id,details,created_at) VALUES ($1,$2,'website_admin','card_delete','bank_card',$3,$4::jsonb,NOW())",
      [websiteId,Number(req.admin?.userId) || null,id,JSON.stringify({ customerId:card.customer_id,cardBrand:card.card_brand,lastFourDigits:card.last_four_digits,previousStatus:card.status })],
    );
    await client.query("COMMIT");
    res.json({ success:true,id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
});

router.get("/admin/receipts", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("receipts")) { res.json([]); return; }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const filter = scope.ids === null ? "" : " AND r.customer_id=ANY($2::int[])";
  const values: unknown[] = scope.ids === null ? [websiteId] : [websiteId,scope.ids];
  const status = textValue(req.query?.status);
  if (status && !["pending","approved","completed","rejected","cancelled","failed","reversed"].includes(status)) {
    res.status(400).json({ error:"Invalid receipt status" }); return;
  }
  const statusFilter = status ? " AND r.status=$" + (values.length + 1) : "";
  if (status) values.push(status);
  const verificationJoin = await tableExists("receipt_verifications")
    ? " LEFT JOIN receipt_verifications v ON v.website_id=r.website_id AND v.customer_id=r.customer_id AND v.source_type='financial' AND v.source_id=r.id"
    : "";
  const verificationSelect = verificationJoin ? ",v.verification_token" : "";
  const result = await pool.query(
    "SELECT r.*,c.first_name,c.last_name" + verificationSelect + " FROM receipts r LEFT JOIN customers c ON c.id=r.customer_id AND c.website_id=r.website_id" + verificationJoin + " WHERE r.website_id=$1 AND r.deleted_at IS NULL" + filter + statusFilter + " ORDER BY r.issued_at DESC LIMIT 1000",
    values,
  );
  const trackingNumbers = new Map<string,string>();
  for (const [kind,table] of [["withdrawal","withdrawals"],["transfer","transfers"]] as const) {
    if (!await tableExists(table)) continue;
    const sourceIds = [...new Set(result.rows.filter((row: any) => row.transaction_kind === kind).map((row: any) => Number(row.source_id)))];
    if (!sourceIds.length) continue;
    const tracked = await pool.query("SELECT id,global_payment_tracking_number FROM " + table + " WHERE website_id=$1 AND id=ANY($2::int[])",[websiteId,sourceIds]);
    for (const row of tracked.rows) {
      if (row.global_payment_tracking_number) trackingNumbers.set(kind+":"+row.id,row.global_payment_tracking_number);
    }
  }
  const verificationTokens = new Map<number,string>();
  if (verificationJoin && result.rows.length) {
    await Promise.all(result.rows.map((row: any) => ensureReceiptVerification(pool,row)));
    const verifications = await pool.query(
      "SELECT source_id,verification_token FROM receipt_verifications WHERE website_id=$1 AND customer_id=ANY($2::int[]) AND source_type='financial' AND source_id=ANY($3::int[])",
      [websiteId,[...new Set(result.rows.map((row: any) => Number(row.customer_id)))],[...new Set(result.rows.map((row: any) => Number(row.id)))]],
    );
    for (const verification of verifications.rows) verificationTokens.set(Number(verification.source_id),verification.verification_token);
  }
  const baseUrl = String(process.env.PUBLIC_BASE_URL ?? "").replace(/\/+$/,"");
  res.json(result.rows.map((row: any) => ({
    ...camelizeRow(row),
    customerName: [row.first_name,row.last_name].filter(Boolean).join(" ") || "Unknown",
    paymentTrackingNumber: trackingNumbers.get(row.transaction_kind+":"+row.source_id) ?? row.reference ?? null,
    verificationPath: (row.verification_token ?? verificationTokens.get(Number(row.id))) ? "/receipt/verify/" + encodeURIComponent(row.verification_token ?? verificationTokens.get(Number(row.id))) : null,
    verificationUrl: (row.verification_token ?? verificationTokens.get(Number(row.id))) && baseUrl ? baseUrl + "/receipt/verify/" + encodeURIComponent(row.verification_token ?? verificationTokens.get(Number(row.id))) : null,
    issuedAt: row.issued_at?.toISOString?.() ?? row.issued_at,
  })));
});
router.delete("/admin/receipts/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) { res.status(400).json({ error:"Invalid receipt id" }); return; }
  if (!await tableExists("receipts")) { res.status(404).json({ error:"Receipt not found" }); return; }
  const scope = await adminRegionCustomerIds(req);
  if (scope.invalid) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const customerFilter = scope.ids === null ? "" : " AND customer_id=ANY($3::int[])";
  const values = scope.ids === null ? [id,websiteId] : [id,websiteId,scope.ids];
  const result = await pool.query(
    "UPDATE receipts SET deleted_at=NOW() WHERE id=$1 AND website_id=$2 AND deleted_at IS NULL" + customerFilter + " RETURNING id",
    values,
  );
  if (!result.rowCount) { res.status(404).json({ error:"Receipt not found" }); return; }
  res.status(204).send();
});

router.get("/admin/actions", requireAdmin, async (_req, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("banking_customer_actions")) { res.json([]); return; }
  const result = await pool.query(
    "SELECT a.*,c.first_name || ' ' || c.last_name AS customer_name,c.banking_region,CASE WHEN ac.account_number IS NULL THEN NULL ELSE '•••• ' || right(ac.account_number,4) END AS account_label FROM banking_customer_actions a JOIN customers c ON c.id=a.customer_id AND c.website_id=a.website_id JOIN accounts ac ON ac.id=a.account_id AND ac.website_id=a.website_id WHERE a.website_id=$1 ORDER BY a.created_at DESC LIMIT 500",
    [websiteId],
  );
  res.json(result.rows.map((row: any) => shapeAction(row)));
});
router.patch("/admin/actions/:id", requireAdmin, async (req: any, res) => {
  if (!requireBanking(res)) return;
  if (!await tableExists("banking_customer_actions") || !await tableExists("customer_credit_scores")) {
    res.status(503).json({ error: "Online Banking review is not configured" }); return;
  }
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const adminNotes = typeof req.body?.adminNotes === "string" ? req.body.adminNotes.trim() || null : null;
  if (!Number.isSafeInteger(id) || id < 1 || !["approved", "rejected", "refunded"].includes(status)) {
    res.status(400).json({ error: "Invalid review request" }); return;
  }
  if ((status === "rejected" || status === "refunded") && !adminNotes) {
    res.status(400).json({ error: status === "rejected" ? "A rejection reason is required" : "A refund reason is required" }); return;
  }
  if (adminNotes && adminNotes.length > 1000) { res.status(400).json({ error: "Review reason must be 1,000 characters or fewer" }); return; }
  const client = await pool.connect();
  let updated: any = null;
  try {
    await client.query("BEGIN");
    const actionResult = await client.query("SELECT * FROM banking_customer_actions WHERE id=$1 AND website_id=$2 FOR UPDATE", [id, websiteId]);
    const action = actionResult.rows[0];
    if (!action) { await client.query("ROLLBACK"); res.status(404).json({ error: "Banking action not found" }); return; }
    const customerResult = await client.query("SELECT banking_region FROM customers WHERE id=$1 AND website_id=$2 LIMIT 1", [action.customer_id, websiteId]);
    if (!customerResult.rows[0] || !actionAvailable(customerResult.rows[0].banking_region, action.action_type)) {
      await client.query("ROLLBACK"); res.status(404).json({ error: "Banking action not found" }); return;
    }
    const accountResult = await client.query(
      "SELECT id,status FROM accounts WHERE id=$1 AND website_id=$2 AND customer_id=$3 FOR UPDATE",
      [action.account_id, websiteId, action.customer_id],
    );
    if (!accountResult.rows[0]) { await client.query("ROLLBACK"); res.status(409).json({ error: "The action account could not be verified" }); return; }
    const now = new Date();
    const adminId = Number(req.admin?.userId) || null;
    if (status === "approved" || status === "rejected") {
      if (action.status !== "pending") { await client.query("ROLLBACK"); res.status(409).json({ error: "This request has already been " + action.status }); return; }
      const ledgerResult = await client.query(
        "SELECT * FROM transactions WHERE website_id=$1 AND reference=$2 AND status='pending' FOR UPDATE",
        [websiteId, action.reference],
      );
      const ledger = ledgerResult.rows[0];
      if (!ledger) { await client.query("ROLLBACK"); res.status(409).json({ error: "The pending ledger record could not be found" }); return; }
      let balances: any = null;
      if (status === "approved") {
        if (accountResult.rows[0].status !== "active") { await client.query("ROLLBACK"); res.status(403).json({ error: "Only an active account can be debited" }); return; }
        const debit = await client.query(
          "UPDATE accounts SET balance=balance-$1::numeric WHERE id=$2 AND website_id=$3 AND customer_id=$4 AND status='active' AND balance >= $1::numeric RETURNING balance+$1::numeric AS balance_before,balance AS balance_after",
          [action.amount, action.account_id, websiteId, action.customer_id],
        );
        balances = debit.rows[0];
        if (!balances) { await client.query("ROLLBACK"); res.status(400).json({ error: "Insufficient balance at approval time" }); return; }
      }
      const label = action.action_type === "zelle" ? "Zelle request" : action.action_type === "sending_order" ? "Sending order" : "Bill payment";
      const description = status === "approved"
        ? label + " " + action.reference + (action.action_type === "zelle" || action.action_type === "sending_order" ? " — approved internally; no external payment was sent" : " — approved")
        : label + " " + action.reference + " — rejected; no funds were debited";
      await client.query(
        "UPDATE transactions SET status=$1,direction='outgoing',description=$2,balance_before=$3,balance_after=$4,payment_method=$5,completed_at=$6,metadata=COALESCE(metadata,'{}'::jsonb)||$7::jsonb WHERE id=$8 AND website_id=$9",
        [status === "approved" ? "completed" : "failed", description, balances?.balance_before ?? null, balances?.balance_after ?? null,
          action.action_type, status === "approved" ? now : null,
          JSON.stringify({ requestStatus: status, reviewedAt: now.toISOString() }), ledger.id, websiteId],
      );
      const result = await client.query(
        "UPDATE banking_customer_actions SET status=$1,admin_notes=$2,reviewed_by=NULL,reviewed_at=$3,settled_at=$4,updated_at=$3 WHERE id=$5 AND website_id=$6 RETURNING *",
        [status, adminNotes, now, status === "approved" ? now : null, action.id, websiteId],
      );
      updated = result.rows[0];
      await recordScoreOutcome(client, action, status, now);
      if (await tableExists("notifications")) {
        const message = status === "approved"
          ? (action.action_type === "zelle" || action.action_type === "sending_order"
            ? label + " " + action.reference + " was approved internally. No external payment was sent."
            : label + " " + action.reference + " was approved.")
          : "Request " + action.reference + " was declined: " + adminNotes + ". No funds were debited.";
        await client.query(
          "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,action_url,created_at) VALUES ($1,$2,'customer',$3,$4,$5,'/customer',NOW())",
          [websiteId, action.customer_id, status === "approved" ? "Payment request approved" : "Payment request declined", message, status === "approved" ? "success" : "error"],
        );
      }
    } else {
      if (action.status !== "approved") { await client.query("ROLLBACK"); res.status(409).json({ error: "Only an approved payment can be refunded" }); return; }
      const ledgerResult = await client.query(
        "SELECT * FROM transactions WHERE website_id=$1 AND reference=$2 AND status='completed' FOR UPDATE",
        [websiteId, action.reference],
      );
      const ledger = ledgerResult.rows[0];
      if (!ledger) { await client.query("ROLLBACK"); res.status(409).json({ error: "The completed ledger record could not be found" }); return; }
      const credit = await client.query(
        "UPDATE accounts SET balance=balance+$1::numeric WHERE id=$2 AND website_id=$3 AND customer_id=$4 RETURNING balance-$1::numeric AS balance_before,balance AS balance_after",
        [action.amount, action.account_id, websiteId, action.customer_id],
      );
      if (!credit.rows[0]) { await client.query("ROLLBACK"); res.status(409).json({ error: "The account could not be credited" }); return; }
      await client.query(
        "UPDATE transactions SET status='reversed',balance_after=$1,metadata=COALESCE(metadata,'{}'::jsonb)||$2::jsonb WHERE id=$3 AND website_id=$4",
        [credit.rows[0].balance_after, JSON.stringify({ requestStatus: "refunded", refundReason: adminNotes, refundedAt: now.toISOString() }), ledger.id, websiteId],
      );
      await client.query(
        "INSERT INTO transactions (website_id,account_id,transaction_type,amount,gross_amount,fee,net_amount,direction,balance_before,balance_after,currency,description,reference,status,completed_at,metadata) VALUES ($1,$2,'credit',$3,$3,0,$3,'incoming',$4,$5,$6,$7,$8,'completed',$9,$10::jsonb)",
        [websiteId, action.account_id, action.amount, credit.rows[0].balance_before, credit.rows[0].balance_after, action.currency,
          "Refund for " + action.reference, reference("REF"), now,
          JSON.stringify({ requestKind: "banking_customer_action_refund", sourceType: "banking_customer_action", sourceId: action.id, originalReference: action.reference, refundReason: adminNotes })],
      );
      const result = await client.query(
        "UPDATE banking_customer_actions SET status='refunded',admin_notes=$1,reviewed_by=NULL,reviewed_at=$2,refunded_at=$2,updated_at=$2 WHERE id=$3 AND website_id=$4 RETURNING *",
        [adminNotes, now, action.id, websiteId],
      );
      updated = result.rows[0];
      await reverseScoreOutcome(client, action, now);
      if (await tableExists("notifications")) {
        await client.query(
          "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,action_url,created_at) VALUES ($1,$2,'customer','Payment request refunded',$3,'success','/customer',NOW())",
          [websiteId, action.customer_id, "Request " + action.reference + " was refunded to the internal account balance."],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
  await audit("banking_customer_action_" + status, id, Number(req.admin?.userId) || null, { status, reason: adminNotes });
  res.json(shapeAction(updated));
});

export default router;
