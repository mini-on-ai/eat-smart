import { Tabs } from "expo-router";
import { Home, BarChart3, ShoppingBasket } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Pad the tab bar so buttons clear the home-indicator (iPhone) or gesture
  // navigation bar (Android).  Without a fixed height, React Navigation sizes
  // the bar naturally from icon + label + padding.
  const bottomPad = insets.bottom > 0 ? insets.bottom + 6 : 10;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   isDark ? "#F0F0EC" : "#1A1A17",
        tabBarInactiveTintColor: isDark ? "#5A5A52" : "#9A9A91",
        tabBarStyle: {
          backgroundColor: isDark ? "#1C1C19" : "#FAFAF7",
          borderTopColor:  isDark ? "#373735" : "#E6E5DF",
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", letterSpacing: -0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Garde-manger",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Statistiques",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 size={size} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping-list"
        options={{
          title: "Liste de courses",
          tabBarIcon: ({ color, size }) => (
            <ShoppingBasket size={size} color={color} strokeWidth={1.75} />
          ),
        }}
      />
    </Tabs>
  );
}
