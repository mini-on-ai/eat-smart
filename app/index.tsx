import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#3F8F5C" />
      </View>
    );
  }

  return <Redirect href={session ? "/(app)" : "/(auth)/sign-in"} />;
}
