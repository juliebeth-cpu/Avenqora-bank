import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const __name = (target: Function, value: string) => Object.defineProperty(target, "name", { value, configurable: true });
const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
const objectName = (prefix: string, parts: string[]) => {
  const raw = [prefix, ...parts].join("_").replace(/[^a-zA-Z0-9_]/g, "_");
  if (raw.length <= 63) return raw;
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  return raw.slice(0, 50) + "_" + hash;
};
const sameColumns = (left: unknown[], right: unknown[]) =>
  left.length === right.length && left.every((column, index) => column === right[index]);
const constraintColumns = async (client: any, table: string, types: string[]) => {
  const result = await client.query(
    `SELECT c.conname AS name, c.contype AS type,
       to_jsonb(ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord)) AS columns
     FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
     WHERE t.relnamespace=current_schema()::regnamespace AND t.relname=$1 AND c.contype=ANY($2::"char"[])`,
    [table, types],
  );
  return result.rows;
};
const hasForeignKeyDefinition = async (client: any, table: string, columns: string[], targetTable: string, targetColumns: string[], onDelete: string, onUpdate: string) => {
  const result = await client.query(
    `SELECT ft.relname AS target_table,
       c.conname AS name, c.convalidated AS validated,
       to_jsonb(ARRAY(SELECT a.attname FROM unnest(c.conkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum ORDER BY k.ord)) AS columns,
       to_jsonb(ARRAY(SELECT a.attname FROM unnest(c.confkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.attnum ORDER BY k.ord)) AS target_columns,
       CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END AS on_delete,
       CASE c.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' ELSE 'NO ACTION' END AS on_update
     FROM pg_constraint c
     JOIN pg_class t ON t.oid=c.conrelid
     JOIN pg_class ft ON ft.oid=c.confrelid
     WHERE t.relnamespace=current_schema()::regnamespace AND t.relname=$1 AND c.contype='f'`,
    [table],
  );
  return result.rows.find((row: any) =>
    row.target_table === targetTable &&
    sameColumns(row.columns, columns) &&
    sameColumns(row.target_columns, targetColumns) &&
    row.on_delete === onDelete &&
    row.on_update === onUpdate) ?? null;
};
const hasUniqueCoverage = async (client: any, table: string, columns: string[]) => {
  const result = await client.query(
    `SELECT to_jsonb(ARRAY(SELECT a.attname FROM unnest(ix.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
                   JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=k.attnum
                   WHERE k.ord <= ix.indnkeyatts ORDER BY k.ord)) AS columns
     FROM pg_index ix JOIN pg_class t ON t.oid=ix.indrelid
     WHERE t.relnamespace=current_schema()::regnamespace AND t.relname=$1
       AND ix.indisunique AND ix.indpred IS NULL AND ix.indexprs IS NULL`, [table]);
  return result.rows.some((row: any) => sameColumns(row.columns, columns));
};
const hasIndexDefinition = async (client: any, table: string, columns: any[], unique: boolean) => {
  const result = await client.query(
    `SELECT ix.indisunique AS unique,
       to_jsonb(ARRAY(SELECT a.attname FROM unnest(ix.indkey::smallint[]) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid=ix.indrelid AND a.attnum=k.attnum
             WHERE k.ord <= ix.indnkeyatts ORDER BY k.ord)) AS columns,
       to_jsonb(ARRAY(SELECT option FROM unnest(ix.indoption::smallint[]) WITH ORDINALITY o(option, ord)
             WHERE o.ord <= ix.indnkeyatts ORDER BY o.ord)) AS options
     FROM pg_index ix JOIN pg_class t ON t.oid=ix.indrelid
     WHERE t.relnamespace=current_schema()::regnamespace AND t.relname=$1
       AND ix.indpred IS NULL AND ix.indexprs IS NULL`, [table]);
  const names = columns.map(column => column.name);
  const options = columns.map(column => (column.direction === "DESC" ? 1 : 0) | (column.nulls === "FIRST" ? 2 : 0));
  return result.rows.some((row: any) => row.unique === unique &&
    sameColumns(row.columns, names) && sameColumns(row.options, options));
};
const indexColumnsSql = (columns: any[]) => columns.map(column =>
  quote(column.name) + " " + column.direction + " NULLS " + column.nulls).join(", ");
const snapshotPath = path.join(process.cwd(), "database", "tenant-snapshot.json");
const configPath = path.join(process.cwd(), "database", "website-config.json");
if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL environment variable is required before running db:seed");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
// The validator is embedded as function source, so include its runtime dependencies here.
const PORTABLE_TABLE_CHECKS: Record<string, Array<{ name: string; expression: string }>> = {"accounts":[{"name":"accounts_account_number_numeric_check","expression":"account_number ~ '^[0-9]+$'::text"}],"banking_customer_actions":[{"name":"banking_customer_actions_action_type_check","expression":"action_type = ANY (ARRAY['bill_payment'::text, 'zelle'::text, 'sending_order'::text])"},{"name":"banking_customer_actions_positive_amount_check","expression":"amount > 0::numeric"},{"name":"banking_customer_actions_amount_check","expression":"amount > 0::numeric"},{"name":"banking_customer_actions_status_check","expression":"status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'refunded'::text])"}],"customer_credit_score_events":[{"name":"customer_credit_score_events_event_type_check","expression":"event_type = ANY (ARRAY['baseline'::text, 'payment_outcome'::text, 'reversal'::text])"},{"name":"customer_credit_score_events_range_check","expression":"score_before >= 165 AND score_before <= 850 AND score_after >= 165 AND score_after <= 850"}],"customer_credit_scores":[{"name":"customer_credit_scores_range_check","expression":"score >= 165 AND score <= 850"}],"customer_information_change_requests":[{"name":"customer_information_change_requests_field_check","expression":"field = ANY (ARRAY['firstName'::text, 'lastName'::text, 'phone'::text, 'address'::text, 'city'::text, 'country'::text, 'dateOfBirth'::text, 'documentType'::text, 'documentNumber'::text, 'documentFrontUrl'::text, 'documentBackUrl'::text, 'selfieUrl'::text])"},{"name":"customer_information_change_requests_status_check","expression":"status = ANY (ARRAY['waiting_team_review'::text, 'approved'::text, 'rejected'::text])"}],"customers":[{"name":"customers_banking_region_check","expression":"banking_region = ANY (ARRAY['USA'::text, 'EUROPE'::text])"},{"name":"customers_requested_account_type_check","expression":"requested_account_type IS NULL OR (requested_account_type = ANY (ARRAY['checking'::text, 'savings'::text, 'money_market'::text, 'fixed_deposit'::text]))"}],"forex_withdrawals":[{"name":"forex_withdrawals_status_check","expression":"status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'processing'::text])"}],"banking_support_messages":[{"name":"banking_support_messages_body_check","expression":"length(TRIM(BOTH FROM body)) > 0"},{"name":"banking_support_messages_sender_type_check","expression":"sender_type = ANY (ARRAY['customer'::text, 'website_admin'::text])"}]};
const validateStandaloneSnapshotMetadata = function validateStandaloneSnapshotMetadata(snapshot, allowedTableNames) {
  const allowedTables = new Set(allowedTableNames);
  const identifierPattern = /^[a-z_][a-z0-9_]*$/i;
  const portableTypePattern = /^(?:smallint|integer|bigint|real|double precision|boolean|text|date|uuid|json|jsonb|bytea|character varying(?:\(\d+\))?|numeric(?:\(\d+(?:,\d+)?\))?|timestamp(?:\(\d+\))? (?:with|without) time zone)$/i;
  const portableDefaultPattern = /^(?:null|true|false|current_timestamp(?:\(\d+\))?|current_date|current_time|localtime(?:\(\d+\))?|localtimestamp(?:\(\d+\))?|now\(\)|gen_random_uuid\(\)|-?\d+(?:\.\d+)?|'(?:[^']|'')*')(?:\s*::\s*(?:text|character varying(?:\(\d+\))?|numeric(?:\(\d+(?:,\d+)?\))?|integer|bigint|smallint|real|double precision|boolean|date|timestamp(?:\(\d+\))? (?:with|without) time zone|json|jsonb))?$/i;
  const referentialActions = /* @__PURE__ */ new Set(["NO ACTION", "RESTRICT", "CASCADE", "SET NULL", "SET DEFAULT"]);
  const tupleKey = (row, columns) => JSON.stringify(columns.map((column) => {
    const value = row[column];
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return "base64:" + value.toString("base64");
    return value;
  }));
  const identifier = (value, label) => {
    if (typeof value !== "string" || !identifierPattern.test(value)) throw new Error("Invalid standalone schema metadata: " + label);
    return value;
  };
  const identifierList = (value, label, allowedColumns) => {
    if (!Array.isArray(value) || !value.length) throw new Error("Invalid standalone schema metadata: " + label);
    const list = value.map((item) => identifier(item, label));
    if (new Set(list).size !== list.length || allowedColumns && list.some((item) => !allowedColumns.has(item))) {
      throw new Error("Invalid standalone schema metadata: " + label);
    }
    return list;
  };
  if (!snapshot || typeof snapshot !== "object" || !snapshot.tables || typeof snapshot.tables !== "object" || Array.isArray(snapshot.tables)) {
    throw new Error("Invalid standalone schema metadata: tables");
  }
  for (const [tableName, table] of Object.entries(snapshot.tables)) {
    identifier(tableName, "table name");
    if (!allowedTables.has(tableName) || !table || typeof table !== "object" || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      throw new Error("Invalid standalone schema metadata: table " + tableName);
    }
    const columnNames = /* @__PURE__ */ new Set();
    for (const column of table.columns) {
      const name2 = identifier(column?.name, "column name");
      if (columnNames.has(name2) || typeof column.type !== "string" || !portableTypePattern.test(column.type) || typeof column.nullable !== "boolean" || typeof column.serial !== "boolean" || column.serial && !/^(smallint|integer|bigint)$/i.test(column.type) || column.defaultSql !== void 0 && column.defaultSql !== null && (typeof column.defaultSql !== "string" || !portableDefaultPattern.test(column.defaultSql)) || column.serial && column.defaultSql != null) {
        throw new Error("Invalid standalone schema metadata: column " + tableName + "." + name2);
      }
      columnNames.add(name2);
    }
    if (table.primaryKey != null) identifierList(table.primaryKey.columns, "primary key " + tableName, columnNames);
    for (const unique of table.uniqueConstraints ?? []) identifierList(unique?.columns, "unique constraint " + tableName, columnNames);
    for (const index2 of [...table.uniqueIndexes ?? [], ...table.indexes ?? []]) {
      if (!Array.isArray(index2?.columns) || !index2.columns.length) throw new Error("Invalid standalone schema metadata: index " + tableName);
      for (const column of index2.columns) {
        identifier(column?.name, "index column " + tableName);
        if (!columnNames.has(column.name) || !["ASC", "DESC"].includes(column.direction) || !["FIRST", "LAST"].includes(column.nulls)) {
          throw new Error("Invalid standalone schema metadata: index " + tableName);
        }
      }
    }
    for (const foreignKey of table.foreignKeys ?? []) {
      const targetTable = identifier(foreignKey?.targetTable, "foreign-key table");
      const columns = identifierList(foreignKey?.columns, "foreign-key columns " + tableName, columnNames);
      const targetColumns = identifierList(foreignKey?.targetColumns, "foreign-key target columns");
      if (columns.length !== targetColumns.length || !referentialActions.has(foreignKey.onDelete) || !referentialActions.has(foreignKey.onUpdate) || foreignKey.notValid !== void 0 && typeof foreignKey.notValid !== "boolean") {
        throw new Error("Invalid standalone schema metadata: foreign key " + tableName);
      }
      if (snapshot.tables[targetTable]) {
        const targetNames = new Set(snapshot.tables[targetTable].columns.map((column) => column.name));
        if (targetColumns.some((column) => !targetNames.has(column))) {
          throw new Error("Invalid standalone schema metadata: foreign-key target " + targetTable);
        }
        if (foreignKey.notValid === true) {
          const targetRows = snapshot.tables[targetTable].rows ?? [];
          const targetKeys = new Set(targetRows.filter((row) => targetColumns.every((column) => row[column] !== null && row[column] !== void 0)).map((row) => tupleKey(row, targetColumns)));
          const hasOrphan = table.rows.some((row) => {
            const values = columns.map((column) => row[column]);
            return !values.some((value) => value === null || value === void 0) && !targetKeys.has(tupleKey(row, columns));
          });
          if (!hasOrphan) throw new Error("Invalid standalone schema metadata: unnecessary NOT VALID foreign key " + tableName);
        }
      } else if (foreignKey.notValid === true) {
        throw new Error("Invalid standalone schema metadata: NOT VALID foreign key target is not exported " + targetTable);
      }
    }
    for (const check3 of table.checks ?? []) {
      identifier(check3?.name, "check constraint name " + tableName);
      const allowed = PORTABLE_TABLE_CHECKS[tableName]?.find(
        (candidate) => candidate.name === check3.name && candidate.expression === check3.expression
      );
      if (!allowed) throw new Error("Invalid standalone schema metadata: check constraint " + tableName);
    }
    if (tableName === "websites" && (table.scope !== "tenant_anchor" || table.columns.length !== 1 || table.columns[0]?.name !== "id" || table.rows.length !== 1 || !Number.isSafeInteger(Number(table.rows[0]?.id)))) {
      throw new Error("Invalid standalone schema metadata: tenant website anchor");
    }
    for (const row of table.rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some((key) => !columnNames.has(identifier(key, "row column " + tableName)))) {
        throw new Error("Invalid standalone snapshot row: " + tableName);
      }
    }
  }
};

async function seed() {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const config = JSON.parse(await readFile(configPath, "utf8"));
  validateStandaloneSnapshotMetadata(snapshot, ["websites","website_admins","customers","website_settings","website_subscriptions","website_publishing","support_channels","deposit_wallet_addresses","promotional_videos","real_estate_properties","generic_records","accounts","forex_accounts","crypto_wallets","shipments","transactions","transfers","deposits","deposit_bank_accounts","withdrawals","bank_cards","beneficiaries","loans","receipts","global_payment_systems","global_payment_tracking","forex_deposits","forex_withdrawals","crypto_orders","crypto_deposits","crypto_withdrawals","investments","portfolios","kyc_configuration","kyc_submissions","payment_submissions","notifications","shipment_bills","banking_support_messages","audit_logs","login_history","referrals","referral_rewards","shipment_stops","journey_locations","investment_plans","real_estate_investments","customer_information_change_requests","receipt_verifications","banking_customer_actions","customer_credit_scores","customer_credit_score_events","website_owner_pages","website_owner_media","forex_positions","flights","tracking_events","global_payment_status_history"]);
  const client = await pool.connect();
  let lastSql = "";
  const originalQuery = client.query.bind(client);
  client.query = (...args: any[]) => {
    lastSql = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "[unknown query]";
    return originalQuery(...args);
  };
  try {
    await client.query("BEGIN");
    // This intentionally does not depend on drizzle-kit. It is the minimal,
    // idempotent runtime schema required by the generated Express routes and
    // makes Docker/clean-room startup fully unattended.
    await client.query(`CREATE TABLE IF NOT EXISTS website_config (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      key text NOT NULL UNIQUE, value text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    if (true) await client.query(`CREATE TABLE IF NOT EXISTS standalone_email_verification_tokens (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      website_id integer NOT NULL,
      customer_id integer NOT NULL,
      token text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    if (true) await client.query(`CREATE TABLE IF NOT EXISTS standalone_kyc_upload_tokens (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      website_id integer NOT NULL,
      customer_id integer NOT NULL,
      submission_id integer NOT NULL,
      slot text NOT NULL,
      object_path text NOT NULL,
      content_type text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS admins (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      username text NOT NULL UNIQUE, email text NOT NULL UNIQUE,
      password_hash text NOT NULL, first_name text NOT NULL DEFAULT '',
      last_name text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'admin',
       status text NOT NULL DEFAULT 'active', totp_secret text,
       totp_enabled boolean NOT NULL DEFAULT false, last_login timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
     await client.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS totp_secret text");
     await client.query("ALTER TABLE admins ADD COLUMN IF NOT EXISTS totp_enabled boolean NOT NULL DEFAULT false");
    await client.query(`CREATE TABLE IF NOT EXISTS standalone_imports (
      export_id text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id integer NOT NULL,
      token_hash text NOT NULL UNIQUE,
      expires_at timestamptz NOT NULL,
      used_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    const alreadyImported = (await client.query("SELECT 1 FROM standalone_imports WHERE export_id=$1", [snapshot.exportId])).rowCount !== 0;
    // Table metadata is validated before use; every row value remains a pg parameter.
    for (const [name, table] of Object.entries<any>(snapshot.tables)) {
      const columns = table.columns.map((c: any) =>
        quote(c.name) + " " + c.type + (c.serial ? " GENERATED BY DEFAULT AS IDENTITY" : "") +
        (c.defaultSql ? " DEFAULT " + c.defaultSql : "") + (c.nullable ? "" : " NOT NULL")).join(", ");
      if (!columns) continue;
      await client.query("CREATE TABLE IF NOT EXISTS " + quote(name) + " (" + columns + ")");
      // db:push may already have created a simplified runtime table. Reconcile
      // it with snapshot metadata before importing, rather than assuming both
      // schemas are identical.
      for (const column of table.columns) {
        await client.query("ALTER TABLE " + quote(name) + " ADD COLUMN IF NOT EXISTS " + quote(column.name) + " " + column.type);
        if (column.defaultSql !== undefined && !column.serial) {
          if (column.defaultSql === null) {
            await client.query("ALTER TABLE " + quote(name) + " ALTER COLUMN " + quote(column.name) + " DROP DEFAULT");
          } else {
            await client.query("ALTER TABLE " + quote(name) + " ALTER COLUMN " + quote(column.name) + " SET DEFAULT " + column.defaultSql);
          }
        }
      }
    }
     // Older exports omit defaults; keep their prior route-level fallback behavior.
     const legacyPortableDefaults: Record<string, Record<string, string>> = {
       notifications: { read: "false", created_at: "NOW()" },
       audit_logs: { created_at: "NOW()" },
       generic_records: { metadata: "'{}'::jsonb" },
     };
      const portableDefaults: Record<string, Record<string, string>> = {
        banking_customer_actions: { details: "'{}'::jsonb", status: "'pending'", created_at: "NOW()", updated_at: "NOW()" },
        customer_credit_scores: { score: "165", created_at: "NOW()", updated_at: "NOW()" },
        customer_credit_score_events: { points_delta: "0", created_at: "NOW()" },
        website_owner_pages: { content: "''", status: "'draft'", created_at: "NOW()", updated_at: "NOW()" },
        website_owner_media: { status: "'pending'", created_at: "NOW()", updated_at: "NOW()" },
      };
      for (const [tableName, defaults] of Object.entries({ ...legacyPortableDefaults, ...portableDefaults })) {
        const table = snapshot.tables[tableName];
        if (!table) continue;
        for (const [column, value] of Object.entries(defaults)) {
          const metadata = table.columns.find((item: any) => item.name === column);
          if (metadata && !Object.prototype.hasOwnProperty.call(metadata, "defaultSql")) {
            await client.query("ALTER TABLE " + quote(tableName) + " ALTER COLUMN " + quote(column) + " SET DEFAULT " + value);
          }
        }
      }
    // Fall back only for route tables absent from this tenant's snapshot.
    // IF NOT EXISTS ensures source metadata always wins and is never tightened.
    await client.query(`CREATE TABLE IF NOT EXISTS customers (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, username text NOT NULL, email text NOT NULL, first_name text NOT NULL DEFAULT '', last_name text NOT NULL DEFAULT '', phone text, address text, city text, country text, password_hash text, transaction_pin_hash text, transaction_pin_set_at timestamptz, terms_accepted_at timestamptz, terms_version text, profile_photo_url text, approved_at timestamptz, approved_by integer, rejection_reason text, referral_code text, referred_by_id integer, banking_region text NOT NULL DEFAULT 'USA' CHECK (banking_region IN ('USA','EUROPE')), requested_account_type text, status text NOT NULL DEFAULT 'pending_approval', kyc_status text NOT NULL DEFAULT 'not_submitted', email_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS requested_account_type text");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_photo_url text");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS approved_at timestamptz");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS approved_by integer");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS rejection_reason text");
    await client.query(`CREATE TABLE IF NOT EXISTS accounts (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, customer_id integer NOT NULL, account_number text UNIQUE, account_type text NOT NULL DEFAULT 'checking', balance numeric(18,4) NOT NULL DEFAULT 0, ledger_balance numeric(18,4) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD', status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS transactions (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, account_id integer NOT NULL, transaction_type text NOT NULL, amount numeric(18,4) NOT NULL, description text, reference text, status text NOT NULL DEFAULT 'completed', created_at timestamptz NOT NULL DEFAULT NOW())`);
    
    await client.query(`CREATE TABLE IF NOT EXISTS bank_cards (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, card_holder_name text NOT NULL, card_brand text NOT NULL,
      last_four_digits text NOT NULL, expiry_month text NOT NULL, expiry_year text NOT NULL,
      billing_address text NOT NULL, status text NOT NULL DEFAULT 'pending', decline_reason text,
      reviewed_by integer, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS customer_credit_scores (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, score smallint NOT NULL DEFAULT 165 CHECK (score BETWEEN 165 AND 850),
      created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS customer_credit_scores_website_customer_uidx ON customer_credit_scores (website_id,customer_id)");
    await client.query(`CREATE TABLE IF NOT EXISTS customer_credit_score_events (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, credit_score_id integer NOT NULL, source_type text NOT NULL,
      source_id integer NOT NULL, event_type text NOT NULL CHECK (event_type IN ('baseline','payment_outcome','reversal')), payment_status text,
      points_delta smallint NOT NULL DEFAULT 0, score_before smallint NOT NULL, score_after smallint NOT NULL,
      description text NOT NULL, created_at timestamptz NOT NULL DEFAULT NOW(),
      CHECK (score_before BETWEEN 165 AND 850 AND score_after BETWEEN 165 AND 850)
    )`);
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS customer_credit_score_events_source_event_uidx ON customer_credit_score_events (website_id,source_type,source_id,event_type)");
    await client.query(`CREATE TABLE IF NOT EXISTS notifications (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer, user_id integer NOT NULL,
      user_type text NOT NULL, title text NOT NULL, message text NOT NULL, type text NOT NULL DEFAULT 'info',
      read boolean NOT NULL DEFAULT false, action_url text, created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer, user_id integer,
      user_type text NOT NULL, action text NOT NULL, resource_type text, resource_id integer,
      details jsonb, ip_address text, user_agent text, created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS customer_information_change_requests (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, field text NOT NULL, previous_value text, requested_value text NOT NULL,
      reason text NOT NULL, status text NOT NULL DEFAULT 'waiting_team_review', reviewed_by integer,
      reviewed_at timestamptz, decision_reason text, created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS receipts (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, receipt_number text NOT NULL UNIQUE, transaction_kind text NOT NULL,
      source_id integer NOT NULL, amount numeric(20,4) NOT NULL, gross_amount numeric(20,4) NOT NULL DEFAULT 0,
      fee numeric(20,4) NOT NULL DEFAULT 0, net_amount numeric(20,4) NOT NULL DEFAULT 0,
      direction text NOT NULL DEFAULT 'outgoing', currency text NOT NULL DEFAULT 'USD', status text NOT NULL,
      payment_method text, reference text, deleted_at timestamptz, issued_at timestamptz NOT NULL DEFAULT NOW(),
      created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS receipt_verifications (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, customer_id integer,
      receipt_number text NOT NULL, verification_token text, source_type text NOT NULL,
      source_id integer NOT NULL, service_type text NOT NULL, status text NOT NULL DEFAULT 'valid',
      receipt_data text, issued_at timestamptz NOT NULL DEFAULT NOW(), created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(), voided_at timestamptz
    )`);
    await client.query("ALTER TABLE receipt_verifications ADD COLUMN IF NOT EXISTS verification_token text");
    await client.query("UPDATE receipt_verifications SET verification_token='rv_' || replace(gen_random_uuid()::text,'-','') WHERE verification_token IS NULL OR btrim(verification_token)=''");
    await client.query("ALTER TABLE receipt_verifications ALTER COLUMN verification_token SET DEFAULT ('rv_' || replace(gen_random_uuid()::text,'-',''))");
    await client.query("ALTER TABLE receipt_verifications ALTER COLUMN verification_token SET NOT NULL");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS receipt_verifications_source_unique ON receipt_verifications (source_type,source_id)");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS receipt_verifications_token_unique ON receipt_verifications (verification_token)");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS receipt_verifications_receipt_number_unique ON receipt_verifications (receipt_number)");
    await client.query(`CREATE TABLE IF NOT EXISTS customers (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      username text NOT NULL, email text NOT NULL, first_name text NOT NULL DEFAULT '',
      last_name text NOT NULL DEFAULT '', phone text, address text, city text, country text,
      preferred_locale text, password_hash text, transaction_pin_hash text, transaction_pin_set_at timestamptz,
      terms_accepted_at timestamptz, terms_version text, profile_photo_url text, approved_at timestamptz,
      approved_by integer, rejection_reason text, referral_code text, referred_by_id integer,
      banking_region text NOT NULL DEFAULT 'USA' CHECK (banking_region IN ('USA','EUROPE')),
      requested_account_type text, status text NOT NULL DEFAULT 'pending_approval',
      kyc_status text NOT NULL DEFAULT 'not_submitted', email_verified boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS withdrawals (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, account_id integer NOT NULL, amount numeric(20,4) NOT NULL,
      fee numeric(20,4) NOT NULL DEFAULT 0, net_amount numeric(20,4) NOT NULL DEFAULT 0,
      direction text NOT NULL DEFAULT 'outgoing', currency text NOT NULL DEFAULT 'USD',
      destination_type text NOT NULL DEFAULT 'bank_account', destination_details jsonb NOT NULL DEFAULT '{}'::jsonb,
      status text NOT NULL DEFAULT 'pending', admin_notes text, reference text NOT NULL,
      global_payment_tracking_number text, balance_before numeric(20,4), balance_after numeric(20,4),
      reviewed_by integer, reviewed_at timestamptz, completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS transfers (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, from_account_id integer NOT NULL, to_account_id integer,
      transfer_type text NOT NULL, beneficiary_details jsonb NOT NULL DEFAULT '{}'::jsonb,
      amount numeric(20,4) NOT NULL, currency text NOT NULL DEFAULT 'USD',
      fee numeric(20,4) NOT NULL DEFAULT 0, net_amount numeric(20,4) NOT NULL DEFAULT 0,
      direction text NOT NULL DEFAULT 'outgoing', status text NOT NULL DEFAULT 'pending',
      admin_notes text, reference text NOT NULL, global_payment_tracking_number text,
      balance_before numeric(20,4), balance_after numeric(20,4),
      reviewed_by integer, reviewed_at timestamptz, completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS deposits (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      customer_id integer NOT NULL, account_id integer NOT NULL, amount numeric(20,4) NOT NULL,
      fee numeric(20,4) NOT NULL DEFAULT 0, net_amount numeric(20,4) NOT NULL DEFAULT 0,
      direction text NOT NULL DEFAULT 'incoming', currency text NOT NULL DEFAULT 'USD',
      method text, receiving_bank_account_id integer, receiving_bank_account_snapshot jsonb,
      session_expires_at timestamptz, payment_instructions text, receipt_url text,
      status text NOT NULL DEFAULT 'pending', admin_notes text, reference text NOT NULL,
      global_payment_tracking_number text, balance_before numeric(20,4), balance_after numeric(20,4),
      reviewed_by integer, reviewed_at timestamptz, completed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS deposit_bank_accounts (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL,
      display_name text NOT NULL, bank_name text NOT NULL, account_name text NOT NULL,
      account_number text NOT NULL, currency text NOT NULL DEFAULT 'USD', country text, region text,
      routing_number text, iban text, swift_bic text, bank_address text, instructions text,
      enabled boolean NOT NULL DEFAULT false, sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS global_payment_tracking (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, tracking_number text NOT NULL UNIQUE,
      website_id integer, source_key text NOT NULL UNIQUE, source_type text NOT NULL, source_id integer,
      originating_reference text, payment_type text NOT NULL, payment_method text, currency text NOT NULL,
      amount numeric(20,4), fee numeric(20,4), net_amount numeric(20,4), amount_public boolean NOT NULL DEFAULT false,
      public_metadata jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(), submitted_at timestamptz,
      last_status_at timestamptz NOT NULL DEFAULT NOW(), completed_at timestamptz, disabled_at timestamptz
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS global_payment_status_history (
      id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, tracking_record_id integer NOT NULL,
      event_key text NOT NULL UNIQUE, status text NOT NULL, occurred_at timestamptz NOT NULL,
      public_message text, created_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    await client.query("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS receiving_bank_account_id integer");
    await client.query("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS receiving_bank_account_snapshot jsonb");
    await client.query("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS session_expires_at timestamptz");
    await client.query("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS payment_instructions text");
    await client.query("ALTER TABLE deposits ADD COLUMN IF NOT EXISTS global_payment_tracking_number text");
    await client.query("ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS global_payment_tracking_number text");
    await client.query("ALTER TABLE transfers ADD COLUMN IF NOT EXISTS global_payment_tracking_number text");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS gross_amount numeric(20,4)");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee numeric(20,4) NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS net_amount numeric(20,4)");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'incoming'");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method text");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_before numeric(20,4)");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after numeric(20,4)");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at timestamptz");
    await client.query("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()");
  
    await client.query(`CREATE TABLE IF NOT EXISTS shipments (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, tracking_number text UNIQUE, customer_id integer, sender_name text NOT NULL DEFAULT '', sender_address text, recipient_name text NOT NULL DEFAULT '', recipient_address text, description text, weight numeric(10,2), status text NOT NULL DEFAULT 'pending', estimated_delivery timestamptz, created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS tracking_events (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, shipment_id integer NOT NULL, status text NOT NULL, location text, description text, event_time timestamptz NOT NULL DEFAULT NOW(), created_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query(`CREATE TABLE IF NOT EXISTS referral_rewards (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, referrer_id integer NOT NULL, referred_id integer NOT NULL, deposit_id integer, investment_plan_id integer, investment_id integer, bonus_type text NOT NULL DEFAULT 'percentage', bonus_value numeric(18,4) NOT NULL DEFAULT 0, bonus_amount numeric(18,4) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'USD', plan_name text, status text NOT NULL DEFAULT 'pending', admin_notes text, receipt_id integer, created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query("ALTER TABLE referral_rewards ADD COLUMN IF NOT EXISTS deposit_id integer");
    await client.query(`CREATE TABLE IF NOT EXISTS referrals (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, referrer_id integer NOT NULL, referee_id integer NOT NULL, status text NOT NULL DEFAULT 'pending', bonus_type text, bonus_value numeric(18,4), qualifying_deposit_amount numeric(18,4), bonus_amount numeric(18,4), admin_notes text, created_at timestamptz NOT NULL DEFAULT NOW(), resolved_at timestamptz)`);
    await client.query(`CREATE TABLE IF NOT EXISTS kyc_submissions (id integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, website_id integer NOT NULL, customer_id integer NOT NULL, document_type text NOT NULL, document_number text, full_name text NOT NULL, date_of_birth text, address text, document_front_url text, document_back_url text, selfie_url text, status text NOT NULL DEFAULT 'pending', review_notes text, reviewed_by integer, reviewed_at timestamptz, submitted_at timestamptz NOT NULL DEFAULT NOW(), created_at timestamptz NOT NULL DEFAULT NOW(), updated_at timestamptz NOT NULL DEFAULT NOW())`);
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash text");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS transaction_pin_hash text");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS transaction_pin_set_at timestamptz");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS terms_version text");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code text");
    await client.query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by_id integer");
    await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS website_id integer");
    await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ledger_balance numeric(18,4) NOT NULL DEFAULT 0");
    await client.query("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()");
    await client.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS website_id integer");
    await client.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW()");
    for (const [key, value] of Object.entries(config)) {
      await client.query("INSERT INTO website_config (key,value) VALUES ($1,$2) ON CONFLICT (key) DO NOTHING", [key, String(value)]);
    }
    for (const [name, table] of Object.entries<any>(snapshot.tables)) {
      const exported = new Set(table.columns.map((column: any) => column.name));
      const requiredColumns = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND is_nullable='NO' AND column_default IS NULL",
        [name],
      );
      for (const required of requiredColumns.rows) {
        // Credentials and other intentionally redacted columns may already
        // exist in the simplified runtime schema. They cannot be populated
        // from a secure export, so make only those omitted columns nullable.
        if (!exported.has(required.column_name)) {
          await client.query("ALTER TABLE " + quote(name) + " ALTER COLUMN " + quote(required.column_name) + " DROP NOT NULL");
        }
      }
      for (const row of alreadyImported ? [] : table.rows) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const values = keys.map(key => row[key] instanceof Date ? row[key].toISOString() : row[key]);
        await client.query("INSERT INTO " + quote(name) + " (" + keys.map(quote).join(",") + ") VALUES (" + keys.map((_, i) => "$" + (i + 1)).join(",") + ") ON CONFLICT DO NOTHING", values);
      }
      for (const column of table.columns) {
        if (column.nullable) {
          await client.query("ALTER TABLE " + quote(name) + " ALTER COLUMN " + quote(column.name) + " DROP NOT NULL");
        } else {
          await client.query("ALTER TABLE " + quote(name) + " ALTER COLUMN " + quote(column.name) + " SET NOT NULL");
        }
      }
      for (const column of table.columns.filter((c: any) => c.serial)) {
        const sequence = await client.query("SELECT pg_get_serial_sequence($1, $2) AS name", [name, column.name]);
        if (sequence.rows[0]?.name) await client.query("SELECT setval($1, COALESCE((SELECT MAX(" + quote(column.name) + ") FROM " + quote(name) + "), 1), true)", [sequence.rows[0].name]);
      }
    }
    {
      // Restore source key semantics before indexes and relationships. Existing
      // equivalent fallback/runtime constraints are reused rather than doubled.
      for (const [name, table] of Object.entries<any>(snapshot.tables)) {
        if (table.primaryKey) {
          const primaryKeys = await constraintColumns(client, name, ["p"]);
          if (!primaryKeys.some((key: any) => sameColumns(key.columns, table.primaryKey.columns))) {
            if (primaryKeys.length) throw new Error("Cannot restore source primary key for " + name + ": a different primary key already exists");
            const constraint = objectName("export_pk", [name, ...table.primaryKey.columns]);
            await client.query("ALTER TABLE " + quote(name) + " ADD CONSTRAINT " + quote(constraint) +
              " PRIMARY KEY (" + table.primaryKey.columns.map(quote).join(",") + ")");
          }
        }
        for (const unique of table.uniqueConstraints ?? []) {
          if (await hasUniqueCoverage(client, name, unique.columns)) continue;
          const constraint = objectName("export_uq", [name, ...unique.columns]);
          await client.query("ALTER TABLE " + quote(name) + " ADD CONSTRAINT " + quote(constraint) +
            " UNIQUE (" + unique.columns.map(quote).join(",") + ")");
        }
        for (const check of table.checks ?? []) {
          const existingCheck = await client.query(
            "SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass(current_schema() || '.' || $1) AND conname=$2 AND contype='c' LIMIT 1",
            [name, check.name],
          );
          if (!existingCheck.rowCount) {
            await client.query("ALTER TABLE " + quote(name) + " ADD CONSTRAINT " + quote(check.name) + " CHECK (" + check.expression + ")");
          }
        }
        for (const [index, unique] of (table.uniqueIndexes ?? []).entries()) {
          const names = unique.columns.map((column: any) => column.name);
          if (await hasIndexDefinition(client, name, unique.columns, true)) continue;
          const indexName = objectName("export_uidx", [name, ...names, String(index)]);
          await client.query("CREATE UNIQUE INDEX IF NOT EXISTS " + quote(indexName) +
            " ON " + quote(name) + " (" + indexColumnsSql(unique.columns) + ")");
        }
        for (const [index, normal] of (table.indexes ?? []).entries()) {
          if (await hasIndexDefinition(client, name, normal.columns, false)) continue;
          const indexName = objectName("export_idx", [name, ...normal.columns.map((column: any) => column.name), String(index)]);
          await client.query("CREATE INDEX IF NOT EXISTS " + quote(indexName) +
            " ON " + quote(name) + " (" + indexColumnsSql(normal.columns) + ")");
        }
      }
      for (const [name, table] of Object.entries<any>(snapshot.tables)) {
        for (const fk of table.foreignKeys) {
          if (!snapshot.tables[fk.targetTable]) continue; // external/global relation intentionally excluded
          const columns = fk.columns ?? [fk.column];
          const targetColumns = fk.targetColumns ?? [fk.targetColumn];
          const existing = await hasForeignKeyDefinition(client, name, columns, fk.targetTable, targetColumns, fk.onDelete ?? "NO ACTION", fk.onUpdate ?? "NO ACTION");
          if (existing) {
            if (fk.notValid !== true && existing.validated === false) {
              await client.query("ALTER TABLE " + quote(name) + " VALIDATE CONSTRAINT " + quote(existing.name));
            }
            continue;
          }
          if (!(await hasUniqueCoverage(client, fk.targetTable, targetColumns))) {
            const target = snapshot.tables[fk.targetTable];
            if (target.metadataComplete === true) {
              throw new Error("Source metadata has no unique key for foreign key target " + fk.targetTable + "(" + targetColumns.join(",") + ")");
            }
            // Compatibility fallback for an older/incomplete snapshot only.
            const indexName = objectName("export_uq_fallback", [fk.targetTable, ...targetColumns]);
            await client.query("CREATE UNIQUE INDEX IF NOT EXISTS " + quote(indexName) +
              " ON " + quote(fk.targetTable) + " (" + targetColumns.map(quote).join(",") + ")");
          }
          const constraint = objectName("export_fk", [name, ...columns, fk.targetTable, ...targetColumns]);
          await client.query("ALTER TABLE " + quote(name) + " ADD CONSTRAINT " + quote(constraint) +
            " FOREIGN KEY (" + columns.map(quote).join(",") + ") REFERENCES " + quote(fk.targetTable) +
            "(" + targetColumns.map(quote).join(",") + ") ON DELETE " + (fk.onDelete ?? "NO ACTION") +
            " ON UPDATE " + (fk.onUpdate ?? "NO ACTION") + (fk.notValid === true ? " NOT VALID" : ""));
        }
      }
      // Fallback tables are intentionally created without inline foreign keys
      // because source tables may not have had their keys restored yet. Add
      // their local relationships only after all snapshot keys are present.
      const addFallbackForeignKey = async (table: string, name: string, sql: string) => {
        const existing = await client.query("SELECT 1 FROM pg_constraint WHERE conname=$1 LIMIT 1", [name]);
        if (!existing.rowCount) await client.query(sql);
      };
      if (!snapshot.tables.accounts) {
        await addFallbackForeignKey("accounts", "standalone_accounts_customer_fk", "ALTER TABLE accounts ADD CONSTRAINT standalone_accounts_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE");
      }
      if (!snapshot.tables.transactions) {
        await addFallbackForeignKey("transactions", "standalone_transactions_account_fk", "ALTER TABLE transactions ADD CONSTRAINT standalone_transactions_account_fk FOREIGN KEY (account_id) REFERENCES accounts(id)");
      }
      if (!snapshot.tables.shipments) {
        await addFallbackForeignKey("shipments", "standalone_shipments_customer_fk", "ALTER TABLE shipments ADD CONSTRAINT standalone_shipments_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL");
      }
      if (!snapshot.tables.tracking_events) {
        await addFallbackForeignKey("tracking_events", "standalone_tracking_events_shipment_fk", "ALTER TABLE tracking_events ADD CONSTRAINT standalone_tracking_events_shipment_fk FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE");
      }
      await client.query("INSERT INTO standalone_imports (export_id) VALUES ($1) ON CONFLICT (export_id) DO NOTHING", [snapshot.exportId]);
    }
    const existing = await client.query("SELECT id FROM admins LIMIT 1");
    if (!existing.rows.length) {
      const { BOOTSTRAP_ADMIN_USERNAME: username, BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password } = process.env;
      if (!username || !email || !password || password.length < 12) throw new Error("Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL, and a 12+ character BOOTSTRAP_ADMIN_PASSWORD before first seed");
      await client.query("INSERT INTO admins (username,email,password_hash,first_name,last_name,role,status) VALUES ($1,$2,$3,$4,$5,$6,$7)", [username, email, await bcrypt.hash(password, 12), "Site", "Admin", "admin", "active"]);
    }
    await client.query("COMMIT");
  } catch (error) {
    const pgError = error as any;
    process.stderr.write("Seed diagnostic: " + JSON.stringify({
      sql: lastSql,
      code: pgError?.code,
      detail: pgError?.detail,
      where: pgError?.where,
      schema: pgError?.schema,
      table: pgError?.table,
      column: pgError?.column,
      constraint: pgError?.constraint,
      position: pgError?.position,
      message: pgError?.message,
    }) + "\\n");
    await client.query("ROLLBACK");
    throw error;
  }
  finally { client.release(); await pool.end(); }
}
seed().catch(error => { process.stderr.write("Seed failed: " + (error instanceof Error ? error.message : String(error)) + "\n"); process.exitCode = 1; });
