import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { vars } from "nativewind";

import { AuthProvider } from "@/lib/auth";
import { queryClient, queryPersister } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { ThemeProvider, useTheme } from "@/lib/themeContext";

import "../global.css";

// CSS variable values injected at the root on NATIVE so every descendant
// that references var(--color-*) tokens resolves the right colour for the
// current scheme.  On web, global.css + the .dark class handle this instead
// (inline style would have higher specificity and block the class from working).
const LIGHT_VARS = vars({
  "--color-bg":          "#FAFAF7",
  "--color-card":        "#FFFFFF",
  "--color-muted":       "#F1F1EC",
  "--color-border":      "#E6E5DF",
  "--color-border-soft": "#EFEEE9",
  "--color-ink":         "#1A1A17",
  "--color-ink-soft":    "#5B5B53",
  "--color-ink-faint":   "#9A9A91",
});
const DARK_VARS = vars({
  "--color-bg":          "#111110",
  "--color-card":        "#1C1C19",
  "--color-muted":       "#252522",
  "--color-border":      "#373735",
  "--color-border-soft": "#2D2D2A",
  "--color-ink":         "#F0F0EC",
  "--color-ink-soft":    "#9A9A91",
  "--color-ink-faint":   "#5A5A52",
});

function DeepLinkHandler() {
  const url = Linking.useURL();

  useEffect(() => {
    if (!url) return;
    // Magic link arrives as: eatsmart://?token_hash=...&type=magiclink
    const { queryParams } = Linking.parse(url);
    const token_hash = queryParams?.token_hash as string | undefined;
    const type = queryParams?.type as string | undefined;
    if (token_hash && type) {
      supabase.auth.verifyOtp({ token_hash, type: type as any });
    }
  }, [url]);

  return null;
}

function AppShell() {
  const { isDark } = useTheme();
  // On native: inject CSS variable values via inline style so var(--color-*)
  // tokens in Tailwind classes resolve correctly.  On web, we skip this because
  // the inline style would win over the .dark CSS class in global.css.
  const nativeThemeVars = Platform.OS !== "web" ? (isDark ? DARK_VARS : LIGHT_VARS) : {};
  const bgColor = isDark ? "#111110" : "#FAFAF7";

  return (
    <GestureHandlerRootView style={[{ flex: 1 }, nativeThemeVars]}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, buster: "v2" }}
      >
        <AuthProvider>
          <DeepLinkHandler />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bgColor } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </AuthProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
