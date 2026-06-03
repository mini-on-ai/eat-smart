import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, RotateCcw } from "lucide-react-native";

import { ItemGlyph } from "@/components/ItemGlyph";
import { useRecentItems, useRestoreItem } from "@/lib/hooks/usePantryItems";
import { useThemeColors } from "@/lib/theme";
import type { PantryItem } from "@/lib/types";

function StatusBadge({ status }: { status: PantryItem["status"] }) {
  const isConsumed = status === "consumed";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 99,
        backgroundColor: isConsumed ? "#E8F2EB" : "#FBE9E5",
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "600", color: isConsumed ? "#2C6B43" : "#C8553D" }}>
        {isConsumed ? "Consommé" : "Supprimé"}
      </Text>
    </View>
  );
}

export default function RecentItems() {
  const router = useRouter();
  const colors = useThemeColors();
  const { data: items, isLoading } = useRecentItems();
  const { mutate: restore, isPending } = useRestoreItem();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-3 gap-2">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
        >
          <ChevronLeft size={24} color={colors.ink} strokeWidth={1.75} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-xl font-semibold text-ink" style={{ letterSpacing: -0.4 }}>
            Articles récents
          </Text>
          <Text className="text-[12px] text-ink-faint mt-0.5">
            Consommés ou supprimés — restaurables
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3F8F5C" />
        </View>
      ) : !items?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">📭</Text>
          <Text className="text-base font-semibold text-ink text-center">
            Rien à restaurer
          </Text>
          <Text className="text-sm text-ink-faint text-center mt-1">
            Les articles consommés ou supprimés apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
          renderItem={({ item, index }) => (
            <View
              className="bg-card border border-borderSoft flex-row items-center px-4 py-3 gap-3"
              style={{
                borderBottomWidth: index === items.length - 1 ? 1 : 0,
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderTopLeftRadius: index === 0 ? 16 : 0,
                borderTopRightRadius: index === 0 ? 16 : 0,
                borderBottomLeftRadius: index === items.length - 1 ? 16 : 0,
                borderBottomRightRadius: index === items.length - 1 ? 16 : 0,
              }}
            >
              <ItemGlyph categoryName={item.item_categories?.name} size={36} />

              <View className="flex-1 gap-1 min-w-0">
                <Text className="text-[15px] font-medium text-ink" numberOfLines={1}>
                  {item.name}
                </Text>
                <StatusBadge status={item.status} />
              </View>

              <Pressable
                onPress={() => restore(item.id)}
                disabled={isPending}
                className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl active:opacity-60"
                style={{ backgroundColor: colors.muted }}
              >
                <RotateCcw size={13} color={colors.ink} strokeWidth={2} />
                <Text className="text-[12px] font-semibold" style={{ color: colors.ink }}>
                  Restaurer
                </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
