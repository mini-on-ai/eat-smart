import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Check } from "lucide-react-native";
import { ItemGlyph } from "@/components/ItemGlyph";
import { daysUntilExpiry, expiryLabel, expiryLevel } from "@/lib/expiry";
import type { PantryItem } from "@/lib/types";

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#C8553D",
  soon:   "#D9A441",
  fresh:  "#3F8F5C",
};

function RightActions({ onConsume, onDelete, id }: {
  onConsume: (id: string) => void;
  onDelete: (id: string) => void;
  id: string;
}) {
  return (
    <View className="flex-row my-1 gap-2 pr-4">
      <Pressable
        onPress={() => onConsume(id)}
        className="bg-brand-soft rounded-2xl px-5 items-center justify-center active:opacity-75"
        style={{ minWidth: 96 }}
      >
        <Text className="text-brand-deep text-sm font-semibold">Consommé</Text>
      </Pressable>
      <Pressable
        onPress={() => onDelete(id)}
        className="rounded-2xl px-5 items-center justify-center active:opacity-75"
        style={{ backgroundColor: "#FBE9E5", minWidth: 88 }}
      >
        <Text style={{ color: "#C8553D" }} className="text-sm font-semibold">Supprimer</Text>
      </Pressable>
    </View>
  );
}

export function PantryItemRow({
  item,
  onConsume,
  onDelete,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
  onSelectToggle,
}: {
  item: PantryItem;
  onConsume: (id: string) => void;
  onDelete: (id: string) => void;
  onPress?: (id: string) => void;
  onLongPress?: (id: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectToggle?: (id: string) => void;
}) {
  const days = daysUntilExpiry(item.expires_on);
  const level = expiryLevel(days);
  const urgencyColor = URGENCY_COLORS[level];
  const qty = item.unit
    ? `${item.quantity} ${item.unit}`
    : item.quantity > 1
    ? `×${item.quantity}`
    : null;

  const inner = (
    <Pressable
      onPress={() => {
        if (selectionMode) onSelectToggle?.(item.id);
        else onPress?.(item.id);
      }}
      onLongPress={() => onLongPress?.(item.id)}
      delayLongPress={250}
      className="bg-card mx-4 my-1 rounded-2xl border border-border overflow-hidden active:opacity-80"
      style={{ position: "relative", elevation: 1 }}
    >
      {/* 3px urgency bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 3,
          backgroundColor: urgencyColor,
        }}
      />

      <View className="flex-row items-center px-4 py-3.5 gap-3" style={{ paddingLeft: 20 }}>
        {selectionMode ? (
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 8,
              flexShrink: 0,
              backgroundColor: selected ? "#3F8F5C" : "transparent",
              borderWidth: selected ? 0 : 1.5,
              borderColor: "#E6E5DF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selected && <Check size={16} color="#fff" strokeWidth={2.5} />}
          </View>
        ) : (
          <ItemGlyph categoryName={item.item_categories?.name} size={40} />
        )}

        <View className="flex-1 gap-0.5">
          <Text className="text-[15px] font-medium text-ink leading-snug" numberOfLines={1}>
            {item.name}
          </Text>
          {qty ? (
            <Text className="text-xs text-ink-faint">{qty}</Text>
          ) : null}
        </View>

        <Text style={{ color: urgencyColor }} className="text-[13px] font-semibold">
          {expiryLabel(days)}
        </Text>
      </View>
    </Pressable>
  );

  // In selection mode, disable swipe so taps go to the checkbox.
  if (selectionMode) return inner;

  return (
    <Swipeable
      renderRightActions={() => (
        <RightActions onConsume={onConsume} onDelete={onDelete} id={item.id} />
      )}
      overshootRight={false}
      friction={2}
    >
      {inner}
    </Swipeable>
  );
}
