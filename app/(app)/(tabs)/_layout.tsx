import { Tabs } from "expo-router";
import { Home, BarChart3, ShoppingBasket } from "lucide-react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1A1A17",
        tabBarInactiveTintColor: "#9A9A91",
        tabBarStyle: {
          backgroundColor: "#FAFAF7",
          borderTopColor: "#E6E5DF",
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
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
