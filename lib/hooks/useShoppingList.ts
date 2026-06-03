import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { supabase } from "@/lib/supabase";

export type ManualShoppingItem = {
  id: string;
  normalized_name: string;
  display_name: string;
  category_id: number | null;
  added_at: string;
  checked: boolean;
};

/** Manual entries the user explicitly added to the shopping list. */
export function useManualShoppingItems() {
  const { data: householdId } = useHousehold();
  return useQuery({
    enabled: !!householdId,
    queryKey: ["shopping-list-items", householdId],
    queryFn: async (): Promise<ManualShoppingItem[]> => {
      const { data, error } = await supabase
        .from("shopping_list_items")
        .select("id, normalized_name, display_name, category_id, added_at, checked")
        .eq("household_id", householdId!)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ManualShoppingItem[];
    },
  });
}

export function useAddToShoppingList() {
  const { session } = useAuth();
  const { data: householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      normalized_name: string;
      display_name: string;
      category_id: number | null;
    }) => {
      const { error } = await supabase
        .from("shopping_list_items")
        .upsert(
          {
            ...entry,
            household_id: householdId,
            added_by: session?.user.id ?? null,
            checked: false,
          },
          { onConflict: "household_id,normalized_name", ignoreDuplicates: false },
        );
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["shopping-list-items", householdId] }),
  });
}

export function useToggleShoppingItem() {
  const { data: householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from("shopping_list_items")
        .update({ checked })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["shopping-list-items", householdId] }),
  });
}

export function useRemoveShoppingItem() {
  const { data: householdId } = useHousehold();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["shopping-list-items", householdId] }),
  });
}
