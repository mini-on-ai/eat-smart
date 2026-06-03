import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/hooks/useHousehold";
import { supabase } from "@/lib/supabase";
import type { ItemStatus, NewPantryItem, PantryItem } from "@/lib/types";

export function usePantryItems() {
  const { data: householdId } = useHousehold();

  return useQuery({
    queryKey: ["pantry", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*, item_categories(*)")
        .eq("household_id", householdId!)
        .eq("status", "active")
        .order("expires_on", { ascending: true });
      if (error) throw error;
      return data as PantryItem[];
    },
    enabled: !!householdId,
  });
}

export function useAddPantryItem() {
  const { session } = useAuth();
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: NewPantryItem) => {
      const { error } = await supabase.from("pantry_items").insert({
        ...item,
        household_id: householdId,
        added_by: session!.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pantry", householdId] }),
  });
}

export function useUpdateItemStatus() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ItemStatus }) => {
      const { error } = await supabase
        .from("pantry_items")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pantry", householdId] }),
  });
}

/** Soft-delete — sets status='discarded' so the item can be restored. */
export function useDeletePantryItem() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pantry_items")
        .update({ status: "discarded" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry", householdId] });
      queryClient.invalidateQueries({ queryKey: ["pantry-recent", householdId] });
    },
  });
}

// ─── single-item detail-page helpers ──────────────────────────────────────

/** Fetch a single pantry row by id — used by the detail page. */
export function usePantryItem(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["pantry-item", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*, item_categories(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as PantryItem;
    },
  });
}

/** Patch any subset of editable fields on a pantry row. */
export function useUpdatePantryItem() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PantryItem> }) => {
      const { error } = await supabase
        .from("pantry_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["pantry", householdId] });
      queryClient.invalidateQueries({ queryKey: ["pantry-item", id] });
    },
  });
}

// ─── batch mutations (Phase 7) ────────────────────────────────────────────

/** Set the same status on N items in one call. */
export function useBatchUpdateStatus() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: ItemStatus }) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("pantry_items")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pantry", householdId] }),
  });
}

/** Soft-delete N items — sets status='discarded' so they can be restored. */
export function useBatchDeletePantryItems() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("pantry_items")
        .update({ status: "discarded" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry", householdId] });
      queryClient.invalidateQueries({ queryKey: ["pantry-recent", householdId] });
    },
  });
}

/**
 * Shift expires_on by `days` (positive = later, negative = earlier) on N items.
 * Reads current expires_on per row, computes new date, single multi-row update via RPC-style upsert.
 */
export function useBatchShiftExpiry() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, days }: { items: PantryItem[]; days: number }) => {
      if (items.length === 0) return;
      // Supabase doesn't support per-row update from a derived value in one shot;
      // we issue parallel patches (max ~30 items, fine for a weekly shop).
      const updates = items.map((it) => {
        const next = format(addDays(parseISO(it.expires_on), days), "yyyy-MM-dd");
        return supabase.from("pantry_items").update({ expires_on: next }).eq("id", it.id);
      });
      const results = await Promise.all(updates);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pantry", householdId] }),
  });
}

// ─── Recovery ─────────────────────────────────────────────────────────────

/** Recently consumed + discarded items — used for the recovery screen. */
export function useRecentItems() {
  const { data: householdId } = useHousehold();

  return useQuery({
    queryKey: ["pantry-recent", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pantry_items")
        .select("*, item_categories(*)")
        .eq("household_id", householdId!)
        .in("status", ["consumed", "discarded"])
        .order("added_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as PantryItem[];
    },
    enabled: !!householdId,
  });
}

/** Restore a consumed/discarded item back to active. */
export function useRestoreItem() {
  const { data: householdId } = useHousehold();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pantry_items")
        .update({ status: "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pantry", householdId] });
      queryClient.invalidateQueries({ queryKey: ["pantry-recent", householdId] });
    },
  });
}
