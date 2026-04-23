/**
 * ThemeContext — Gestion du thème et du branding (White Label)
 * Fournit : theme, setTheme, branding, updateBranding
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Theme = "light" | "dark" | "system";

export interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  companyName: string;
  favicon: string;
  fontFamily: string;
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  branding: BrandingConfig;
  updateBranding: (branding: Partial<BrandingConfig>) => void;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultBranding: BrandingConfig = {
  primaryColor: "#2563eb",
  secondaryColor: "#64748b",
  logoUrl: "",
  companyName: "SERVICALL",
  favicon: "/favicon.ico",
  fontFamily: "Inter, sans-serif",
};

// ─── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "servicall-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [branding, setBranding] = useState<BrandingConfig>(() => {
    try {
      const stored = localStorage.getItem("servicall-branding");
      return stored ? { ...defaultBranding, ...JSON.parse(stored) } : defaultBranding;
    } catch {
      return defaultBranding;
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {
      // ignore storage errors
    }
    setThemeState(newTheme);
  };

  const updateBranding = (partial: Partial<BrandingConfig>) => {
    const updated = { ...branding, ...partial };
    try {
      localStorage.setItem("servicall-branding", JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
    setBranding(updated);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, branding, updateBranding }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export default ThemeContext;
