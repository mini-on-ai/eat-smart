import { Text, View } from "react-native";
import { daysUntilExpiry, expiryLabel, expiryLevel } from "@/lib/expiry";

const styles = {
  fresh:  { dot: "bg-brand",   text: "text-brand-deep",  label: "bg-brand-soft" },
  soon:   { dot: "bg-amber-400", text: "text-amber-700",   label: "bg-amber-50" },
  urgent: { dot: "bg-urgent",   text: "text-urgent",       label: "bg-red-50" },
};

export function ExpiryBadge({ expiresOn }: { expiresOn: string }) {
  const days = daysUntilExpiry(expiresOn);
  const level = expiryLevel(days);
  const s = styles[level];
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${s.label}`}>
      <View className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <Text className={`text-xs font-semibold ${s.text}`}>{expiryLabel(days)}</Text>
    </View>
  );
}
