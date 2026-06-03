import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth";
import { usePushToken } from "@/lib/hooks/usePushToken";

function PushTokenRegistrar() {
  usePushToken();
  return null;
}

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return (
    <>
      <PushTokenRegistrar />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
