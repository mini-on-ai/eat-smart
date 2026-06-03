import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ItemCategory } from "@/lib/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_categories")
        .select("*")
        .order("id");
      if (error) throw error;
      return data as ItemCategory[];
    },
    staleTime: Infinity,
  });
}
