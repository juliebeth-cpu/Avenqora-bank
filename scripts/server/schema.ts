import {
  pgTable, text, serial, integer, timestamp, date, boolean, numeric,
} from "drizzle-orm/pg-core";

// ── Website Configuration ─────────────────────────────────────────────────
export const websiteConfig = pgTable("website_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// In-app notifications remain local to this exported website.
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  userId: integer("user_id").notNull(),
  userType: text("user_type").notNull().default("customer"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"),
  read: boolean("read").notNull().default(false),
  actionUrl: text("action_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Website Admins ────────────────────────────────────────────────────────
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  role: text("role", { enum: ["admin", "support", "viewer"] }).notNull().default("admin"),
  status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
   totpSecret: text("totp_secret"),
   totpEnabled: boolean("totp_enabled").notNull().default(false),
  lastLogin: timestamp("last_login", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Customers ─────────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  address: text("address"), city: text("city"), country: text("country"),
  passwordHash: text("password_hash"),
  transactionPinHash: text("transaction_pin_hash"),
  transactionPinSetAt: timestamp("transaction_pin_set_at", { withTimezone: true }),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"),
  referralCode: text("referral_code"),
  referredById: integer("referred_by_id"),
  status: text("status").notNull().default("pending_approval"),
  kycStatus: text("kyc_status").notNull().default("not_submitted"),
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Accounts (Banking / Wallet) ───────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  accountNumber: text("account_number").notNull().unique(),
  accountType: text("account_type", { enum: ["checking", "savings", "money_market", "fixed_deposit", "wallet"] }).notNull().default("checking"),
  balance: numeric("balance", { precision: 18, scale: 4 }).notNull().default("0"),
  ledgerBalance: numeric("ledger_balance", { precision: 18, scale: 4 }),
  currency: text("currency").notNull().default("USD"),
  status: text("status", { enum: ["active", "frozen"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Transactions ──────────────────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  transactionType: text("transaction_type").notNull(),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  description: text("description"),
  reference: text("reference"),
  status: text("status", { enum: ["pending", "completed", "failed"] }).notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Shipments (Tracking) ──────────────────────────────────────────────────
export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  trackingNumber: text("tracking_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id),
  referenceNumber: text("reference_number"), carrier: text("carrier"),
  courierName: text("courier_name"), serviceType: text("service_type"),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"), senderPhone: text("sender_phone"),
  originAddress: text("origin_address"), originCity: text("origin_city"),
  originCountry: text("origin_country"), originAirport: text("origin_airport"),
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"), recipientPhone: text("recipient_phone"),
  destinationAddress: text("destination_address"), destinationCity: text("destination_city"),
  destinationCountry: text("destination_country"), destinationAirport: text("destination_airport"),
  weight: text("weight"), dimensions: text("dimensions"), packageDescription: text("package_description"),
  declaredValue: text("declared_value"), packageValue: text("package_value"),
  packageImages: text("package_images"), trackingImageUrl: text("tracking_image_url"),
  specialInstructions: text("special_instructions"), notes: text("notes"),
  status: text("status").notNull().default("created"),
  estimatedDelivery: date("estimated_delivery", { mode: "string" }),
  actualDelivery: date("actual_delivery", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trackingEvents = pgTable("tracking_events", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  location: text("location"),
  description: text("description"),
  country: text("country"), city: text("city"), airport: text("airport"),
  warehouse: text("warehouse"), remarks: text("remarks"), adminName: text("admin_name"),
  eventTime: timestamp("event_time", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Sessions ──────────────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  userType: text("user_type", { enum: ["admin", "customer"] }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Password reset tokens are generated only inside the standalone deployment.
// They are never copied from the master platform.
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
