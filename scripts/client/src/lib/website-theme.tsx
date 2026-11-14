import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { publicInfo } from "@/lib/portal-api";
import {
  DEFAULT_WEBSITE_THEME,
  WEBSITE_THEME_KEYS,
  WEBSITE_THEME_SURFACE_SOFT,
  hexToHsl,
  normalizeWebsiteThemeMode,
  readableForeground,
  resolveWebsiteTheme,
  type WebsiteTheme,
  type WebsiteThemeKey,
  type WebsiteThemeMode,
} from "@/workspace/website-theme";

export {
  DEFAULT_WEBSITE_THEME,
  WEBSITE_THEME_KEYS,
  type WebsiteTheme,
  type WebsiteThemeKey,
  type WebsiteThemeMode,
};

interface WebsiteThemeContextValue {
  mode: WebsiteThemeMode;
  setMode: (mode: WebsiteThemeMode) => void;
}
const WebsiteThemeContext = createContext<WebsiteThemeContextValue>({
  mode: "dark",
  setMode: () => undefined,
});
export const useWebsiteTheme = () => useContext(WebsiteThemeContext);

function themeStorageKey(websiteUid: string) {
  return `danzy-website-theme:${websiteUid}`;
}

export function applyWebsiteTheme(
  theme: WebsiteTheme,
  mode: WebsiteThemeMode = "dark",
  surface: "customer" | "banking" = "customer",
) {
  const root = document.documentElement;
  const resolved = resolveWebsiteTheme(theme, mode);
  const tokenMap: Record<string, string> = {
    primary: "primary", secondary: "secondary", accent: "accent", background: "background",
    card: "card", text: "foreground", mutedText: "muted-foreground", border: "border",
    link: "link", success: "success", warning: "warning", danger: "destructive",
  };
  for (const key of WEBSITE_THEME_KEYS) {
    root.style.setProperty(`--theme-${key}`, resolved[key]);
    const token = tokenMap[key];
    if (token) root.style.setProperty(`--${token}`, hexToHsl(resolved[key]));
  }
  root.style.setProperty("--card-foreground", hexToHsl(resolved.text));
  root.style.setProperty("--primary-foreground", hexToHsl(readableForeground(resolved.primary)));
  root.style.setProperty("--secondary-foreground", hexToHsl(readableForeground(resolved.secondary)));
  root.style.setProperty("--accent-foreground", hexToHsl(readableForeground(resolved.accent)));
  root.style.setProperty("--muted", hexToHsl(WEBSITE_THEME_SURFACE_SOFT[mode]));
  root.style.setProperty("--input", hexToHsl(resolved.border));
  root.style.setProperty("--ring", hexToHsl(resolved.primary));
  root.style.setProperty("--theme-surface-soft", WEBSITE_THEME_SURFACE_SOFT[mode]);
  root.style.setProperty("--theme-surface-raised", mode === "light" ? "#ffffff" : "#1e3553");
  root.style.setProperty("--theme-input-background", mode === "light" ? "#ffffff" : "#091321");
  root.dataset.websiteTheme = mode;
  root.dataset.websiteThemeSurface = surface;
  root.classList.toggle("dark", mode === "dark");
}

function clearWebsiteTheme(adminSurface = false) {
  const root = document.documentElement;
  for (const key of WEBSITE_THEME_KEYS) root.style.removeProperty(`--theme-${key}`);
  [
    "primary", "secondary", "accent", "background", "foreground", "card", "link", "success",
    "warning", "destructive", "muted-foreground", "border", "card-foreground", "primary-foreground",
    "secondary-foreground", "accent-foreground", "muted", "input", "ring", "theme-surface-soft",
    "theme-surface-raised", "theme-input-background",
  ].forEach((key) => root.style.removeProperty(`--${key}`));
  root.classList.toggle("dark", adminSurface);
  delete root.dataset.websiteTheme;
  delete root.dataset.websiteThemeSurface;
}

function websiteUidFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/(?:site|portal|track|tracking|banking|app|invest|forex|crypto)\/([^/]+)/);
  return match?.[1] ?? null;
}

function isPublicSurface(pathname: string) {
  return /^\/(?:site|track|tracking|banking|app|invest|forex|crypto)\//.test(pathname);
}

function storedMode(value: string | null): WebsiteThemeMode | null {
  if (value === "dark" || value === "black" || value === "light" || value === "white") {
    return normalizeWebsiteThemeMode(value);
  }
  return null;
}

function initialMode(websiteUid: string | null, pathname: string): WebsiteThemeMode {
  if (typeof window === "undefined") return "dark";
  const saved = websiteUid ? localStorage.getItem(themeStorageKey(websiteUid)) : null;
  const persisted = storedMode(saved);
  if (persisted) return persisted;
  if (websiteUid && pathname.startsWith("/banking/")) {
    const legacy = localStorage.getItem("banking_dark_mode");
    if (legacy === "true") return "dark";
    if (legacy === "false") return "light";
  }
  return "dark";
}

export function WebsiteThemeProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const websiteUid = websiteUidFromPath(location);
  const [mode, setModeState] = useState<WebsiteThemeMode>(() =>
    initialMode(websiteUidFromPath(window.location.pathname), window.location.pathname),
  );
  const { data: site } = useQuery({
    queryKey: ["website-theme", websiteUid],
    queryFn: () => publicInfo(websiteUid!),
    enabled: !!websiteUid && isPublicSurface(location),
    retry: false,
  });

  useEffect(() => {
    if (!isPublicSurface(location)) {
      clearWebsiteTheme(location.startsWith("/portal/"));
      return;
    }
    if (!websiteUid || !site) { clearWebsiteTheme(); return; }
    const baseTheme = {
      ...DEFAULT_WEBSITE_THEME,
      ...((site as any)?.theme ?? {}),
      primary: (site as any)?.primaryColor || (site as any)?.theme?.primary || DEFAULT_WEBSITE_THEME.primary,
    };
    const surface = (site as any)?.type === "banking" && location.startsWith("/banking/")
      ? "banking"
      : "customer";
    applyWebsiteTheme(baseTheme, mode, surface);
  }, [websiteUid, mode, location, (site as any)?.theme, (site as any)?.type]);

  useEffect(() => {
    if (!websiteUid || !isPublicSurface(location)) return;
    const key = themeStorageKey(websiteUid);
    const savedMode = localStorage.getItem(key);
    const persisted = storedMode(savedMode);
    if (persisted) {
      if (savedMode !== persisted) localStorage.setItem(key, persisted);
      setModeState(persisted);
      return;
    }
    if (location.startsWith("/banking/")) {
      const legacy = localStorage.getItem("banking_dark_mode");
      if (legacy === "true" || legacy === "false") {
        const next = legacy === "true" ? "dark" : "light";
        localStorage.setItem(themeStorageKey(websiteUid), next);
        setModeState(next);
        return;
      }
    }
    setModeState(normalizeWebsiteThemeMode((site as any)?.theme?.mode));
  }, [websiteUid, location, (site as any)?.theme?.mode]);

  const showSwitcher = isPublicSurface(location) && !!websiteUid;
  const setMode = (next: WebsiteThemeMode) => {
    setModeState(next);
    if (websiteUid && isPublicSurface(location)) localStorage.setItem(themeStorageKey(websiteUid), next);
  };
  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
  };

  return <WebsiteThemeContext.Provider value={{ mode, setMode }}>
    {showSwitcher && (
      <button
        type="button"
        onClick={toggleMode}
        className="website-theme-switcher"
        aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}
        title={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}
      >
        {mode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span>{mode === "dark" ? "Light" : "Dark"}</span>
      </button>
    )}
    {children}
  </WebsiteThemeContext.Provider>;
}
