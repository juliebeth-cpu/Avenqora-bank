/**
 * Shared customer-facing country and locale rules.
 *
 * Country values are stored as ISO alpha-2 codes. Locale resolution is:
 * customer override → tenant default → country mapping → English fallback.
 *
 * The global registry stores metadata for a broad world-language catalog. Only
 * the verified customer locales below are exposed as runtime-translated support.
 * Unverified languages remain available as metadata and can safely fall back to
 * English until a verified resource catalog is added.
 */
export interface GlobalLanguageEntry {
  code: string;
  label: string;
  nativeName: string;
  locale: string;
  direction: "ltr" | "rtl";
  family?: string;
  region?: string;
  fallback?: string;
  translationStatus: "verified" | "fallback-only";
}

export const GLOBAL_LANGUAGE_REGISTRY: readonly GlobalLanguageEntry[] = [
  { code: "en", label: "English", nativeName: "English", locale: "en-US", direction: "ltr", family: "Germanic", region: "Global", fallback: "en", translationStatus: "verified" },
  { code: "es", label: "Spanish", nativeName: "Español", locale: "es-ES", direction: "ltr", family: "Romance", region: "Europe", fallback: "en", translationStatus: "verified" },
  { code: "pt", label: "Portuguese", nativeName: "Português", locale: "pt-BR", direction: "ltr", family: "Romance", region: "Europe", fallback: "en", translationStatus: "verified" },
  { code: "fr", label: "French", nativeName: "Français", locale: "fr-FR", direction: "ltr", family: "Romance", region: "Europe", fallback: "en", translationStatus: "verified" },
  { code: "de", label: "German", nativeName: "Deutsch", locale: "de-DE", direction: "ltr", family: "Germanic", region: "Europe", fallback: "en", translationStatus: "verified" },
  { code: "it", label: "Italian", nativeName: "Italiano", locale: "it-IT", direction: "ltr", family: "Romance", region: "Europe", fallback: "en", translationStatus: "verified" },
  { code: "nl", label: "Dutch", nativeName: "Nederlands", locale: "nl-NL", direction: "ltr", family: "Germanic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "pl", label: "Polish", nativeName: "Polski", locale: "pl-PL", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "cs", label: "Czech", nativeName: "Čeština", locale: "cs-CZ", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "sk", label: "Slovak", nativeName: "Slovenčina", locale: "sk-SK", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "hu", label: "Hungarian", nativeName: "Magyar", locale: "hu-HU", direction: "ltr", family: "Uralic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "ro", label: "Romanian", nativeName: "Română", locale: "ro-RO", direction: "ltr", family: "Romance", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "bg", label: "Bulgarian", nativeName: "Български", locale: "bg-BG", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "hr", label: "Croatian", nativeName: "Hrvatski", locale: "hr-HR", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "sr", label: "Serbian", nativeName: "Српски", locale: "sr-Latn-RS", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "sl", label: "Slovenian", nativeName: "Slovenščina", locale: "sl-SI", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "bs", label: "Bosnian", nativeName: "Bosanski", locale: "bs-BA", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "uk", label: "Ukrainian", nativeName: "Українська", locale: "uk-UA", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "ru", label: "Russian", nativeName: "Русский", locale: "ru-RU", direction: "ltr", family: "Slavic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "el", label: "Greek", nativeName: "Ελληνικά", locale: "el-GR", direction: "ltr", family: "Hellenic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "tr", label: "Turkish", nativeName: "Türkçe", locale: "tr-TR", direction: "ltr", family: "Turkic", region: "Europe", fallback: "en", translationStatus: "fallback-only" },
  { code: "ar", label: "Arabic", nativeName: "العربية", locale: "ar", direction: "rtl", family: "Semitic", region: "Middle East", fallback: "en", translationStatus: "verified" },
  { code: "he", label: "Hebrew", nativeName: "עברית", locale: "he-IL", direction: "rtl", family: "Semitic", region: "Middle East", fallback: "en", translationStatus: "fallback-only" },
  { code: "fa", label: "Persian", nativeName: "فارسی", locale: "fa-IR", direction: "rtl", family: "Iranic", region: "Middle East", fallback: "en", translationStatus: "fallback-only" },
  { code: "ur", label: "Urdu", nativeName: "اردو", locale: "ur-PK", direction: "rtl", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी", locale: "hi-IN", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "verified" },
  { code: "bn", label: "Bengali", nativeName: "বাংলা", locale: "bn-BD", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "pa", label: "Punjabi", nativeName: "ਪੰਜਾਬੀ", locale: "pa-IN", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "gu", label: "Gujarati", nativeName: "ગુજરાતી", locale: "gu-IN", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "mr", label: "Marathi", nativeName: "मराठी", locale: "mr-IN", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்", locale: "ta-IN", direction: "ltr", family: "Dravidian", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "te", label: "Telugu", nativeName: "తెలుగు", locale: "te-IN", direction: "ltr", family: "Dravidian", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "kn", label: "Kannada", nativeName: "ಕನ್ನಡ", locale: "kn-IN", direction: "ltr", family: "Dravidian", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "ml", label: "Malayalam", nativeName: "മലയാളം", locale: "ml-IN", direction: "ltr", family: "Dravidian", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "ne", label: "Nepali", nativeName: "नेपाली", locale: "ne-NP", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "si", label: "Sinhala", nativeName: "සිංහල", locale: "si-LK", direction: "ltr", family: "Indo-Aryan", region: "South Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "zh", label: "Chinese", nativeName: "中文", locale: "zh-CN", direction: "ltr", family: "Sinitic", region: "East Asia", fallback: "en", translationStatus: "verified" },
  { code: "ja", label: "Japanese", nativeName: "日本語", locale: "ja-JP", direction: "ltr", family: "Japonic", region: "East Asia", fallback: "en", translationStatus: "verified" },
  { code: "ko", label: "Korean", nativeName: "한국어", locale: "ko-KR", direction: "ltr", family: "Koreanic", region: "East Asia", fallback: "en", translationStatus: "verified" },
  { code: "vi", label: "Vietnamese", nativeName: "Tiếng Việt", locale: "vi-VN", direction: "ltr", family: "Austroasiatic", region: "Southeast Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "th", label: "Thai", nativeName: "ไทย", locale: "th-TH", direction: "ltr", family: "Tai", region: "Southeast Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "id", label: "Indonesian", nativeName: "Bahasa Indonesia", locale: "id-ID", direction: "ltr", family: "Austronesian", region: "Southeast Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "ms", label: "Malay", nativeName: "Bahasa Melayu", locale: "ms-MY", direction: "ltr", family: "Austronesian", region: "Southeast Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "fil", label: "Filipino", nativeName: "Filipino", locale: "fil-PH", direction: "ltr", family: "Austronesian", region: "Southeast Asia", fallback: "en", translationStatus: "fallback-only" },
  { code: "sw", label: "Swahili", nativeName: "Kiswahili", locale: "sw-KE", direction: "ltr", family: "Bantu", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "am", label: "Amharic", nativeName: "አማርኛ", locale: "am-ET", direction: "ltr", family: "Semitic", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "yo", label: "Yoruba", nativeName: "Yorùbá", locale: "yo-NG", direction: "ltr", family: "Volta-Niger", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "ig", label: "Igbo", nativeName: "Igbo", locale: "ig-NG", direction: "ltr", family: "Volta-Niger", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "ha", label: "Hausa", nativeName: "Hausa", locale: "ha-NG", direction: "ltr", family: "Chadic", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "zu", label: "Zulu", nativeName: "isiZulu", locale: "zu-ZA", direction: "ltr", family: "Bantu", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "af", label: "Afrikaans", nativeName: "Afrikaans", locale: "af-ZA", direction: "ltr", family: "Germanic", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
  { code: "so", label: "Somali", nativeName: "Soomaaliga", locale: "so-SO", direction: "ltr", family: "Cushitic", region: "Africa", fallback: "en", translationStatus: "fallback-only" },
] as const;

export const GLOBAL_LANGUAGE_CODES = GLOBAL_LANGUAGE_REGISTRY.map(({ code }) => code);
export const RTL_LANGUAGE_CODES = GLOBAL_LANGUAGE_REGISTRY
  .filter((entry) => entry.direction === "rtl")
  .map(({ code }) => code);

export const CUSTOMER_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "ar",
  "zh",
  "ja",
  "ko",
  "hi",
].map((code) => {
  const match = GLOBAL_LANGUAGE_REGISTRY.find((entry) => entry.code === code)!;
  return { code: match.code, locale: match.locale, label: match.label, direction: match.direction };
});

export type CustomerLocaleCode = typeof CUSTOMER_LOCALES[number]["code"];
export const DEFAULT_CUSTOMER_LOCALE: CustomerLocaleCode = "en";
export const CUSTOMER_LOCALE_CODES = CUSTOMER_LOCALES.map(({ code }) => code) as CustomerLocaleCode[];

export function isRtlLanguage(value: string | null | undefined): boolean {
  return RTL_LANGUAGE_CODES.includes((value ?? "").trim().toLowerCase());
}

const COUNTRY_CODES = [
  "AF","AX","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ",
  "BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR",
  "IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL","CN","CX","CC",
  "CO","KM","CG","CD","CK","CR","CI","HR","CU","CW","CY","CZ","DK","DJ","DM","DO",
  "EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF",
  "GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY",
  "HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM",
  "JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY",
  "LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX",
  "FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI",
  "NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH",
  "PN","PL","PT","PR","QA","RE","RO","RU","RW","BL","SH","KN","LC","MF","PM","VC",
  "WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS",
  "SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK",
  "TO","TT","TN","TR","TM","TC","TV","UG","UA","AE","GB","US","UM","UY","UZ","VU",
  "VE","VN","VG","VI","WF","EH","YE","ZM","ZW","XK",
] as const;

export type CountryCode = typeof COUNTRY_CODES[number];
export const CUSTOMER_COUNTRY_CODES = COUNTRY_CODES as readonly string[];

const COUNTRY_LOCALE_OVERRIDES: Partial<Record<CountryCode, CustomerLocaleCode>> = {
  ES: "es", MX: "es", AR: "es", BO: "es", CL: "es", CO: "es", CR: "es", CU: "es",
  DO: "es", EC: "es", SV: "es", GT: "es", HN: "es", NI: "es", PA: "es", PY: "es",
  PE: "es", PR: "es", UY: "es", VE: "es",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", CV: "pt", GW: "pt", ST: "pt", TL: "pt",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr", CA: "fr", HT: "fr",
  DE: "de", AT: "de", CH: "de", LI: "de",
  IT: "it",
  CN: "zh", TW: "zh", HK: "zh", MO: "zh",
  JP: "ja",
  KR: "ko",
  IN: "hi",
  SA: "ar", AE: "ar", QA: "ar", KW: "ar", BH: "ar", OM: "ar", JO: "ar", LB: "ar",
  IQ: "ar", EG: "ar", MA: "ar", DZ: "ar", TN: "ar", LY: "ar", YE: "ar", SY: "ar",
};

const ENGLISH_COUNTRIES = new Set([
  "US", "GB", "IE", "AU", "NZ", "CA", "IN", "SG", "PH", "MY", "NG", "GH", "KE", "ZA",
]);

export function isCustomerLocale(value: string | null | undefined): value is CustomerLocaleCode {
  return CUSTOMER_LOCALE_CODES.includes(value as CustomerLocaleCode);
}

export function isCountryCode(value: string | null | undefined): value is CountryCode {
  return CUSTOMER_COUNTRY_CODES.includes((value ?? "").toUpperCase());
}

export function normalizeCountryCode(value: string | null | undefined): CountryCode | null {
  const normalized = value?.trim().toUpperCase();
  return isCountryCode(normalized) ? normalized : null;
}

export function localeForCountry(country: string | null | undefined): CustomerLocaleCode {
  const code = normalizeCountryCode(country);
  if (!code) return DEFAULT_CUSTOMER_LOCALE;
  return COUNTRY_LOCALE_OVERRIDES[code] ?? (ENGLISH_COUNTRIES.has(code) ? "en" : DEFAULT_CUSTOMER_LOCALE);
}

export interface CustomerLocalizationConfig {
  enabled: boolean;
  defaultLocale: CustomerLocaleCode;
  supportedLocales: CustomerLocaleCode[];
  countryAutoDetect: boolean;
  allowCustomerOverride: boolean;
}

export const DEFAULT_CUSTOMER_LOCALIZATION: CustomerLocalizationConfig = {
  enabled: true,
  defaultLocale: DEFAULT_CUSTOMER_LOCALE,
  supportedLocales: [...CUSTOMER_LOCALE_CODES],
  countryAutoDetect: true,
  allowCustomerOverride: true,
};

export function normalizeCustomerLocalization(
  value: Partial<CustomerLocalizationConfig> | null | undefined,
): CustomerLocalizationConfig {
  const supported = Array.isArray(value?.supportedLocales)
    ? value!.supportedLocales.filter(isCustomerLocale)
    : DEFAULT_CUSTOMER_LOCALIZATION.supportedLocales;
  const supportedLocales = supported.length > 0 ? Array.from(new Set(supported)) : [...CUSTOMER_LOCALE_CODES];
  const requestedDefault = isCustomerLocale(value?.defaultLocale) ? value!.defaultLocale : DEFAULT_CUSTOMER_LOCALE;
  return {
    enabled: value?.enabled !== false,
    defaultLocale: supportedLocales.includes(requestedDefault) ? requestedDefault : supportedLocales[0]!,
    supportedLocales,
    countryAutoDetect: value?.countryAutoDetect !== false,
    allowCustomerOverride: value?.allowCustomerOverride !== false,
  };
}

export function resolveCustomerLocale(
  config: Partial<CustomerLocalizationConfig> | null | undefined,
  customerOverride: string | null | undefined,
  country: string | null | undefined,
): CustomerLocaleCode {
  const normalized = normalizeCustomerLocalization(config);
  if (!normalized.enabled) return normalized.defaultLocale;
  if (normalized.allowCustomerOverride && isCustomerLocale(customerOverride) && normalized.supportedLocales.includes(customerOverride)) {
    return customerOverride;
  }
  if (normalized.countryAutoDetect) {
    const detected = localeForCountry(country);
    if (normalized.supportedLocales.includes(detected)) return detected;
  }
  return normalized.defaultLocale;
}