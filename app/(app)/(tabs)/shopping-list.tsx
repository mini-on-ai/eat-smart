import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Check, Share2, UserPlus, X } from "lucide-react-native";

import { useCategories } from "@/lib/hooks/useCategories";
import { useConsumedHistory } from "@/lib/hooks/useConsumedHistory";
import { usePantryItems } from "@/lib/hooks/usePantryItems";
import {
  useManualShoppingItems,
  useRemoveShoppingItem,
  useToggleShoppingItem,
} from "@/lib/hooks/useShoppingList";
import { computeShoppingSuggestions, type ShoppingSuggestion } from "@/lib/stats";

type UnifiedItem = {
  key: string;            // unique key for React lists
  normalizedName: string; // also used as the auto-check key
  displayName: string;
  categoryId: number | null;
  source: "auto" | "manual";
  manualId?: string;
  manualChecked?: boolean;
  // auto-only metadata
  daysOverdue?: number;
  avgIntervalDays?: number;
  purchaseCount?: number;
};

export default function ShoppingListScreen() {
  const { data: history, isLoading: hLoading } = useConsumedHistory();
  const { data: active } = usePantryItems();
  const { data: categories } = useCategories();
  const { data: manualItems } = useManualShoppingItems();
  const { mutate: toggleManual } = useToggleShoppingItem();
  const { mutate: removeManual } = useRemoveShoppingItem();

  // Client-side check state for AUTO suggestions (manual items persist `checked`).
  const [autoChecked, setAutoChecked] = useState<Set<string>>(new Set());

  const activeNorms = useMemo(() => {
    const s = new Set<string>();
    for (const i of active ?? []) {
      if (i.name) s.add(i.name.toLowerCase().trim());
    }
    return s;
  }, [active]);

  const autoSuggestions: ShoppingSuggestion[] = useMemo(
    () => computeShoppingSuggestions(history ?? [], activeNorms),
    [history, activeNorms],
  );

  /** Combined list: manual entries first (most fresh + persistent), then auto fillers,
   *  deduped by normalized_name (a manual override wins if both exist). */
  const unified: UnifiedItem[] = useMemo(() => {
    const seen = new Set<string>();
    const out: UnifiedItem[] = [];
    for (const m of manualItems ?? []) {
      seen.add(m.normalized_name);
      out.push({
        key: `m-${m.id}`,
        normalizedName: m.normalized_name,
        displayName: m.display_name,
        categoryId: m.category_id,
        source: "manual",
        manualId: m.id,
        manualChecked: m.checked,
      });
    }
    for (const a of autoSuggestions) {
      if (seen.has(a.normalizedName)) continue;
      out.push({
        key: `a-${a.normalizedName}`,
        normalizedName: a.normalizedName,
        displayName: a.displayName,
        categoryId: a.categoryId,
        source: "auto",
        daysOverdue: a.daysOverdue,
        avgIntervalDays: a.avgIntervalDays,
        purchaseCount: a.purchaseCount,
      });
    }
    return out;
  }, [manualItems, autoSuggestions]);

  const grouped = useMemo(() => {
    const byCat = new Map<string, UnifiedItem[]>();
    const catNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));
    for (const s of unified) {
      const cat = s.categoryId != null ? (catNameById.get(s.categoryId) ?? "Autre") : "Autre";
      const arr = byCat.get(cat) ?? [];
      arr.push(s);
      byCat.set(cat, arr);
    }
    return [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [unified, categories]);

  function toggle(item: UnifiedItem) {
    if (item.source === "manual" && item.manualId) {
      toggleManual({ id: item.manualId, checked: !item.manualChecked });
    } else {
      setAutoChecked((prev) => {
        const next = new Set(prev);
        if (next.has(item.normalizedName)) next.delete(item.normalizedName);
        else next.add(item.normalizedName);
        return next;
      });
    }
  }

  function isChecked(item: UnifiedItem): boolean {
    if (item.source === "manual") return !!item.manualChecked;
    return autoChecked.has(item.normalizedName);
  }

  async function share() {
    const lines: string[] = ["Liste de courses\n"];
    for (const [cat, items] of grouped) {
      lines.push(`# ${cat}`);
      for (const s of items) lines.push(`- ${s.displayName}`);
      lines.push("");
    }
    const text = lines.join("\n");
    if (Platform.OS === "web") {
      if (navigator?.share) await navigator.share({ text });
      else await navigator.clipboard?.writeText(text);
    } else {
      await Share.share({ message: text });
    }
  }

  if (hLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center" edges={["top"]}>
        <ActivityIndicator color="#3F8F5C" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-end justify-between">
        <View>
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
            À racheter
          </Text>
          <Text className="text-2xl font-semibold text-ink mt-0.5" style={{ letterSpacing: -0.5 }}>
            Liste de courses
          </Text>
          <Text className="text-[12px] text-ink-faint mt-1">
            Suggestions automatiques + ajouts manuels
          </Text>
        </View>
        {unified.length > 0 && (
          <Pressable
            onPress={share}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: "#1A1A17" }}
          >
            <Share2 size={18} color="#FAFAF7" strokeWidth={1.75} />
          </Pressable>
        )}
      </View>

      {unified.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">🧺</Text>
          <Text className="text-base text-ink text-center font-semibold">
            Rien à racheter pour l'instant
          </Text>
          <Text className="text-sm text-ink-faint text-center mt-2">
            Ajoute des articles depuis leur page de détail, ou attends qu'on apprenne tes habitudes.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 }}
        >
          {grouped.map(([cat, items]) => (
            <View key={cat} className="mb-5">
              <Text className="text-[12px] font-semibold uppercase tracking-widest text-ink-faint px-2 mb-2">
                {cat} · {items.length}
              </Text>
              <View className="rounded-2xl bg-card border border-borderSoft p-1">
                {items.map((s, idx) => {
                  const checked = isChecked(s);
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => toggle(s)}
                      className="flex-row items-center px-3 py-3"
                      style={{
                        borderBottomWidth: idx === items.length - 1 ? 0 : 1,
                        borderBottomColor: "#F0EFEA",
                      }}
                    >
                      <View
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          flexShrink: 0,
                          backgroundColor: checked ? "#3F8F5C" : "transparent",
                          borderWidth: checked ? 0 : 1.5,
                          borderColor: "#E6E5DF",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {checked && <Check size={14} color="#fff" strokeWidth={2.5} />}
                      </View>
                      <View className="flex-1 min-w-0 ml-3">
                        <View className="flex-row items-center gap-1.5">
                          <Text
                            className="text-[14px] font-medium text-ink flex-1"
                            style={{
                              textDecorationLine: checked ? "line-through" : "none",
                              opacity: checked ? 0.5 : 1,
                            }}
                            numberOfLines={1}
                          >
                            {s.displayName}
                          </Text>
                          {s.source === "manual" && (
                            <UserPlus size={11} color="#9A9A91" strokeWidth={1.6} />
                          )}
                        </View>
                        <Text className="text-[11px] text-ink-faint mt-0.5">
                          {s.source === "manual"
                            ? "Ajouté manuellement"
                            : s.daysOverdue != null && s.daysOverdue >= 0
                              ? `+${s.daysOverdue}j de retard · tu achètes tous les ${s.avgIntervalDays}j`
                              : s.daysOverdue != null
                                ? `prévu dans ${-s.daysOverdue}j`
                                : ""}
                        </Text>
                      </View>
                      {s.source === "manual" ? (
                        <Pressable
                          onPress={() => removeManual(s.manualId!)}
                          hitSlop={6}
                          className="ml-2 w-7 h-7 rounded-full items-center justify-center"
                          style={{ backgroundColor: "#F4F1EA" }}
                        >
                          <X size={13} color="#9A9A91" strokeWidth={1.75} />
                        </Pressable>
                      ) : (
                        <View className="ml-2 px-2 py-1 rounded-md" style={{ backgroundColor: "#F4F1EA" }}>
                          <Text className="text-[10px] font-semibold text-ink-soft uppercase tracking-wider">
                            {s.purchaseCount}×
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
