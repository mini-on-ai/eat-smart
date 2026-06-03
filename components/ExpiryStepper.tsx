import { Platform, Pressable, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Minus } from "lucide-react-native";

import { daysUntilExpiry, expiryLabel, expiryLevel } from "@/lib/expiry";

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#C8553D",
  soon:   "#D9A441",
  fresh:  "#3F8F5C",
};
const URGENCY_TINTS: Record<string, string> = {
  urgent: "#FBE9E5",
  soon:   "#FAEFD8",
  fresh:  "#E8F2EB",
};

const QUICK_OFFSETS: { label: string; days: number }[] = [
  { label: "+1j",    days: 1 },
  { label: "+7j",    days: 7 },
  { label: "+1mois", days: 30 },
];

/**
 * Single-row expiry control used on the confirm-receipt screen and the
 * pantry-item detail page. Tap a chip → adjust THIS item. Long-press → optional
 * bulk callback (applied to every relevant item by the parent).
 */
export function ExpiryStepper({
  expiresOn,
  onAdjust,
  onAdjustAll,
}: {
  expiresOn: string;
  onAdjust: (days: number) => void;
  /** Optional. When provided, long-press a chip → applies the offset to all items. */
  onAdjustAll?: (days: number) => void;
}) {
  const days = daysUntilExpiry(expiresOn);
  const level = expiryLevel(days);
  const urgencyColor = URGENCY_COLORS[level];
  const urgencyTint = URGENCY_TINTS[level];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: urgencyTint,
        borderRadius: 10,
        paddingLeft: 12,
        paddingRight: 6,
        paddingVertical: 6,
      }}
    >
      <View className="flex-row items-center gap-2">
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: urgencyColor }}
        />
        <Text style={{ color: urgencyColor, fontSize: 13, fontWeight: "600" }}>
          {expiryLabel(days)}
        </Text>
      </View>

      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={() => onAdjust(-1)}
          hitSlop={6}
          style={{
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: "rgba(255,255,255,0.7)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Minus size={14} color={urgencyColor} strokeWidth={2} />
        </Pressable>
        {QUICK_OFFSETS.map((q) => (
          <Pressable
            key={q.days}
            onPress={() => onAdjust(q.days)}
            onLongPress={
              onAdjustAll
                ? () => {
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    onAdjustAll(q.days);
                  }
                : undefined
            }
            hitSlop={4}
            style={{
              height: 28, paddingHorizontal: 10, borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.7)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: urgencyColor,
                fontSize: 12,
                fontWeight: "600",
                letterSpacing: -0.2,
              }}
            >
              {q.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
