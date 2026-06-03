import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, format, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { ChevronLeft, Check, Pencil, Minus } from "lucide-react-native";

import { useCategories } from "@/lib/hooks/useCategories";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ItemGlyph } from "@/components/ItemGlyph";
import { daysUntilExpiry, expiryLabel, expiryLevel } from "@/lib/expiry";
import type { ItemCategory } from "@/lib/types";

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#C8553D",
  soon: "#D9A441",
  fresh: "#3F8F5C",
};
const URGENCY_TINTS: Record<string, string> = {
  urgent: "#FBE9E5",
  soon: "#FAEFD8",
  fresh: "#E8F2EB",
};

type RawItem = {
  name: string;
  quantity: number;
  unit: string | null;
  category: string;
  suggested_expiry_days: number;
  price?: number | null;
};

// Mirror of normalizeName() in scripts/import-historical-receipts.mjs.
// Strips pack sizes ("125g", "1L", "x4") so the same product across receipts
// groups together in stats and the smart shopping list.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cl|pcs?|pc)\b/gi, "")
    .replace(/\bx\s*\d+/gi, "")
    .replace(/[^a-z0-9\sàâäéèêëïîôöùûüçœ-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type EditableItem = RawItem & {
  expires_on: string;
  key: string;
  included: boolean;
  category_id: number | null;
};

function matchCategory(
  categoryName: string,
  categories: ItemCategory[]
): ItemCategory | undefined {
  const lower = categoryName.toLowerCase();
  // 1. Exact lowercase match — the LLM is prompted to return one of the canonical names
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact;
  // 2. locale_aliases hit — handles minor variants from the LLM
  const aliasHit = categories.find((c) =>
    c.locale_aliases?.some((a) => a.toLowerCase() === lower)
  );
  if (aliasHit) return aliasHit;
  // 3. Substring fallback — last resort for noisy responses
  return categories.find(
    (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())
  );
}

export default function ConfirmReceipt() {
  const router = useRouter();
  const params = useLocalSearchParams<{ receipt_id: string }>();
  const { data: householdId } = useHousehold();
  const { session } = useAuth();
  const { data: categories } = useCategories();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);

  // Fetch the receipt row from Supabase — items are already persisted there.
  // Also pull purchased_at so we can stamp it on each inserted pantry row.
  const { data: receiptRow, isLoading: receiptLoading } = useQuery({
    queryKey: ["receipt", params.receipt_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipts")
        .select("raw_llm_response, purchased_at")
        .eq("id", params.receipt_id)
        .single();
      if (error) throw error;
      return data as {
        raw_llm_response: { items: RawItem[]; raw: string; purchased_at?: string | null };
        purchased_at: string | null;
      };
    },
    enabled: !!params.receipt_id,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!receiptRow || !categories) return;
    const raw: RawItem[] = receiptRow.raw_llm_response?.items ?? [];
    // Attach expires_on based on suggested_expiry_days (Edge Function doesn't persist this client-side field)
    setEditableItems(
      raw.map((item, idx) => {
        const matched = matchCategory(item.category, categories);
        return {
          ...item,
          expires_on: format(
            addDays(new Date(), item.suggested_expiry_days ?? 7),
            "yyyy-MM-dd"
          ),
          key: String(idx),
          included: true,
          category_id: matched?.id ?? null,
        };
      })
    );
  }, [receiptRow, categories]);

  const selectedCount = editableItems.filter((i) => i.included).length;
  const excludedCount = editableItems.filter((i) => !i.included).length;

  function toggleItem(key: string) {
    setEditableItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, included: !i.included } : i))
    );
  }

  function updateName(key: string, name: string) {
    setEditableItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, name } : i))
    );
  }

  function updateQuantity(key: string, value: string) {
    const qty = parseFloat(value.replace(",", "."));
    setEditableItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, quantity: Number.isFinite(qty) && qty > 0 ? qty : i.quantity } : i))
    );
  }

  function updateUnit(key: string, unit: string) {
    setEditableItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, unit: unit.trim() || null } : i))
    );
  }

  function adjustExpiry(key: string, days: number) {
    setEditableItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const current = parseISO(i.expires_on);
        const adjusted = addDays(current, days);
        return { ...i, expires_on: format(adjusted, "yyyy-MM-dd") };
      })
    );
  }

  function adjustExpiryAll(days: number) {
    setEditableItems((prev) =>
      prev.map((i) => {
        if (!i.included) return i;
        const adjusted = addDays(parseISO(i.expires_on), days);
        return { ...i, expires_on: format(adjusted, "yyyy-MM-dd") };
      })
    );
  }

  async function confirm() {
    if (!householdId || !session) return;
    const toInsert = editableItems.filter((i) => i.included);
    if (toInsert.length === 0) {
      Alert.alert("Aucun aliment sélectionné", "Sélectionnez au moins un aliment.");
      return;
    }

    setSaving(true);
    try {
      const purchasedAt = receiptRow?.purchased_at ?? format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("pantry_items").insert(
        toInsert.map((item) => ({
          household_id: householdId,
          name: item.name.trim(),
          category_id: item.category_id,
          quantity: item.quantity,
          unit: item.unit,
          expires_on: item.expires_on,
          status: "active",
          receipt_id: params.receipt_id ?? null,
          added_by: session.user.id,
          price: item.price ?? null,
          purchased_at: purchasedAt,
          normalized_name: normalizeName(item.name),
        }))
      );
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["pantry", householdId] });
      router.replace("/(app)");
    } catch (e: any) {
      Alert.alert("Erreur", e.message ?? "Impossible d'enregistrer les aliments.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* Header */}
      <View className="px-2 pt-2 flex-row items-center justify-between pr-5">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
        >
          <ChevronLeft size={24} color="#1A1A17" strokeWidth={1.75} />
        </Pressable>
        <Text className="text-[17px] font-semibold text-ink">Vérifier</Text>
        <View className="w-10" />
      </View>

      {/* Caption */}
      <View className="px-5 pb-3 pt-1 gap-1">
        {receiptLoading || !categories ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#9A9A91" />
            <Text className="text-[15px] text-ink-faint">Chargement…</Text>
          </View>
        ) : (
          <>
            <Text className="text-[15px] text-ink-soft">
              <Text className="text-ink font-semibold">{editableItems.length} articles</Text> détectés
              {excludedCount > 0 && (
                <Text> · {excludedCount} exclus</Text>
              )}
            </Text>
            <Text className="text-[11px] text-ink-faint">
              Appui long sur +1j / +7j / +1mois → applique à tous
            </Text>
          </>
        )}
      </View>

      <FlatList
        data={editableItems}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 4 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <ItemCard
            item={item}
            onToggle={() => toggleItem(item.key)}
            onNameChange={(name) => updateName(item.key, name)}
            onQuantityChange={(v) => updateQuantity(item.key, v)}
            onUnitChange={(u) => updateUnit(item.key, u)}
            onAdjustExpiry={(days) => adjustExpiry(item.key, days)}
            onAdjustAllExpiry={adjustExpiryAll}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-4xl mb-3">🧾</Text>
            <Text className="text-base text-ink-faint text-center">
              Aucun aliment détecté sur ce ticket.
            </Text>
          </View>
        }
      />

      {/* Bottom CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-bg border-t border-borderSoft px-5 pb-8 pt-4"
        style={{
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        }}
      >
        <Pressable
          onPress={confirm}
          disabled={saving || selectedCount === 0}
          className={`rounded-2xl py-4 items-center ${
            selectedCount === 0 ? "bg-border" : "bg-brand active:opacity-80"
          }`}
          style={selectedCount > 0 ? { elevation: 2 } : undefined}
        >
          <Text
            className={`text-base font-bold ${
              selectedCount === 0 ? "text-ink-faint" : "text-white"
            }`}
          >
            {saving
              ? "Enregistrement…"
              : selectedCount === 0
              ? "Sélectionnez des aliments"
              : `Ajouter ${selectedCount} article${selectedCount !== 1 ? "s" : ""} au garde-manger`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type ItemCardProps = {
  item: EditableItem;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onQuantityChange: (value: string) => void;
  onUnitChange: (unit: string) => void;
  onAdjustExpiry: (days: number) => void;
  onAdjustAllExpiry: (days: number) => void;
};

const QUICK_OFFSETS: { label: string; days: number }[] = [
  { label: "+1j",   days: 1 },
  { label: "+7j",   days: 7 },
  { label: "+1mois", days: 30 },
];

function ItemCard({ item, onToggle, onNameChange, onQuantityChange, onUnitChange, onAdjustExpiry, onAdjustAllExpiry }: ItemCardProps) {
  const [editing, setEditing] = useState(false);
  // Local drafts so the keyboard doesn't commit on every keystroke
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity ?? 1));
  const [unitDraft, setUnitDraft] = useState(item.unit ?? "");
  const days = daysUntilExpiry(item.expires_on);
  const level = expiryLevel(days);
  const urgencyColor = URGENCY_COLORS[level];
  const urgencyTint = URGENCY_TINTS[level];

  return (
    <View
      className="rounded-2xl border bg-card border-border"
      style={{
        padding: 12,
        gap: 10,
        opacity: item.included ? 1 : 0.45,
        elevation: item.included ? 1 : 0,
      }}
    >
      {/* Row 1: checkbox + glyph + name */}
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={onToggle}
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            flexShrink: 0,
            backgroundColor: item.included ? "#3F8F5C" : "transparent",
            borderWidth: item.included ? 0 : 1.5,
            borderColor: "#E6E5DF",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.included && <Check size={16} color="#fff" strokeWidth={2.5} />}
        </Pressable>

        <ItemGlyph categoryName={item.category} size={36} />

        <View className="flex-1 min-w-0">
          {editing ? (
            <TextInput
              autoFocus
              value={item.name}
              onChangeText={onNameChange}
              onBlur={() => setEditing(false)}
              onSubmitEditing={() => setEditing(false)}
              style={{
                fontSize: 15,
                fontWeight: "500",
                color: "#1A1A17",
                padding: 0,
                backgroundColor: "#FAFAF7",
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                outlineWidth: 0,
              }}
              editable={item.included}
            />
          ) : (
            <Pressable
              onPress={() => item.included && setEditing(true)}
              className="flex-row items-center gap-1.5"
            >
              <Text
                className="text-[15px] font-medium text-ink flex-1"
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.included && (
                <Pencil size={13} color="#9A9A91" strokeWidth={1.6} />
              )}
            </Pressable>
          )}
          {/* Qty + Unit — always editable inline */}
          <View className="flex-row items-center gap-1.5 mt-1">
            <TextInput
              value={qtyDraft}
              onChangeText={setQtyDraft}
              onBlur={() => onQuantityChange(qtyDraft)}
              onSubmitEditing={() => onQuantityChange(qtyDraft)}
              keyboardType="decimal-pad"
              returnKeyType="done"
              editable={item.included}
              style={{
                fontSize: 12,
                color: "#1A1A17",
                backgroundColor: "#F4F1EA",
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 3,
                minWidth: 36,
                textAlign: "center",
              }}
            />
            <Text className="text-xs text-ink-faint">×</Text>
            <TextInput
              value={unitDraft}
              onChangeText={setUnitDraft}
              onBlur={() => onUnitChange(unitDraft)}
              onSubmitEditing={() => onUnitChange(unitDraft)}
              placeholder="unité (ex: 500g)"
              placeholderTextColor="#C0BFB8"
              returnKeyType="done"
              editable={item.included}
              style={{
                fontSize: 12,
                color: "#1A1A17",
                backgroundColor: "#F4F1EA",
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 3,
                minWidth: 60,
              }}
            />
          </View>
        </View>
      </View>

      {/* Row 2: expiry stepper */}
      {item.included && (
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
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: urgencyColor,
              }}
            />
            <Text
              style={{
                color: urgencyColor,
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {expiryLabel(days)}
            </Text>
          </View>

          <View className="flex-row items-center gap-1">
            {/* Fine-tune: subtract one day */}
            <Pressable
              onPress={() => onAdjustExpiry(-1)}
              hitSlop={6}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.7)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Minus size={14} color={urgencyColor} strokeWidth={2} />
            </Pressable>
            {/* Quick-add chips. Long-press → apply to ALL included items. */}
            {QUICK_OFFSETS.map((q) => (
              <Pressable
                key={q.days}
                onPress={() => onAdjustExpiry(q.days)}
                onLongPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  onAdjustAllExpiry(q.days);
                }}
                hitSlop={4}
                style={{
                  height: 28,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.7)",
                  alignItems: "center",
                  justifyContent: "center",
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
      )}
    </View>
  );
}
