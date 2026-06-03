import DateTimePicker from "@react-native-community/datetimepicker";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useThemeColors } from "@/lib/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, Minus, Plus } from "lucide-react-native";
import { z } from "zod";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCategories } from "@/lib/hooks/useCategories";
import { useAddPantryItem } from "@/lib/hooks/usePantryItems";

const DATE_SHORTCUTS = [
  { label: "Demain",        days: 1 },
  { label: "Dans 3 jours",  days: 3 },
  { label: "Dans 1 semaine", days: 7 },
  { label: "Dans 1 mois",   days: 30 },
];

const UNIT_OPTIONS = ["g", "kg", "ml", "L", "pièce(s)"];

const schema = z.object({
  name: z.string().min(1, "Nom requis"),
  category_id: z.number().nullable(),
  quantity: z.number().min(0.1, "Quantité invalide"),
  unit: z.string().nullable(),
  expires_on: z.string().min(1, "Date requise"),
});
type FormData = z.infer<typeof schema>;

export default function AddItem() {
  const router = useRouter();
  const colors = useThemeColors();
  const { data: categories, isLoading: loadingCats } = useCategories();
  const { mutateAsync: addItem } = useAddPantryItem();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      category_id: null,
      quantity: 1,
      unit: null,
      expires_on: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    },
  });

  const expiresOn = watch("expires_on");
  const selectedCategoryId = watch("category_id");
  const quantity = watch("quantity");
  const unit = watch("unit");

  function setExpiry(days: number) {
    setValue("expires_on", format(addDays(new Date(), days), "yyyy-MM-dd"));
  }

  async function onSubmit(data: FormData) {
    await addItem(data);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top", "bottom"]}>
      {/* Top bar */}
      <View className="flex-row items-center justify-between px-2 pt-2 pr-5">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center active:opacity-60"
        >
          <ChevronLeft size={24} color="#1A1A17" strokeWidth={1.75} />
        </Pressable>
        <Text className="text-[17px] font-semibold text-ink">Ajouter</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 pt-4 pb-8 gap-6">

          {/* Name */}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nom de l'article"
                placeholder="Yaourt nature, pommes…"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                autoFocus
              />
            )}
          />

          {/* Categories */}
          <View className="gap-2.5">
            <Text className="text-sm font-medium text-ink-soft">Catégorie</Text>
            {loadingCats ? (
              <ActivityIndicator color="#3F8F5C" />
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {categories?.map((cat) => {
                  const selected = selectedCategoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        setValue("category_id", cat.id);
                        setExpiry(cat.default_shelf_life_days);
                      }}
                      className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 active:opacity-70"
                      style={{
                        backgroundColor: selected ? colors.elevated : colors.card,
                        borderWidth: 1,
                        borderColor: selected ? "transparent" : colors.border,
                      }}
                    >
                      <Text
                        className="text-[13px] font-medium"
                        style={{ color: selected ? "#F0F0EC" : colors.ink }}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Expiry shortcuts */}
          <View className="gap-2.5">
            <Text className="text-sm font-medium text-ink-soft">Expire</Text>
            <View className="flex-row flex-wrap gap-2">
              {DATE_SHORTCUTS.map((s) => {
                const targetDate = format(addDays(new Date(), s.days), "yyyy-MM-dd");
                const selected = expiresOn === targetDate;
                return (
                  <Pressable
                    key={s.days}
                    onPress={() => setExpiry(s.days)}
                    className="rounded-full px-3.5 py-2 active:opacity-70"
                    style={{
                      backgroundColor: selected ? "#1A1A17" : "#FFFFFF",
                      borderWidth: 1,
                      borderColor: selected ? "transparent" : "#E6E5DF",
                    }}
                  >
                    <Text
                      className="text-[13px] font-medium"
                      style={{ color: selected ? "#FAFAF7" : "#1A1A17" }}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {/* Date display / picker trigger */}
            <Pressable
              onPress={() => setShowDatePicker(true)}
              className="h-12 rounded-2xl border border-border bg-card px-4 flex-row items-center justify-between"
            >
              <Text className="text-base text-ink">
                {format(parseISO(expiresOn), "dd/MM/yyyy")}
              </Text>
              <Text className="text-ink-faint text-sm">Choisir →</Text>
            </Pressable>
            {errors.expires_on && (
              <Text className="text-xs text-urgent">{errors.expires_on.message}</Text>
            )}
          </View>

          {showDatePicker && (
            <DateTimePicker
              mode="date"
              display="default"
              value={parseISO(expiresOn)}
              minimumDate={new Date()}
              onChange={(_, date) => {
                setShowDatePicker(false);
                if (date) setValue("expires_on", format(date, "yyyy-MM-dd"));
              }}
            />
          )}

          {/* Quantity stepper */}
          <View className="gap-2.5">
            <Text className="text-sm font-medium text-ink-soft">Quantité</Text>
            <View
              className="flex-row items-center bg-card border border-border rounded-2xl"
              style={{ padding: 8 }}
            >
              <Pressable
                onPress={() => setValue("quantity", Math.max(1, quantity - 1))}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#FAFAF7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Minus size={18} color="#1A1A17" strokeWidth={2} />
              </Pressable>
              <Text
                className="flex-1 text-center text-2xl font-semibold text-ink"
                style={{ letterSpacing: -0.5 }}
              >
                {quantity}
              </Text>
              <Pressable
                onPress={() => setValue("quantity", quantity + 1)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: "#FAFAF7",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus size={18} color="#1A1A17" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Unit chips */}
            <View className="flex-row flex-wrap gap-2">
              {UNIT_OPTIONS.map((u) => {
                const selected = unit === u;
                return (
                  <Pressable
                    key={u}
                    onPress={() => setValue("unit", selected ? null : u)}
                    className="rounded-full active:opacity-70"
                    style={{
                      height: 28,
                      paddingHorizontal: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? "#1A1A17" : "#FFFFFF",
                      borderWidth: 1,
                      borderColor: selected ? "transparent" : "#E6E5DF",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "500",
                        color: selected ? "#FAFAF7" : "#1A1A17",
                      }}
                    >
                      {u}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button
            label="Ajouter au garde-manger"
            loading={isSubmitting}
            onPress={handleSubmit(onSubmit)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
