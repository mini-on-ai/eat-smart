import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { vars, useColorScheme } from "nativewind";

import { AuthProvider } from "@/lib/auth";
import { queryClient, queryPersister } from "@/lib/query";
import { supabase } from "@/lib/supabase";

import "../global.css";

// CSS variable values injected at the root so every descendant component that
// references var(--color-*) tokens in its Tailwind classes resolves the right
// colour for the current scheme.  Web uses global.css media queries instead.
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

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const themeVars = isDark ? DARK_VARS : LIGHT_VARS;
  const bgColor  = isDark ? "#111110" : "#FAFAF7";

  return (
    <GestureHandlerRootView style={[{ flex: 1 }, themeVars]}>
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
