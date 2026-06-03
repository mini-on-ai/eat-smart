import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/lib/hooks/useHousehold";

export type ConsumedItem = {
  id: string;
  name: string;
  normalized_name: string | null;
  category_id: number | null;
  quantity: number;
  unit: string | null;
  price: number | null;
  purchased_at: string | null; // YYYY-MM-DD
  receipt_id: string | null;
};

/**
 * All `status='consumed'` items for the current household — i.e. every line
 * imported from a historical receipt OR consumed afterward.
 *
 * Cached aggressively (10 min) because this is the input for the stats screen
 * and the smart shopping list, both of which are expensive to recompute and
 * change rarely (a new scan adds maybe 30 items at a time).
 */
export function useConsumedHistory() {
  const { data: householdId } = useHousehold();

  return useQuery({
    enabled: !!householdId,
    queryKey: ["consumed-history", householdId],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<ConsumedItem[]> => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select(
          "id, name, normalized_name, category_id, quantity, unit, price, purchased_at, receipt_id"
        )
        .eq("household_id", householdId!)
        .eq("status", "consumed")
        .order("purchased_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConsumedItem[];
    },
  });
}
