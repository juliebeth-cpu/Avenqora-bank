export type BankingRegion = "USA" | "EUROPE";

export interface BankingRegionalConfig {
  region: BankingRegion;
  locale: string;
  timeZone: string;
  fallbackCurrency: string;
  balanceLabel: string;
  activityLabel: string;
  accountLabel: string;
  accountNumberLabel: string;
  accountTypeLabel: string;
  primaryNavLabel: string;
  activityNavLabel: string;
  actionOrder: string[];
  accent: string;
  accentSoft: string;
}

const USA_CONFIG: BankingRegionalConfig = {
  region: "USA",
  locale: "en-US",
  timeZone: "UTC",
  fallbackCurrency: "USD",
  balanceLabel: "Total balance",
  activityLabel: "Recent activity",
  accountLabel: "My accounts",
  accountNumberLabel: "Account number",
  accountTypeLabel: "Account type",
  primaryNavLabel: "Home",
  activityNavLabel: "Activity",
  actionOrder: ["bills", "transfer", "zelle", "deposit"],
  accent: "#67d5c4",
  accentSoft: "rgba(103,213,196,0.12)",
};

const EUROPE_CONFIG: BankingRegionalConfig = {
  region: "EUROPE",
  locale: "de-DE",
  timeZone: "UTC",
  fallbackCurrency: "EUR",
  balanceLabel: "Available balance",
  activityLabel: "Recent transactions",
  accountLabel: "Your accounts",
  accountNumberLabel: "IBAN / account number",
  accountTypeLabel: "Account type",
  primaryNavLabel: "Overview",
  activityNavLabel: "Transactions",
  actionOrder: ["transfer", "sending-order", "cards", "message"],
  accent: "#8ed8ff",
  accentSoft: "rgba(142,216,255,0.12)",
};

export function resolveBankingRegion(customer: unknown): BankingRegion {
  const record = (customer ?? {}) as Record<string, unknown>;
  const raw = String(record.bankingRegion ?? record.banking_region ?? "").trim().toUpperCase();
  return raw === "EU" || raw === "EUROPE" || raw === "EUR" ? "EUROPE" : "USA";
}

export function getBrowserTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return timeZone;
    }
  } catch {
    // Fall through to a neutral timezone when the browser does not expose a valid zone.
  }
  return "UTC";
}

export function formatBankingAdminDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  },
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: getBrowserTimeZone() }).format(date);
}

export function formatBankingAdminDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: getBrowserTimeZone() }).format(date);
}

export function getBankingRegionalConfig(customer: unknown): BankingRegionalConfig {
  const region = resolveBankingRegion(customer);
  const baseConfig = region === "EUROPE" ? EUROPE_CONFIG : USA_CONFIG;
  return {
    ...baseConfig,
    timeZone: getBrowserTimeZone(),
  };
}

export function formatBankingAmount(
  value: number | string | null | undefined,
  currency: string | null | undefined,
  config: BankingRegionalConfig,
  options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: currency || config.fallbackCurrency,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatBankingDate(
  value: string | number | Date,
  config: BankingRegionalConfig,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  return new Intl.DateTimeFormat(config.locale, { ...options, timeZone: config.timeZone }).format(new Date(value));
}

export function formatBankingDateTime(
  value: string | number | Date,
  config: BankingRegionalConfig,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat(config.locale, options).format(new Date(value));
}

export function formatBankingTransactionDateTime(
  value: string | number | Date,
  config: BankingRegionalConfig,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  return new Intl.DateTimeFormat(config.locale, { ...options, timeZone: config.timeZone }).format(new Date(value));
}

export function maskBankingAccount(value: string | null | undefined): string {
  if (!value) return "•••• •••• •••• 0000";
  const clean = value.replace(/\s/g, "");
  const lastFour = clean.slice(-4).padStart(4, "0");
  return `•••• •••• •••• ${lastFour}`;
}