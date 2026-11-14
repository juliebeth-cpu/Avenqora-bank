// ── Shared dynamic theme engine ────────────────────────────────────────────────
// Every portal and customer layout derives its color palette from a single hex
// primaryColor value that is stored per-website in the database.  This module
// is the single source of truth for the conversion logic so all layouts stay
// visually consistent.

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.substring(0, 2), 16),
    parseInt(full.substring(2, 4), 16),
    parseInt(full.substring(4, 6), 16),
  ];
}

export interface DashboardTheme {
  sidebarBg: string;
  headerBg: string;
  accent: string;
  accentRgb: string;
  accentBorder: string;
  accentLight: string;
  accentMid: string;
  accentText: string;
}

export function makeTheme(primary: string): DashboardTheme {
  const [r, g, b] = hexToRgb(primary);
  // Sidebar bg: 14% primary tinted into very-dark base rgb(6,13,26)
  const sidebarR = Math.round(r * 0.14 + 6 * 0.86);
  const sidebarG = Math.round(g * 0.14 + 13 * 0.86);
  const sidebarB = Math.round(b * 0.14 + 26 * 0.86);
  // Header bg: 8% primary tinted
  const headerR = Math.round(r * 0.08 + 6 * 0.92);
  const headerG = Math.round(g * 0.08 + 13 * 0.92);
  const headerB = Math.round(b * 0.08 + 26 * 0.92);
  return {
    sidebarBg: `rgb(${sidebarR},${sidebarG},${sidebarB})`,
    headerBg: `rgb(${headerR},${headerG},${headerB})`,
    accent: primary,
    accentRgb: `${r},${g},${b}`,
    accentBorder: `rgba(${r},${g},${b},0.18)`,
    accentLight: `rgba(${r},${g},${b},0.15)`,
    accentMid: `rgba(${r},${g},${b},0.25)`,
    accentText: primary,
  };
}
