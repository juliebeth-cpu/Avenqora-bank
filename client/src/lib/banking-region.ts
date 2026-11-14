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
  timeZone: "America/New_York",
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
  timeZone: "Europe/Berlin",
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

const COUNTRY_TIME_ZONES: Record<string, string> = {
  AT: "Europe/Vienna", BE: "Europe/Brussels", BG: "Europe/Sofia",
  CH: "Europe/Zurich", CY: "Europe/Nicosia", CZ: "Europe/Prague",
  DE: "Europe/Berlin", DK: "Europe/Copenhagen", EE: "Europe/Tallinn",
  ES: "Europe/Madrid", FI: "Europe/Helsinki", FR: "Europe/Paris",
  GB: "Europe/London", GR: "Europe/Athens", HR: "Europe/Zagreb",
  HU: "Europe/Budapest", IE: "Europe/Dublin", IS: "Atlantic/Reykjavik",
  IT: "Europe/Rome", LI: "Europe/Vaduz", LT: "Europe/Vilnius",
  LU: "Europe/Luxembourg", LV: "Europe/Riga", MC: "Europe/Monaco",
  MD: "Europe/Chisinau", ME: "Europe/Podgorica", MK: "Europe/Skopje",
  MT: "Europe/Malta", NL: "Europe/Amsterdam", NO: "Europe/Oslo",
  PL: "Europe/Warsaw", PT: "Europe/Lisbon", RO: "Europe/Bucharest",
  RS: "Europe/Belgrade", SE: "Europe/Stockholm", SI: "Europe/Ljubljana",
  SK: "Europe/Bratislava", UA: "Europe/Kyiv",
};

export function resolveBankingRegion(customer: unknown): BankingRegion {
  const record = (customer ?? {}) as Record<string, unknown>;
  const raw = String(record.bankingRegion ?? record.banking_region ?? "").trim().toUpperCase();
  return raw === "EU" || raw === "EUROPE" || raw === "EUR" ? "EUROPE" : "USA";
}

export function getBankingRegionalConfig(customer: unknown): BankingRegionalConfig {
  const record = (customer ?? {}) as Record<string, unknown>;
  const region = resolveBankingRegion(customer);
  const country = String(record.country ?? "").trim().toUpperCase();
  const baseConfig = region === "EUROPE" ? EUROPE_CONFIG : USA_CONFIG;
  return {
    ...baseConfig,
    timeZone: COUNTRY_TIME_ZONES[country] ?? baseConfig.timeZone,
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
  return new Intl.DateTimeFormat(config.locale, options).format(new Date(value));
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