/**
 * Cross-platform theme context — manages dark/light mode with a plain
 * React useState so re-renders are guaranteed on every platform including
 * React Native Web, where NativeWind's setColorScheme() / Appearance API
 * is a silent no-op.
 *
 * On web: also toggles the `.dark` / `.light` class on <html> so
 * global.css CSS-variable rules apply correctly.
 * On native: consumers should pass isDark → vars() in the root layout
 * to inject CSS variables into the NativeWind subtree.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform } from "react-native";

const SCHEME_KEY = "@eat-smart/color-scheme";

type ThemeCtx = {
  isDark: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeCtx>({ isDark: false, toggle: () => {} });

/** Sync the `.dark` / `.light` class on <html> so global.css vars update. */
function applyWebClass(isDark: boolean) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.classList.toggle("light", !isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Seed from system preference so first render matches the OS theme.
  const systemDark = Appearance.getColorScheme() === "dark";
  const [isDark, setIsDark] = useState(systemDark);

  // Override with stored preference on mount, then apply the matching DOM class.
  useEffect(() => {
    AsyncStorage.getItem(SCHEME_KEY).then((stored) => {
      if (stored === "dark" || stored === "light") {
        const persisted = stored === "dark";
        setIsDark(persisted);
        applyWebClass(persisted);
      } else {
        // No stored preference — just make sure the DOM class matches the OS default.
        applyWebClass(systemDark);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      applyWebClass(next);
      AsyncStorage.setItem(SCHEME_KEY, next ? "dark" : "light").catch(() => {});
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext);
}
