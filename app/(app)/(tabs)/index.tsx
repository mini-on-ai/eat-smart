import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ActivityIndicator,
  SectionList,
  Text,
  View,
} from "react-native";
import { Sun, Moon, ArchiveRestore } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme";
import { useTheme } from "@/lib/themeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CalendarPlus,
  Check,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react-native";

import { PantryItemRow } from "@/components/PantryItemRow";
import {
  useBatchDeletePantryItems,
  useBatchShiftExpiry,
  useBatchUpdateStatus,
  useDeletePantryItem,
  usePantryItems,
  useUpdateItemStatus,
} from "@/lib/hooks/usePantryItems";
import { daysUntilExpiry } from "@/lib/expiry";
import type { PantryItem } from "@/lib/types";

type Section = { title: string; data: PantryItem[] };

function buildSections(items: PantryItem[]): Section[] {
  const today  = items.filter((i) => daysUntilExpiry(i.expires_on) <= 0);
  const soon   = items.filter((i) => { const d = daysUntilExpiry(i.expires_on); return d >= 1 && d <= 3; });
  const later  = items.filter((i) => daysUntilExpiry(i.expires_on) > 3);

  return [
    { title: "Aujourd'hui",        data: today },
    { title: "Dans quelques jours", data: soon },
    { title: "Plus tard",           data: later },
  ].filter((s) => s.data.length > 0);
}

export default function Home() {
  const router = useRouter();
  const colors = useThemeColors();
  const { isDark, toggle: toggleScheme } = useTheme();
  const { data: items, isLoading } = usePantryItems();
  const { mutate: updateStatus } = useUpdateItemStatus();
  const { mutate: deleteItem } = useDeletePantryItem();
  const { mutate: batchStatus } = useBatchUpdateStatus();
  const { mutate: batchDelete } = useBatchDeletePantryItems();
  const { mutate: batchShift } = useBatchShiftExpiry();

  // ── Selection mode ───────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allItems = items ?? [];
  const sections = buildSections(allItems);
  const todayLabel = format(new Date(), "EEEE d MMMM", { locale: fr });
  const soonCount = allItems.filter((i) => daysUntilExpiry(i.expires_on) <= 3).length;
  const todayCount = allItems.filter((i) => daysUntilExpiry(i.expires_on) <= 0).length;

  function enterSelectionMode(id: string) {
    setSelectionMode(true);
    setSelected(new Set([id]));
  }

  function toggleSelection(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Exiting selection mode when the last row is unticked feels right.
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  const allSelected = allItems.length > 0 && allItems.every((i) => selected.has(i.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allItems.map((i) => i.id)));
    }
  }

  function bulkConsume() {
    const ids = [...selected];
    batchStatus({ ids, status: "consumed" });
    exitSelectionMode();
  }

  function bulkDelete() {
    Alert.alert(
      `Supprimer ${selected.size} article${selected.size > 1 ? "s" : ""} ?`,
      "Cette action est définitive.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            batchDelete([...selected]);
            exitSelectionMode();
          },
        },
      ],
    );
  }

  function bulkShiftExpiry() {
    const selectedItems = allItems.filter((i) => selected.has(i.id));
    Alert.alert("Décaler l'expiration", "De combien ?", [
      { text: "−1 jour", onPress: () => { batchShift({ items: selectedItems, days: -1 }); exitSelectionMode(); } },
      { text: "+1 jour", onPress: () => { batchShift({ items: selectedItems, days: 1 }); exitSelectionMode(); } },
      { text: "+7 jours", onPress: () => { batchShift({ items: selectedItems, days: 7 }); exitSelectionMode(); } },
      { text: "+1 mois", onPress: () => { batchShift({ items: selectedItems, days: 30 }); exitSelectionMode(); } },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      {/* Header — swaps to selection action bar when active */}
      {selectionMode ? (
        <View
          className="px-3 pt-2 pb-3 flex-row items-center justify-between"
          style={{ backgroundColor: colors.elevated }}
        >
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={exitSelectionMode}
              className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
            >
              <X size={20} color="#fff" strokeWidth={1.75} />
            </Pressable>
            <Text className="text-[15px] font-semibold text-white">
              {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
            </Text>
            <Pressable
              onPress={toggleSelectAll}
              className="px-2.5 py-1 rounded-full active:opacity-60"
              style={{ backgroundColor: allSelected ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)" }}
            >
              <Text className="text-[12px] font-semibold text-white">
                {allSelected ? "Aucun" : "Tout"}
              </Text>
            </Pressable>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={bulkShiftExpiry}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
              style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <CalendarPlus size={18} color="#fff" strokeWidth={1.75} />
            </Pressable>
            <Pressable
              onPress={bulkConsume}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
              style={{ backgroundColor: "#3F8F5C" }}
            >
              <Check size={18} color="#fff" strokeWidth={2} />
            </Pressable>
            <Pressable
              onPress={bulkDelete}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
              style={{ backgroundColor: "#C8553D" }}
            >
              <Trash2 size={18} color="#fff" strokeWidth={1.75} />
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="px-5 pt-3 pb-2 flex-row items-start justify-between">
          <View>
            <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
              {todayLabel}
            </Text>
            <Text className="text-2xl font-semibold text-ink mt-0.5" style={{ letterSpacing: -0.5 }}>
              Garde-manger
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            {/* Dark / light mode toggle — high-contrast inverted pill */}
            <Pressable
              onPress={toggleScheme}
              className="flex-row items-center gap-1.5 px-3 h-10 rounded-full active:opacity-70"
              style={{
                // Inverted: dark background in light mode, light background in dark mode.
                // Always visible regardless of theme.
                backgroundColor: isDark ? "#E8E8E4" : "#1A1A17",
              }}
            >
              {isDark
                ? <Sun  size={14} color="#1A1A17" strokeWidth={2.5} />
                : <Moon size={14} color="#FFFFFF" strokeWidth={2.5} />}
              <Text
                className="text-[13px] font-bold"
                style={{ color: isDark ? "#1A1A17" : "#FFFFFF" }}
              >
                {isDark ? "Clair" : "Sombre"}
              </Text>
            </Pressable>
            {/* Recently consumed / deleted items */}
            <Pressable
              onPress={() => router.push("/(app)/recent-items")}
              className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
              style={{ backgroundColor: colors.muted }}
            >
              <ArchiveRestore size={18} color={colors.ink} strokeWidth={1.75} />
            </Pressable>
          </View>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#3F8F5C" size="large" />
        </View>
      ) : allItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-10 gap-3">
          <Text className="text-5xl">🫙</Text>
          <Text className="text-xl font-semibold text-ink text-center">Frigo vide</Text>
          <Text className="text-sm text-ink-faint text-center leading-5">
            Scannez un ticket ou ajoutez vos aliments pour être alerté avant qu'ils expirent.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 140 }}
          extraData={{ selectionMode, selected }}
          ListHeaderComponent={() =>
            !selectionMode && allItems.length > 0 ? (
              <View className="mx-5 mb-1 mt-3 bg-brand-soft rounded-2xl px-4 py-3.5 flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-full bg-brand items-center justify-center">
                  <Text className="text-white text-[15px] font-bold">{soonCount}</Text>
                </View>
                <View className="flex-1">
                  {soonCount > 0 ? (
                    <>
                      <Text className="text-[15px] font-medium text-brand-deep">
                        articles à consommer bientôt
                      </Text>
                      <Text className="text-xs text-brand-deep" style={{ opacity: 0.7 }}>
                        dont {todayCount} aujourd'hui
                      </Text>
                    </>
                  ) : (
                    <Text className="text-[15px] font-medium text-brand-deep">
                      Tout va bien 🎉
                    </Text>
                  )}
                </View>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <View className="flex-row justify-between items-center pb-2 pt-5 px-5">
              <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
                {section.title}
              </Text>
              <Text className="text-[11px] font-semibold text-ink-faint">
                {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <PantryItemRow
              item={item}
              onConsume={(id) => updateStatus({ id, status: "consumed" })}
              onDelete={(id) => deleteItem(id)}
              onPress={(id) => router.push({ pathname: "/(app)/pantry-item/[id]", params: { id } })}
              onLongPress={(id) => enterSelectionMode(id)}
              selectionMode={selectionMode}
              selected={selected.has(item.id)}
              onSelectToggle={toggleSelection}
            />
          )}
        />
      )}

      {/* FAB cluster — hidden during selection */}
      {!selectionMode && (
        <View className="absolute bottom-8 right-5 gap-3 items-end">
          <Pressable
            onPress={() => router.push("/(app)/scan-receipt")}
            className="flex-row items-center gap-2 rounded-full bg-card border border-border px-4 h-11 active:opacity-70"
            style={{
              elevation: 3,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <ReceiptText size={18} color={colors.ink} strokeWidth={1.75} />
            <Text className="text-sm font-semibold text-ink">Scanner un ticket</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push("/(app)/add-item")}
            className="w-14 h-14 rounded-full bg-brand items-center justify-center active:opacity-80"
            style={{
              elevation: 4,
              shadowColor: "#3F8F5C",
              shadowOpacity: 0.45,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <Plus size={26} color="white" strokeWidth={2.5} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
