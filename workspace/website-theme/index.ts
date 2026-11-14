export const WEBSITE_THEME_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "card",
  "header",
  "footer",
  "button",
  "buttonHover",
  "text",
  "mutedText",
  "border",
  "link",
  "success",
  "warning",
  "danger",
] as const;

export type WebsiteThemeKey = typeof WEBSITE_THEME_KEYS[number];
export type WebsiteThemeMode = "dark" | "light";
export type WebsiteTheme = Record<WebsiteThemeKey, string> & {
  mode: WebsiteThemeMode;
};

export const DEFAULT_WEBSITE_THEME: WebsiteTheme = {
  mode: "dark",
  primary: "#2563eb",
  secondary: "#1e4080",
  accent: "#1a3a6e",
  background: "#0a1628",
  card: "#0d1f3c",
  header: "#0d1f3c",
  footer: "#081222",
  button: "#2563eb",
  buttonHover: "#3b82f6",
  text: "#ffffff",
  mutedText: "#a3aec2",
  border: "#23406d",
  link: "#60a5fa",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
};

export const LIGHT_WEBSITE_SURFACES = {
  background: "#f8fafc",
  card: "#ffffff",
  header: "#ffffff",
  footer: "#e2e8f0",
  text: "#0f172a",
  mutedText: "#475569",
  border: "#cbd5e1",
} as const;

export const WEBSITE_THEME_SURFACE_SOFT = {
  light: "#f1f5f9",
  dark: "#172b45",
} as const;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

export function normalizeWebsiteThemeMode(
  value: unknown,
  fallback: WebsiteThemeMode = "dark",
): WebsiteThemeMode {
  if (value === "light" || value === "white") return "light";
  if (value === "dark" || value === "black") return "dark";
  return fallback;
}

export function resolveWebsiteTheme(
  value?: Partial<WebsiteTheme> | null,
  requestedMode?: unknown,
): WebsiteTheme {
  const merged = { ...DEFAULT_WEBSITE_THEME, ...value } as WebsiteTheme;
  const mode = normalizeWebsiteThemeMode(
    requestedMode ?? value?.mode,
    DEFAULT_WEBSITE_THEME.mode,
  );

  if (mode === "dark") return { ...merged, mode };
  return { ...merged, ...LIGHT_WEBSITE_SURFACES, mode };
}

export function hexToHsl(hex: string): string {
  if (!isHexColor(hex)) return "0 0% 0%";
  const value = hex.slice(1);
  const red = parseInt(value.slice(0, 2), 16) / 255;
  const green = parseInt(value.slice(2, 4), 16) / 255;
  const blue = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6;
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function relativeLuminance(hex: string): number {
  const value = hex.slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function readableForeground(background: string): "#0f172a" | "#ffffff" {
  if (!isHexColor(background)) return "#ffffff";
  const luminance = relativeLuminance(background);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return darkContrast >= whiteContrast ? "#0f172a" : "#ffffff";
}