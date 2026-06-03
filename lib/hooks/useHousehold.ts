import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export function useHousehold() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["household", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId!)
        .single();
      if (error) throw error;
      return data.household_id as string;
    },
    enabled: !!userId,
    // Do NOT use staleTime: Infinity — household membership can change (e.g. after a
    // household merge) and a stale ID here breaks every RLS-guarded INSERT in the app.
  });
}
