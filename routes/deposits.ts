import { Router, type Request, type Response } from "express";
import express from "express";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db.js";
import { requireAdmin, requireCustomer } from "../auth.js";

const router = Router();
const websiteId = 10;
const depositMethods = [
  { id: "bank_transfer", label: "Bank Transfer", enabled: true, instructions: null },
  { id: "crypto", label: "Cryptocurrency", enabled: true, instructions: null },
  { id: "cash_app", label: "Cash App", enabled: false, instructions: null },
  { id: "paypal", label: "PayPal", enabled: false, instructions: null },
  { id: "other", label: "Other", enabled: false, instructions: null },
];
const privateRoot = () => path.resolve(process.env.UPLOAD_DIR ?? "data/uploads", "deposit-receipts");
const MONEY_SCALE = 10000n;
const parseMoneyUnits = (value: unknown) => {
  const text = String(value).trim();
  if (!/^[0-9]+(?:[.][0-9]{1,4})?$/.test(text)) throw new Error("Amount must be a positive decimal with at most 4 fractional digits");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * MONEY_SCALE + BigInt((fraction + "0000").slice(0, 4));
};
const formatMoneyUnits = (units: bigint) => String(units / MONEY_SCALE) + "." + String(units % MONEY_SCALE).padStart(4, "0");
const feeFor = (gross: unknown) => {
  const grossUnits = parseMoneyUnits(gross);
  if (grossUnits <= 0n) throw new Error("Amount must be positive");
  const feeUnits = (grossUnits * 5n + 5000n) / 10000n;
  return { grossAmount: formatMoneyUnits(grossUnits), fee: formatMoneyUnits(feeUnits), netAmount: formatMoneyUnits(grossUnits - feeUnits) };
};
const addMoney = (left: unknown, right: unknown) => formatMoneyUnits(parseMoneyUnits(left) + parseMoneyUnits(right));
const getCustomer = async (req: Request & { customer?: { userId?: number } }, res: Response) => {
  const id = Number(req.customer?.userId);
  if (!Number.isSafeInteger(id) || id < 1) { res.status(401).json({ error: "Customer session is invalid" }); return null; }
  const result = await pool.query("SELECT * FROM customers WHERE id=$1 AND website_id=$2 LIMIT 1", [id, websiteId]);
  const customer = result.rows[0];
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return null; }
  if (customer.status !== "active") { res.status(403).json({ error: "Customer account is not active" }); return null; }
  return customer;
};
const getBankingSettings = async () => {
  const result = await pool.query("SELECT setting_value FROM website_settings WHERE website_id=$1 AND setting_key='banking_settings' LIMIT 1", [websiteId]).catch(() => ({ rows: [] }));
  try {
    const parsed = JSON.parse(result.rows[0]?.setting_value ?? "{}");
    const methods = Array.isArray(parsed.depositMethods) ? parsed.depositMethods : depositMethods;
    return { ...parsed, depositMethods: methods.filter((method: any) => method && typeof method.id === "string" && method.enabled !== false) };
  } catch { return { depositMethods: depositMethods.filter((method) => method.enabled) }; }
};
const trackerStatus = async (client: any, sourceKey: string, status: string, message: string | null = null) => {
  const updated = await client.query(
    "UPDATE global_payment_tracking SET status=$1,last_status_at=NOW(),completed_at=CASE WHEN $1='COMPLETED' THEN NOW() ELSE completed_at END WHERE website_id=$2 AND source_key=$3 RETURNING id",
    [status, websiteId, sourceKey],
  );
  if (!updated.rows[0]) return;
  const eventKey = "standalone:" + sourceKey + ":" + status.toLowerCase();
  await client.query(
    "INSERT INTO global_payment_status_history (tracking_record_id,event_key,status,occurred_at,public_message) VALUES ($1,$2,$3,NOW(),$4) ON CONFLICT (event_key) DO NOTHING",
    [updated.rows[0].id, eventKey, status, message],
  );
};
const expireStaleDeposits = async (customerId?: number) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const values = [websiteId];
    const ownerFilter = customerId === undefined ? "" : " AND customer_id=$2";
    if (customerId !== undefined) values.push(customerId);
    const stale = await client.query(
      "SELECT id,customer_id,account_id,reference FROM deposits WHERE website_id=$1" + ownerFilter + " AND status='pending' AND receipt_url IS NULL AND session_expires_at IS NOT NULL AND session_expires_at <= NOW() FOR UPDATE",
      values,
    );
    for (const deposit of stale.rows) {
      await client.query("UPDATE deposits SET status='expired',updated_at=NOW() WHERE id=$1 AND website_id=$2 AND status='pending' AND receipt_url IS NULL", [deposit.id, websiteId]);
      await client.query("UPDATE transactions SET status='cancelled',metadata=COALESCE(metadata,'{}'::jsonb)||$1::jsonb,updated_at=NOW() WHERE website_id=$2 AND account_id=$3 AND reference=$4 AND status='pending'", [JSON.stringify({ requestKind: "deposit", sourceId: deposit.id, requestStatus: "expired" }), websiteId, deposit.account_id, deposit.reference]);
      await trackerStatus(client, "deposit:" + deposit.id, "CANCELLED", "Deposit session expired");
    }
    await client.query("COMMIT");
    return stale.rows.map((deposit) => Number(deposit.id));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
};
const newTrackingNumber = () => "DGL-" + new Date().toISOString().slice(0, 10).replaceAll("-", "") + "-" + randomBytes(6).toString("hex").toUpperCase();
const createTracker = async (client: any, deposit: any) => {
  const trackingNumber = newTrackingNumber();
  const sourceKey = "deposit:" + deposit.id;
  const inserted = await client.query(
    "INSERT INTO global_payment_tracking (tracking_number,website_id,source_key,source_type,source_id,originating_reference,payment_type,payment_method,currency,amount,fee,net_amount,status,submitted_at,last_status_at) VALUES ($1,$2,$3,'deposit',$4,$5,'deposit',$6,$7,$8,$9,$10,'PENDING_VERIFICATION',NOW(),NOW()) RETURNING id",
    [trackingNumber, websiteId, sourceKey, deposit.id, deposit.reference, deposit.method, deposit.currency, deposit.amount, deposit.fee, deposit.net_amount],
  );
  await client.query("UPDATE deposits SET global_payment_tracking_number=$1 WHERE id=$2 AND website_id=$3", [trackingNumber, deposit.id, websiteId]);
  for (const [index, status] of ["CREATED", "PAYMENT_SUBMITTED", "PENDING_VERIFICATION"].entries()) {
    await client.query(
      "INSERT INTO global_payment_status_history (tracking_record_id,event_key,status,occurred_at) VALUES ($1,$2,$3,NOW()) ON CONFLICT (event_key) DO NOTHING",
      [inserted.rows[0].id, "standalone:" + sourceKey + ":initial:" + index, status],
    );
  }
  return trackingNumber;
};
const uploadToken = (payload: Record<string, unknown>) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", process.env.SESSION_SECRET ?? "").update(encoded).digest("base64url");
  return encoded + "." + signature;
};
const verifyUploadToken = (token: unknown) => {
  const [encoded, supplied] = String(token ?? "").split(".");
  if (!encoded || !supplied) return null;
  const expected = createHmac("sha256", process.env.SESSION_SECRET ?? "").update(encoded).digest();
  let actual;
  try { actual = Buffer.from(supplied, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.exp > Date.now() ? payload : null;
  } catch { return null; }
};
const fileType = (body: Buffer) => {
  if (body.subarray(0, 5).toString() === "%PDF-") return { ext: "pdf", type: "application/pdf" };
  if (body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { ext: "jpg", type: "image/jpeg" };
  if (body.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return { ext: "png", type: "image/png" };
  if (body.subarray(0, 4).toString() === "RIFF" && body.subarray(8, 12).toString() === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
};
const receiptPath = (value: unknown) => {
  if (typeof value !== "string" || value.includes("..")) return null;
  const uploadPrefix = "deposit-receipts/" + websiteId + "/";
  if (value.startsWith(uploadPrefix)) return path.join(privateRoot(), value.slice("deposit-receipts/".length));
  const archivePrefix = "/_private-assets/";
  if (!value.startsWith(archivePrefix)) return null;
  const archiveRoot = path.resolve(process.cwd(), "private-assets");
  const file = path.resolve(archiveRoot, value.slice(archivePrefix.length));
  return file.startsWith(archiveRoot + path.sep) ? file : null;
};
const shapeDeposit = (row: any) => ({
  id: row.id, websiteId: row.website_id, customerId: row.customer_id, accountId: row.account_id,
  amount: row.amount, fee: row.fee, netAmount: row.net_amount, direction: row.direction,
  currency: row.currency, method: row.method, receivingBankAccountId: row.receiving_bank_account_id,
  receivingBankAccountSnapshot: row.receiving_bank_account_snapshot,
  sessionExpiresAt: row.session_expires_at ? new Date(row.session_expires_at).toISOString() : null,
  paymentInstructions: row.payment_instructions,
  receiptUrl: row.receipt_url ? "/api/customer/deposits/" + row.id + "/receipt-file" : null,
  status: row.status, adminNotes: row.admin_notes, reference: row.reference,
  paymentTrackingNumber: row.global_payment_tracking_number ?? row.reference,
  createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
});

router.get("/customer/dashboard", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  await expireStaleDeposits(customer.id);
  const [accounts, deposits] = await Promise.all([
    pool.query("SELECT id,account_number,account_type,balance,currency,status,created_at FROM accounts WHERE website_id=$1 AND customer_id=$2 ORDER BY id", [websiteId, customer.id]),
    pool.query("SELECT id,amount,fee,net_amount,currency,method,status,reference,receipt_url,payment_instructions,receiving_bank_account_snapshot,created_at,session_expires_at FROM deposits WHERE website_id=$1 AND customer_id=$2 AND status='pending' AND receipt_url IS NULL AND (session_expires_at IS NULL OR session_expires_at > NOW()) ORDER BY created_at DESC LIMIT 10", [websiteId, customer.id]),
  ]);
  res.json({
    serverTime: new Date().toISOString(),
    customer: {
      id: customer.id, websiteId: customer.website_id, username: customer.username,
      email: customer.email, firstName: customer.first_name, lastName: customer.last_name,
      country: customer.country, bankingRegion: customer.banking_region, status: customer.status,
      kycStatus: customer.kyc_status, emailVerified: customer.email_verified,
    },
    accounts: accounts.rows,
    resumableDeposits: deposits.rows.map(shapeDeposit),
  });
});

router.get("/customer/deposit-methods", requireCustomer, async (req, res) => {
  if (!await getCustomer(req, res)) return;
  res.json((await getBankingSettings()).depositMethods);
});

router.get("/customer/deposit-bank-accounts", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  const result = await pool.query(
    "SELECT id,display_name,bank_name,account_name,account_number,currency,country,region,routing_number,iban,swift_bic,bank_address,instructions FROM deposit_bank_accounts WHERE website_id=$1 AND enabled=true AND (region IS NULL OR region=$2) ORDER BY sort_order,id",
    [websiteId, customer.banking_region ?? "USA"],
  );
  res.json(result.rows.map((row) => ({
    id: row.id, displayName: row.display_name, bankName: row.bank_name,
    accountName: row.account_name, accountNumber: row.account_number, currency: row.currency,
    country: row.country, region: row.region, routingNumber: row.routing_number,
    iban: row.iban, swiftBic: row.swift_bic, bankAddress: row.bank_address, instructions: row.instructions,
  })));
});

router.post("/customer/deposits", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  const amountText = String(req.body?.amount ?? "").trim();
  const amount = Number(amountText);
  const accountId = Number(req.body?.accountId);
  const currency = String(req.body?.currency ?? "USD").trim().toUpperCase();
  const method = String(req.body?.method ?? "");
  const requestedBankAccountId = req.body?.receivingBankAccountId === undefined || req.body?.receivingBankAccountId === "" ? undefined : Number(req.body.receivingBankAccountId);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000 || !Number.isInteger(accountId) || !/^[A-Z]{3}$/.test(currency)) { res.status(400).json({ error: "Choose a valid account, currency, and positive deposit amount" }); return; }
  let feeValues;
  try { feeValues = feeFor(amountText); } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Deposit amount is invalid" }); return; }
  if (!customer.transaction_pin_hash || typeof req.body?.transactionPin !== "string" || !await (await import("bcryptjs")).default.compare(req.body.transactionPin, customer.transaction_pin_hash)) { res.status(403).json({ error: "A valid transaction PIN is required" }); return; }
  const settings = await getBankingSettings();
  const configuredMethod = settings.depositMethods.find((candidate: any) => candidate.id === method);
  if (!configuredMethod) { res.status(400).json({ error: "This deposit method is not enabled" }); return; }
  const accounts = await pool.query("SELECT id,currency,status FROM accounts WHERE id=$1 AND website_id=$2 AND customer_id=$3 LIMIT 1", [accountId, websiteId, customer.id]);
  if (!accounts.rows[0] || accounts.rows[0].status !== "active") { res.status(400).json({ error: "The selected account is not available" }); return; }
  const eligible = await pool.query("SELECT * FROM deposit_bank_accounts WHERE website_id=$1 AND enabled=true AND currency=$2 AND (region IS NULL OR region=$3) ORDER BY sort_order,id", [websiteId, currency, customer.banking_region ?? "USA"]);
  let receiving = null;
  if (requestedBankAccountId !== undefined) {
    if (method !== "bank_transfer") { res.status(400).json({ error: "Receiving bank accounts can only be used with bank transfer deposits" }); return; }
    receiving = eligible.rows.find((row) => Number(row.id) === requestedBankAccountId) ?? null;
    if (!receiving) { res.status(400).json({ error: "This receiving bank account is not available for your website, region, or currency" }); return; }
  } else if (method === "bank_transfer" && eligible.rows.length) { res.status(400).json({ error: "Select a receiving bank account for this deposit" }); return; }
  const { grossAmount, fee, netAmount } = feeValues;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const reference = "DEP-" + randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
  const snapshot = receiving ? Object.fromEntries([["id", receiving.id], ["displayName", receiving.display_name], ["bankName", receiving.bank_name], ["accountName", receiving.account_name], ["accountNumber", receiving.account_number], ["currency", receiving.currency], ["country", receiving.country], ["region", receiving.region], ["routingNumber", receiving.routing_number], ["iban", receiving.iban], ["swiftBic", receiving.swift_bic], ["bankAddress", receiving.bank_address], ["instructions", receiving.instructions]]) : null;
  const instructions = configuredMethod.instructions ?? (method === "bank_transfer" ? settings.bankInstructions : method === "crypto" ? settings.cryptoInstructions : null);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query("INSERT INTO deposits (website_id,customer_id,account_id,amount,fee,net_amount,direction,currency,method,receiving_bank_account_id,receiving_bank_account_snapshot,session_expires_at,payment_instructions,status,reference,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,'incoming',$7,$8,$9,$10::jsonb,$11,$12,'pending',$13,NOW(),NOW()) RETURNING *", [websiteId, customer.id, accountId, grossAmount, fee, netAmount, currency, method, receiving?.id ?? null, snapshot ? JSON.stringify(snapshot) : null, expiresAt, instructions, reference]);
    const deposit = inserted.rows[0];
    await client.query("INSERT INTO transactions (website_id,account_id,transaction_type,amount,gross_amount,fee,net_amount,direction,payment_method,currency,description,reference,status,metadata,created_at,updated_at) VALUES ($1,$2,'credit',$3,$3,$4,$5,'incoming',$6,$7,$8,$9,'pending',$10::jsonb,NOW(),NOW())", [websiteId, accountId, grossAmount, fee, netAmount, method, currency, "Deposit " + reference, reference, JSON.stringify({ requestKind: "deposit", sourceId: deposit.id, requestStatus: "pending" })]);
    deposit.global_payment_tracking_number = await createTracker(client, deposit);
    await client.query("COMMIT");
    res.status(201).json(shapeDeposit({ ...deposit, session_expires_at: expiresAt, receiving_bank_account_snapshot: snapshot }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
});

router.get("/customer/deposits", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  await expireStaleDeposits(customer.id);
  const rows = await pool.query("SELECT * FROM deposits WHERE website_id=$1 AND customer_id=$2 ORDER BY created_at DESC", [websiteId, customer.id]);
  res.json(rows.rows.map(shapeDeposit));
});

router.post("/customer/deposits/:id/receipt-upload-url", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  const id = Number(req.params.id);
  await expireStaleDeposits(customer.id);
  const result = await pool.query("SELECT id,status,receipt_url,session_expires_at FROM deposits WHERE id=$1 AND website_id=$2 AND customer_id=$3 LIMIT 1", [id, websiteId, customer.id]);
  const deposit = result.rows[0];
  if (!deposit) { res.status(404).json({ error: "Deposit not found" }); return; }
  if (deposit.status !== "pending" || deposit.receipt_url || (deposit.session_expires_at && new Date(deposit.session_expires_at).getTime() <= Date.now())) { res.status(410).json({ error: "This deposit is not accepting receipt uploads" }); return; }
  const deadline = deposit.session_expires_at ? new Date(deposit.session_expires_at).getTime() : Date.now() + 24 * 60 * 60 * 1000;
  const token = uploadToken({ websiteId, customerId: customer.id, depositId: id, exp: Math.min(deadline, Date.now() + 15 * 60 * 1000), nonce: randomBytes(12).toString("hex") });
  res.json({ uploadURL: "/api/customer/deposits/" + id + "/receipt-upload?token=" + encodeURIComponent(token), expiresAt: new Date(deadline).toISOString(), maxBytes: 8 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] });
});

router.put("/customer/deposits/:id/receipt-upload", express.raw({ type: ["image/jpeg", "image/png", "image/webp", "application/pdf"], limit: "8mb" }), async (req, res) => {
  const token = verifyUploadToken(req.query.token);
  const id = Number(req.params.id);
  if (!token || token.websiteId !== websiteId || token.depositId !== id) { res.status(401).json({ error: "Receipt upload authorization is invalid or expired" }); return; }
  if (!Buffer.isBuffer(req.body) || !req.body.length) { res.status(400).json({ error: "A receipt image or PDF is required" }); return; }
  const detected = fileType(req.body);
  if (!detected || detected.type !== req.get("content-type")) { res.status(415).json({ error: "Receipt must be a valid JPEG, PNG, WEBP, or PDF file" }); return; }
  const client = await pool.connect();
  let filePath = "";
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT * FROM deposits WHERE id=$1 AND website_id=$2 AND customer_id=$3 FOR UPDATE", [id, websiteId, token.customerId]);
    const deposit = selected.rows[0];
    if (!deposit) { await client.query("ROLLBACK"); res.status(404).json({ error: "Deposit not found" }); return; }
    if (deposit.status !== "pending" || deposit.receipt_url) { await client.query("ROLLBACK"); res.status(409).json({ error: "This deposit already has a receipt or is no longer pending" }); return; }
    if (deposit.session_expires_at && new Date(deposit.session_expires_at).getTime() <= Date.now()) {
      await client.query("UPDATE deposits SET status='expired',updated_at=NOW() WHERE id=$1 AND website_id=$2 AND status='pending' AND receipt_url IS NULL", [id, websiteId]);
      await client.query("UPDATE transactions SET status='cancelled',metadata=COALESCE(metadata,'{}'::jsonb)||$1::jsonb,updated_at=NOW() WHERE website_id=$2 AND account_id=$3 AND reference=$4 AND status='pending'", [JSON.stringify({ requestKind: "deposit", sourceId: id, requestStatus: "expired" }), websiteId, deposit.account_id, deposit.reference]);
      await trackerStatus(client, "deposit:" + id, "CANCELLED", "Deposit session expired");
      await client.query("COMMIT");
      res.status(410).json({ error: "This deposit session has expired" });
      return;
    }
    const relative = websiteId + "/" + token.customerId + "/" + id + "-" + randomUUID() + "." + detected.ext;
    filePath = path.join(privateRoot(), relative);
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await writeFile(filePath, req.body, { flag: "wx", mode: 0o600 });
    const receiptUrl = "deposit-receipts/" + relative;
    await client.query("UPDATE deposits SET receipt_url=$1,status='processing',updated_at=NOW() WHERE id=$2 AND website_id=$3 AND status='pending' AND receipt_url IS NULL", [receiptUrl, id, websiteId]);
    await client.query("COMMIT");
    res.json({ id, status: "processing", receiptUrl: "/api/customer/deposits/" + id + "/receipt-file" });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (filePath) await unlink(filePath).catch(() => undefined);
    throw error;
  } finally { client.release(); }
});

router.post("/customer/deposits/:id/receipt", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  const depositId = Number(req.params.id);
  const receiptUrl = typeof req.body?.receiptUrl === "string" ? req.body.receiptUrl.trim() : "";
  if (!Number.isInteger(depositId) || depositId < 1 || !receiptUrl) {
    res.status(400).json({ error: "A valid deposit id and receipt URL are required" });
    return;
  }
  const result = await pool.query(
    "UPDATE deposits SET receipt_url=$1,status='processing',updated_at=NOW() WHERE id=$2 AND website_id=$3 AND customer_id=$4 AND status='pending' AND receipt_url IS NULL AND (session_expires_at IS NULL OR session_expires_at>NOW()) RETURNING *",
    [receiptUrl, depositId, websiteId, customer.id],
  );
  if (!result.rowCount) {
    const existing = await pool.query(
      "SELECT status,receipt_url,session_expires_at FROM deposits WHERE id=$1 AND website_id=$2 AND customer_id=$3",
      [depositId, websiteId, customer.id],
    );
    if (!existing.rowCount) { res.status(404).json({ error: "Deposit not found" }); return; }
    if (existing.rows[0].session_expires_at && new Date(existing.rows[0].session_expires_at).getTime() <= Date.now()) {
      res.status(409).json({ error: "Deposit payment session has expired" });
      return;
    }
    res.status(409).json({ error: existing.rows[0].receipt_url ? "A receipt has already been submitted" : "Deposit is not pending" });
    return;
  }
  res.json(result.rows[0]);
});

router.get("/customer/deposits/:id/receipt-file", requireCustomer, async (req, res) => {
  const customer = await getCustomer(req, res);
  if (!customer) return;
  const result = await pool.query("SELECT receipt_url FROM deposits WHERE id=$1 AND website_id=$2 AND customer_id=$3", [Number(req.params.id), websiteId, customer.id]);
  const file = receiptPath(result.rows[0]?.receipt_url);
  if (!file) { res.status(404).json({ error: "Receipt not found" }); return; }
  try {
    const body = await readFile(file);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", path.extname(file) === ".pdf" ? "application/pdf" : path.extname(file) === ".png" ? "image/png" : path.extname(file) === ".webp" ? "image/webp" : "image/jpeg");
    res.send(body);
  } catch { res.status(404).json({ error: "Receipt not found" }); }
});

router.get("/admin/deposits", requireAdmin, async (req, res) => {
  await expireStaleDeposits();
  const region = String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase();
  if (!["ALL","USA","EUROPE"].includes(region)) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const status = typeof req.query.status === "string" ? req.query.status : "";
  if (status && !["pending","processing","approved","rejected","expired","cancelled"].includes(status)) { res.status(400).json({ error:"Invalid deposit status" }); return; }
  const values: unknown[] = [websiteId];
  const regionFilter = region === "ALL" ? "" : " AND c.banking_region=$" + (values.push(region));
  const statusFilter = status ? " AND d.status=$" + (values.push(status)) : "";
  const result = await pool.query(
    "SELECT d.*,c.first_name || ' ' || c.last_name AS customer_name,c.banking_region FROM deposits d JOIN customers c ON c.id=d.customer_id AND c.website_id=d.website_id WHERE d.website_id=$1" + regionFilter + statusFilter + " ORDER BY d.created_at DESC LIMIT 500",
    values,
  );
  res.json(result.rows);
});

router.get("/admin/deposits/:id/receipt-file", requireAdmin, async (req, res) => {
  const result = await pool.query("SELECT receipt_url FROM deposits WHERE id=$1 AND website_id=$2", [Number(req.params.id), websiteId]);
  const file = receiptPath(result.rows[0]?.receipt_url);
  if (!file) { res.status(404).json({ error: "Receipt not found" }); return; }
  try {
    const body = await readFile(file);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", path.extname(file) === ".pdf" ? "application/pdf" : path.extname(file) === ".png" ? "image/png" : path.extname(file) === ".webp" ? "image/webp" : "image/jpeg");
    res.send(body);
  } catch { res.status(404).json({ error: "Receipt not found" }); }
});

router.patch("/admin/deposits/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const adminNotes = typeof req.body?.adminNotes === "string" ? req.body.adminNotes.trim() : "";
  if (!Number.isSafeInteger(id) || id < 1 || !["approved", "rejected"].includes(status) || (status === "rejected" && !adminNotes) || adminNotes.length > 1000) { res.status(400).json({ error: "A valid review status and rejection reason are required" }); return; }
  await expireStaleDeposits();
  const region = String(req.header("x-banking-region") ?? req.query.region ?? "ALL").toUpperCase();
  if (!["ALL","USA","EUROPE"].includes(region)) { res.status(400).json({ error:"Invalid banking region" }); return; }
  const owner = await pool.query(
    "SELECT c.banking_region FROM deposits d JOIN customers c ON c.id=d.customer_id AND c.website_id=d.website_id WHERE d.id=$1 AND d.website_id=$2 LIMIT 1",
    [id,websiteId],
  );
  if (!owner.rowCount || (region !== "ALL" && owner.rows[0].banking_region !== region)) { res.status(404).json({ error:"Deposit not found" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query("SELECT * FROM deposits WHERE id=$1 AND website_id=$2 FOR UPDATE", [id, websiteId]);
    const deposit = selected.rows[0];
    if (!deposit) { await client.query("ROLLBACK"); res.status(404).json({ error: "Deposit not found" }); return; }
    if (["approved", "rejected", "expired", "cancelled"].includes(deposit.status)) { await client.query("ROLLBACK"); res.status(409).json({ error: "Deposit is already settled" }); return; }
    if (deposit.status === "pending" && !deposit.receipt_url && deposit.session_expires_at && new Date(deposit.session_expires_at).getTime() <= Date.now()) {
      await client.query("UPDATE deposits SET status='expired',updated_at=NOW() WHERE id=$1 AND website_id=$2 AND status='pending' AND receipt_url IS NULL", [id, websiteId]);
      await client.query("UPDATE transactions SET status='cancelled',metadata=COALESCE(metadata,'{}'::jsonb)||$1::jsonb,updated_at=NOW() WHERE website_id=$2 AND account_id=$3 AND reference=$4 AND status='pending'", [JSON.stringify({ requestKind: "deposit", sourceId: id, requestStatus: "expired" }), websiteId, deposit.account_id, deposit.reference]);
      await trackerStatus(client, "deposit:" + id, "CANCELLED", "Deposit session expired");
      await client.query("COMMIT");
      res.status(410).json({ error: "Deposit session has expired" });
      return;
    }
    const accountResult = await client.query("SELECT * FROM accounts WHERE id=$1 AND website_id=$2 AND customer_id=$3 FOR UPDATE", [deposit.account_id, websiteId, deposit.customer_id]);
    const account = accountResult.rows[0];
    if (!account) { await client.query("ROLLBACK"); res.status(403).json({ error: "Deposit account ownership could not be verified" }); return; }
    const { grossAmount, fee, netAmount } = feeFor(deposit.amount);
    const balanceBefore = String(account.balance);
    const balanceAfter = status === "approved" ? addMoney(balanceBefore, netAmount) : balanceBefore;
    const adminId = Number((req as Request & { admin?: { userId?: number } }).admin?.userId) || null;
    await client.query("UPDATE deposits SET status=$1,fee=$2,net_amount=$3,balance_before=$4,balance_after=$5,admin_notes=$6,reviewed_by=$7,reviewed_at=NOW(),completed_at=CASE WHEN $1='approved' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$8 AND website_id=$9", [status, fee, netAmount, balanceBefore, balanceAfter, adminNotes || null, adminId, id, websiteId]);
    if (status === "approved") await client.query("UPDATE accounts SET balance=$1,updated_at=NOW() WHERE id=$2 AND website_id=$3 AND customer_id=$4", [balanceAfter, account.id, websiteId, deposit.customer_id]);
    const ledgerStatus = status === "approved" ? "completed" : "rejected";
    const ledger = await client.query("UPDATE transactions SET status=$1,gross_amount=$2,fee=$3,net_amount=$4,direction='incoming',balance_before=$5,balance_after=$6,completed_at=CASE WHEN $1='completed' THEN NOW() ELSE NULL END,metadata=COALESCE(metadata,'{}'::jsonb)||$7::jsonb,updated_at=NOW() WHERE website_id=$8 AND account_id=$9 AND reference=$10 AND status='pending' RETURNING id", [ledgerStatus, grossAmount, fee, netAmount, balanceBefore, balanceAfter, JSON.stringify({ requestKind: "deposit", sourceId: id, requestStatus: status, rejectionReason: status === "rejected" ? adminNotes : null }), websiteId, deposit.account_id, deposit.reference]);
    if (!ledger.rows[0]) { await client.query("ROLLBACK"); res.status(409).json({ error: "Deposit ledger was already settled" }); return; }
    if (status === "approved") {
      const receiptNumber = "RCPT-" + randomUUID().replace(/-/g,"").slice(0,12).toUpperCase();
      const receipt = await client.query(
        "INSERT INTO receipts (website_id,customer_id,receipt_number,transaction_kind,source_id,amount,gross_amount,fee,net_amount,direction,currency,status,payment_method,reference,issued_at,created_at) VALUES ($1,$2,$3,'deposit',$4,$5,$6,$7,$8,'incoming',$9,'approved',$10,$11,NOW(),NOW()) RETURNING id",
        [websiteId,deposit.customer_id,receiptNumber,id,grossAmount,grossAmount,fee,netAmount,deposit.currency,deposit.method,deposit.reference],
      );
      await client.query(
        "INSERT INTO receipt_verifications (website_id,customer_id,receipt_number,verification_token,source_type,source_id,service_type,status,issued_at) VALUES ($1,$2,$3,$4,'financial',$5,'banking','valid',NOW()) ON CONFLICT (source_type,source_id) DO NOTHING",
        [websiteId,deposit.customer_id,receiptNumber,"rv_" + randomUUID().replace(/-/g,""),receipt.rows[0].id],
      );
    }
    await client.query(
      "INSERT INTO notifications (website_id,user_id,user_type,title,message,type,created_at) VALUES ($1,$2,'customer',$3,$4,$5,NOW())",
      [websiteId,deposit.customer_id,status === "approved" ? "Deposit successful" : "Deposit update",
        status === "approved" ? "Your deposit of " + grossAmount + " " + deposit.currency + " was successful."
          : "Your deposit of " + grossAmount + " " + deposit.currency + " was " + status + (adminNotes ? ". " + adminNotes : "."),
        status === "approved" ? "success" : "error"],
    );
    await client.query(
      "INSERT INTO audit_logs (website_id,user_id,user_type,action,resource_type,resource_id,details,ip_address,created_at) VALUES ($1,$2,'website_admin',$3,'deposit',$4,$5::jsonb,$6,NOW())",
      [websiteId,adminId,status === "approved" ? "transaction_status_approved" : "transaction_status_rejected",
        id,JSON.stringify({ status,adminNotes:adminNotes || null }),req.ip ?? null],
    );
    await trackerStatus(client, "deposit:" + id, status === "approved" ? "APPROVED" : "REJECTED", adminNotes || null);
    await client.query("COMMIT");
    const updated = await pool.query("SELECT d.*,c.first_name || ' ' || c.last_name AS customer_name FROM deposits d JOIN customers c ON c.id=d.customer_id AND c.website_id=d.website_id WHERE d.id=$1 AND d.website_id=$2", [id, websiteId]);
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally { client.release(); }
});

export default router;
