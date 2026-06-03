import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { AuthProvider } from "@/lib/auth";
import { queryClient, queryPersister } from "@/lib/query";
import { supabase } from "@/lib/supabase";

import "../global.css";

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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, buster: "v2" }}
      >
        <AuthProvider>
          <DeepLinkHandler />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FAFAF7" } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <StatusBar style="dark" />
        </AuthProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
