import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useLocalSearchParams, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  ChevronLeft,
  Minus,
  Plus,
  Pencil,
  ShoppingBasket,
  Check,
  Trash2,
} from "lucide-react-native";

import { ExpiryStepper } from "@/components/ExpiryStepper";
import { ItemGlyph } from "@/components/ItemGlyph";
import { useCategories } from "@/lib/hooks/useCategories";
import { useNutrition } from "@/lib/hooks/useNutrition";
import {
  usePantryItem,
  useUpdatePantryItem,
  useUpdateItemStatus,
  useDeletePantryItem,
} from "@/lib/hooks/usePantryItems";
import { useAddToShoppingList } from "@/lib/hooks/useShoppingList";
import type { ItemCategory } from "@/lib/types";

const NUTRISCORE_COLORS: Record<string, string> = {
  a: "#1E8E3E",
  b: "#85B842",
  c: "#F4B400",
  d: "#F4862F",
  e: "#D93025",
};

export default function PantryItemDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading } = usePantryItem(id);
  const { data: categories } = useCategories();
  const { mutate: patchItem } = useUpdatePantryItem();
  const { mutate: setStatus } = useUpdateItemStatus();
  const { mutate: deleteItem } = useDeletePantryItem();
  const { mutate: addToShoppingList } = useAddToShoppingList();
  const { data: liveNutrition, isLoading: nutritionLoading } = useNutrition(item);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [showPurchaseDate, setShowPurchaseDate] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  // Must be declared here (before any conditional return) to satisfy Rules of Hooks
  const [usedInput, setUsedInput] = useState("");
  const usedInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (item) {
      setNameDraft(item.name);
      setNoteDraft(item.note ?? "");
    }
  }, [item]);

  if (isLoading || !item) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center" edges={["top"]}>
        <ActivityIndicator color="#3F8F5C" />
      </SafeAreaView>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  // Local non-null alias — TypeScript loses the early-return narrowing inside
  // closures defined later in the component body, so we assert here.
  const it = item!;
  // ── Pack-weight helper ───────────────────────────────────────────────────
  // Parses unit strings like "500g", "1L", "4x125g", "50cl" into a total
  // value in base units (g or ml) so we can do gram-level arithmetic.
  const packWeight = parsePackWeight(it.unit);

  function adjustQuantity(delta: number) {
    const next = Math.max(0, it.quantity + delta);
    if (next === 0) {
      setStatus({ id: it.id, status: "consumed" });
      router.back();
    } else {
      patchItem({ id: it.id, patch: { quantity: next } });
    }
  }

  function commitUsedWeight() {
    if (!packWeight) return;
    const used = parseFloat(usedInput.replace(",", "."));
    if (!Number.isFinite(used) || used <= 0) { setUsedInput(""); return; }
    const usedPacks = used / packWeight.total;
    const next = Math.max(0, it.quantity - usedPacks);
    setUsedInput("");
    if (next < 0.01) {
      setStatus({ id: it.id, status: "consumed" });
      router.back();
    } else {
      patchItem({ id: it.id, patch: { quantity: Math.round(next * 1000) / 1000 } });
    }
  }

  function shiftExpiry(days: number) {
    const next = format(addDays(parseISO(it.expires_on), days), "yyyy-MM-dd");
    patchItem({ id: it.id, patch: { expires_on: next } });
  }

  function setCategory(cat: ItemCategory | null) {
    patchItem({ id: it.id, patch: { category_id: cat?.id ?? null } });
    setCategoryPickerOpen(false);
  }

  function commitName() {
    if (nameDraft.trim() && nameDraft !== it.name) {
      patchItem({ id: it.id, patch: { name: nameDraft.trim() } });
    }
    setEditingName(false);
  }

  function commitNote() {
    if (noteDraft !== (it.note ?? "")) {
      patchItem({ id: it.id, patch: { note: noteDraft.trim() || null } });
    }
    setEditingNote(false);
  }

  function confirmDelete() {
    Alert.alert(
      "Supprimer cet article ?",
      "L'article disparaîtra du garde-manger.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            deleteItem(it.id);
            router.back();
          },
        },
      ],
    );
  }

  function markConsumed() {
    setStatus({ id: it.id, status: "consumed" });
    router.back();
  }

  // ── Derived UI bits ──────────────────────────────────────────────────────
  const initialQty = item.initial_quantity ?? item.quantity;
  const consumedFraction =
    initialQty > 0 ? Math.max(0, 1 - item.quantity / initialQty) : 0;
  const categoryName = item.item_categories?.name ?? "Autre";
  const nutri = item.nutrition_data ?? liveNutrition ?? null;

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
        <Text className="text-[17px] font-semibold text-ink">Article</Text>
        <Pressable
          onPress={confirmDelete}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
        >
          <Trash2 size={20} color="#C8553D" strokeWidth={1.75} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 160, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: glyph + name + category */}
        <View className="flex-row items-center gap-3 mb-5">
          <ItemGlyph categoryName={categoryName} size={56} />
          <View className="flex-1">
            {editingName ? (
              <TextInput
                autoFocus
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={commitName}
                onSubmitEditing={commitName}
                style={{
                  fontSize: 22,
                  fontWeight: "600",
                  color: "#1A1A17",
                  letterSpacing: -0.5,
                  paddingVertical: 2,
                  borderBottomWidth: 1,
                  borderBottomColor: "#3F8F5C",
                }}
              />
            ) : (
              <Pressable
                onPress={() => setEditingName(true)}
                className="flex-row items-center gap-1.5"
              >
                <Text
                  className="text-[22px] font-semibold text-ink"
                  style={{ letterSpacing: -0.5 }}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <Pencil size={14} color="#9A9A91" strokeWidth={1.6} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setCategoryPickerOpen((v) => !v)}
              className="self-start mt-1"
            >
              <Text className="text-[12px] text-ink-faint">
                {categoryName} · changer
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Category picker */}
        {categoryPickerOpen && categories && (
          <View className="rounded-2xl bg-card border border-borderSoft p-2 mb-4 flex-row flex-wrap gap-2">
            {categories.map((c) => {
              const active = c.id === item.category_id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c)}
                  className="px-3 py-1.5 rounded-full border"
                  style={{
                    backgroundColor: active ? "#3F8F5C" : "#fff",
                    borderColor: active ? "#3F8F5C" : "#E6E5DF",
                  }}
                >
                  <Text style={{ color: active ? "#fff" : "#1A1A17", fontSize: 12 }}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Quantity card */}
        <View className="rounded-2xl bg-card border border-borderSoft p-4 mb-3">
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint mb-2">
            Quantité
          </Text>
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => adjustQuantity(-1)}
              className="w-12 h-12 rounded-full bg-bg border border-border items-center justify-center active:opacity-70"
            >
              <Minus size={20} color="#1A1A17" strokeWidth={2} />
            </Pressable>
            <View className="items-center">
              <Text className="text-[30px] font-semibold text-ink" style={{ letterSpacing: -0.5 }}>
                {packWeight
                  ? formatWeight(item.quantity * packWeight.total, packWeight.baseUnit)
                  : item.quantity}
                {!packWeight && item.unit
                  ? <Text className="text-base text-ink-faint"> {item.unit}</Text>
                  : null}
              </Text>
              <Text className="text-[11px] text-ink-faint mt-0.5">
                {packWeight
                  ? `${item.quantity} paquet${item.quantity > 1 ? "s" : ""} · ${formatWeight(initialQty * packWeight.total, packWeight.baseUnit)} au départ`
                  : `sur ${initialQty} au départ`}
              </Text>
            </View>
            <Pressable
              onPress={() => adjustQuantity(+1)}
              className="w-12 h-12 rounded-full bg-bg border border-border items-center justify-center active:opacity-70"
            >
              <Plus size={20} color="#1A1A17" strokeWidth={2} />
            </Pressable>
          </View>
          {/* Consumption bar */}
          {initialQty > 0 && (
            <View className="h-1.5 mt-3 rounded-full" style={{ backgroundColor: "#E8F2EB" }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${Math.round(consumedFraction * 100)}%`,
                  backgroundColor: "#3F8F5C",
                }}
              />
            </View>
          )}
          {/* "I used Xg" row — only shown when unit is a weight/volume */}
          {packWeight && (
            <View className="flex-row items-center gap-2 mt-3 pt-3"
              style={{ borderTopWidth: 1, borderTopColor: "#F0EFEA" }}>
              <TextInput
                ref={usedInputRef}
                value={usedInput}
                onChangeText={setUsedInput}
                onSubmitEditing={commitUsedWeight}
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder={`j'ai utilisé … ${packWeight.baseUnit}`}
                placeholderTextColor="#9A9A91"
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#1A1A17",
                  backgroundColor: "#F4F1EA",
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              />
              <Pressable
                onPress={commitUsedWeight}
                className="px-3 py-2 rounded-xl items-center justify-center"
                style={{ backgroundColor: "#1A1A17" }}
              >
                <Text className="text-[12px] font-semibold text-white">Retirer</Text>
              </Pressable>
            </View>
          )}
          {!packWeight && (
            <Text className="text-[11px] text-ink-faint mt-2 text-center">
              Atteindre 0 marque l'article consommé
            </Text>
          )}
        </View>

        {/* Expiry stepper */}
        <View className="mb-3">
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint mb-2">
            Expiration
          </Text>
          <ExpiryStepper expiresOn={item.expires_on} onAdjust={shiftExpiry} />
        </View>

        {/* Dates row */}
        <View className="flex-row gap-3 mb-3">
          <Pressable
            onPress={() => setShowPurchaseDate(true)}
            className="flex-1 rounded-2xl bg-card border border-borderSoft p-3"
          >
            <Text className="text-[10px] uppercase tracking-widest text-ink-faint">
              Acheté le
            </Text>
            <Text className="text-[14px] font-medium text-ink mt-1">
              {item.purchased_at
                ? format(parseISO(item.purchased_at), "d MMMM yyyy", { locale: fr })
                : "—"}
            </Text>
          </Pressable>
          <View className="flex-1 rounded-2xl bg-card border border-borderSoft p-3">
            <Text className="text-[10px] uppercase tracking-widest text-ink-faint">
              Ajouté le
            </Text>
            <Text className="text-[14px] font-medium text-ink mt-1">
              {item.added_at
                ? format(parseISO(item.added_at), "d MMMM yyyy", { locale: fr })
                : "—"}
            </Text>
          </View>
        </View>

        {showPurchaseDate && (
          <DateTimePicker
            value={item.purchased_at ? parseISO(item.purchased_at) : new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(_e, d) => {
              setShowPurchaseDate(false);
              if (d) {
                patchItem({
                  id: item.id,
                  patch: { purchased_at: format(d, "yyyy-MM-dd") },
                });
              }
            }}
          />
        )}

        {/* Price */}
        {item.price != null && (
          <View className="rounded-2xl bg-card border border-borderSoft p-3 mb-3">
            <Text className="text-[10px] uppercase tracking-widest text-ink-faint">Prix</Text>
            <Text className="text-[16px] font-semibold text-ink mt-1">
              {item.price.toFixed(2)} €
            </Text>
          </View>
        )}

        {/* Note */}
        <View className="rounded-2xl bg-card border border-borderSoft p-3 mb-3">
          <Text className="text-[10px] uppercase tracking-widest text-ink-faint mb-1.5">
            Note
          </Text>
          {editingNote ? (
            <TextInput
              autoFocus
              value={noteDraft}
              onChangeText={setNoteDraft}
              onBlur={commitNote}
              multiline
              placeholder="Ajouter une note…"
              placeholderTextColor="#9A9A91"
              style={{ fontSize: 14, color: "#1A1A17", minHeight: 44 }}
            />
          ) : (
            <Pressable onPress={() => setEditingNote(true)}>
              <Text className="text-[14px] text-ink">
                {item.note ?? <Text className="text-ink-faint">Ajouter une note…</Text>}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Nutrition card (Phase 8 wires the lookup; this renders cached data if present) */}
        <View className="rounded-2xl bg-card border border-borderSoft p-4 mb-4">
          <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint mb-2">
            Nutrition
          </Text>
          {nutri ? (
            <View>
              <View className="flex-row items-center gap-3 mb-3">
                {nutri.image_url ? (
                  <Image
                    source={{ uri: nutri.image_url }}
                    style={{ width: 56, height: 56, borderRadius: 10 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 56, height: 56, borderRadius: 10,
                      backgroundColor: "#F4F1EA",
                    }}
                  />
                )}
                <View className="flex-1">
                  <Text className="text-[13px] text-ink" numberOfLines={1}>
                    {nutri.product_name ?? item.name}
                  </Text>
                  {nutri.nutriscore_grade && (
                    <View
                      style={{
                        marginTop: 4,
                        alignSelf: "flex-start",
                        backgroundColor:
                          NUTRISCORE_COLORS[nutri.nutriscore_grade.toLowerCase()] ?? "#9A9A91",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                        Nutri-Score {nutri.nutriscore_grade.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                <NutriCell label="kcal" value={nutri.energy_kcal_100g} unit="" />
                <NutriCell label="Protéines" value={nutri.proteins_100g} unit="g" />
                <NutriCell label="Glucides" value={nutri.carbohydrates_100g} unit="g" />
                <NutriCell label="Lipides" value={nutri.fat_100g} unit="g" />
              </View>
              <Text className="text-[10px] text-ink-faint mt-2">Source : OpenFoodFacts (pour 100g)</Text>
            </View>
          ) : nutritionLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color="#9A9A91" />
              <Text className="text-[13px] text-ink-faint">Recherche OpenFoodFacts…</Text>
            </View>
          ) : (
            <Text className="text-[13px] text-ink-faint">
              Pas trouvé sur OpenFoodFacts.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-bg border-t border-borderSoft px-5 pb-8 pt-3"
        style={{
          shadowColor: "#000", shadowOpacity: 0.06,
          shadowRadius: 12, shadowOffset: { width: 0, height: -4 },
        }}
      >
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => {
              addToShoppingList(
                {
                  normalized_name: it.normalized_name ?? it.name.toLowerCase().trim(),
                  display_name: it.name,
                  category_id: it.category_id,
                },
                {
                  onSuccess: () =>
                    Alert.alert("Ajouté ✓", "Cet article est dans ta liste de courses."),
                  onError: (e: any) =>
                    Alert.alert("Erreur", e?.message ?? "Impossible d'ajouter."),
                },
              );
            }}
            className="flex-1 rounded-2xl py-3.5 items-center bg-card border border-border active:opacity-70 flex-row justify-center gap-2"
          >
            <ShoppingBasket size={18} color="#1A1A17" strokeWidth={1.75} />
            <Text className="text-[14px] font-semibold text-ink">Liste de courses</Text>
          </Pressable>
          <Pressable
            onPress={markConsumed}
            className="flex-1 rounded-2xl py-3.5 items-center bg-brand active:opacity-80 flex-row justify-center gap-2"
            style={{ elevation: 2 }}
          >
            <Check size={18} color="#fff" strokeWidth={2.5} />
            <Text className="text-[14px] font-bold text-white">Consommé</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Pack weight helpers ────────────────────────────────────────────────────

type PackWeight = { total: number; baseUnit: "g" | "ml" };

/**
 * Parse a unit string like "500g", "1L", "4x125g", "33cl" into a total
 * amount in base units (g or ml). Returns null for unparseable strings.
 */
function parsePackWeight(unit: string | null | undefined): PackWeight | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();
  // "4x125g", "6x33cl", "4x125ml" …
  const multi = u.match(/^(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cl)$/);
  if (multi) {
    const count = parseInt(multi[1]);
    const val = parseFloat(multi[2].replace(",", "."));
    const totalVal = count * val;
    const base = multi[3] === "kg" ? totalVal * 1000
                : multi[3] === "l"  ? totalVal * 1000
                : multi[3] === "cl" ? totalVal * 10
                : totalVal;
    return { total: base, baseUnit: multi[3] === "ml" || multi[3] === "l" || multi[3] === "cl" ? "ml" : "g" };
  }
  // "500g", "1.5kg", "1L", "50cl", "250ml" …
  const simple = u.match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|cl)$/);
  if (simple) {
    const val = parseFloat(simple[1].replace(",", "."));
    const base = simple[2] === "kg" ? val * 1000
                : simple[2] === "l"  ? val * 1000
                : simple[2] === "cl" ? val * 10
                : val;
    return { total: base, baseUnit: simple[2] === "ml" || simple[2] === "l" || simple[2] === "cl" ? "ml" : "g" };
  }
  return null;
}

/** Format a weight/volume value with appropriate unit abbreviation. */
function formatWeight(amount: number, baseUnit: "g" | "ml"): string {
  if (baseUnit === "g") {
    return amount >= 1000
      ? `${(amount / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`
      : `${Math.round(amount)} g`;
  }
  return amount >= 1000
    ? `${(amount / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} L`
    : `${Math.round(amount)} ml`;
}

function NutriCell({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <View
      style={{
        flexBasis: "48%",
        backgroundColor: "#FAFAF7",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
      }}
    >
      <Text className="text-[10px] uppercase tracking-widest text-ink-faint">{label}</Text>
      <Text className="text-[15px] font-semibold text-ink mt-0.5">
        {value != null ? `${Math.round(value)}${unit}` : "—"}
      </Text>
    </View>
  );
}
