import {
  getLocalStorageItem,
  setLocalStorageItem,
} from "@/lib/utils/localStorage";
import { createContext, use, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

const ThemeContext = createContext<ThemeProviderState>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "advanced-react-theme",
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    getLocalStorageItem(storageKey) ?? defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      setLocalStorageItem(storageKey, systemTheme);
      return;
    }

    root.classList.add(theme);
    setLocalStorageItem(storageKey, theme);
  }, [theme]);

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}

export const useTheme = () => {
  const context = use(ThemeContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
