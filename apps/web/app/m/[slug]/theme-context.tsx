"use client";

import { createContext, useContext } from "react";
import type { ThemeConfig } from "@/lib/themes";

const ThemeContext = createContext<ThemeConfig | null>(null);

export function ThemeProvider({
  theme,
  children,
}: {
  theme: ThemeConfig;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeConfig {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
}
