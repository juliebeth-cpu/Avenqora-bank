import { Router } from "express";
 import { pool } from "../db.js";
 import { requireAdmin, requireCustomer } from "../auth.js";

 const router = Router();
 const websiteId = 10;
 const capabilities = {"type":"banking","customerAccounts":true,"accountNumber":true,"accountTypes":["checking","savings","money_market","fixed_deposit"],"wallet":true,"balance":true,"financialTransactions":true,"transactionPin":true,"payment":true,"paymentReview":true,"paymentEvidence":true,"paymentMethods":["bank_transfer","crypto","cash_app","paypal","other"],"country":"required","kycSupported":true,"kycMode":"required","customerApproval":true,"teamReview":true,"customerFeatures":["accounts","balances","deposits","withdrawals","transfers","statements","cards","kyc"],"adminFeatures":["customers","accounts","deposits","withdrawals","transfers","cards","loans","kyc","team_review"],"recordLabelSingular":"Transaction","recordLabelPlural":"Transactions","recordCategory":"transaction","actionLabel":"Open an Account"};
 const EXPORTED_TABLES = ["website_admins","customers","website_settings","website_subscriptions","website_publishing","support_channels","deposit_wallet_addresses","promotional_videos","real_estate_properties","generic_records","accounts","forex_accounts","crypto_wallets","shipments","transactions","transfers","deposits","deposit_bank_accounts","withdrawals","bank_cards","beneficiaries","loans","receipts","global_payment_systems","global_payment_tracking","forex_deposits","forex_withdrawals","crypto_orders","crypto_deposits","crypto_withdrawals","investments","portfolios","kyc_configuration","kyc_submissions","payment_submissions","notifications","shipment_bills","banking_support_messages","audit_logs","login_history","referrals","referral_rewards","shipment_stops","journey_locations","investment_plans","real_estate_investments","customer_information_change_requests","receipt_verifications","banking_customer_actions","customer_credit_scores","customer_credit_score_events","website_owner_pages","website_owner_media","tracking_events"];
 const SAFE_TABLE = /^[a-z_][a-z0-9_]*$/;

 async function hasColumn(table: string, column: string): Promise<boolean> {
   const result = await pool.query(
     "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2 LIMIT 1",
     [table, column],
   );
    return Number(result.rowCount ?? 0) > 0;
 }

 function allowedTable(value: string): string | null {
   return SAFE_TABLE.test(value) && EXPORTED_TABLES.includes(value) ? value : null;
 }

 router.get("/capabilities", (_req, res) => {
   res.json({ websiteId, capabilities });
 });

 router.get("/tables", requireAdmin, async (_req, res) => {
   try {
     const tables = [];
     for (const table of EXPORTED_TABLES) {
       const exists = await pool.query(
         "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1",
         [table],
       );
       if (!exists.rowCount) continue;
       const scoped = await hasColumn(table, "website_id");
       const result = scoped
         ? await pool.query("SELECT COUNT(*)::int AS count FROM " + table + " WHERE website_id=$1", [websiteId])
         : await pool.query("SELECT COUNT(*)::int AS count FROM " + table);
       tables.push({ table, count: Number(result.rows[0]?.count ?? 0), scoped });
     }
     res.json({ websiteId, capabilities, tables });
   } catch {
     res.status(500).json({ error: "Failed to load exported feature data" });
   }
 });

 router.get("/tables/:table", requireAdmin, async (req, res) => {
   const table = allowedTable(String(req.params.table ?? ""));
   if (!table) { res.status(404).json({ error: "Feature table not available" }); return; }
   try {
     const exists = await pool.query(
       "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1",
       [table],
     );
     if (!exists.rowCount) { res.status(404).json({ error: "Feature table not found" }); return; }
     const scoped = await hasColumn(table, "website_id");
     const result = scoped
       ? await pool.query("SELECT * FROM " + table + " WHERE website_id=$1 ORDER BY 1 LIMIT 500", [websiteId])
       : await pool.query("SELECT * FROM " + table + " ORDER BY 1 LIMIT 500");
     res.json({ table, rows: result.rows });
   } catch {
     res.status(500).json({ error: "Failed to load feature records" });
   }
 });

 router.get("/customer/summary", requireCustomer, async (req, res) => {
   const customerId = Number((req as any).customer.userId);
   try {
     const tables = [];
     for (const table of EXPORTED_TABLES) {
       const exists = await pool.query(
         "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1",
         [table],
       );
       if (!exists.rowCount || !(await hasColumn(table, "customer_id"))) continue;
       const scoped = await hasColumn(table, "website_id");
       const result = await pool.query(
         "SELECT COUNT(*)::int AS count FROM " + table + " WHERE customer_id=$1 AND " + (scoped ? "website_id=$2" : "TRUE"),
         scoped ? [customerId, websiteId] : [customerId],
       );
       tables.push({ table, count: Number(result.rows[0]?.count ?? 0) });
     }
     res.json({ websiteId, capabilities, tables });
   } catch {
     res.status(500).json({ error: "Failed to load customer feature data" });
   }
 });

 export default router;
 