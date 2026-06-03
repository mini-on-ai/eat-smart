import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Nutrition, PantryItem } from "@/lib/types";

/**
 * Look up nutrition info for a pantry item.
 *
 * Strategy:
 *   1. If `item.nutrition_data` is already populated → use cache, no network.
 *   2. Otherwise call OpenFoodFacts search-by-name (free, no API key, French).
 *      Use the full item.name (richer than normalized_name) as the query.
 *      Reject the result if it shares no significant words with the query —
 *      this prevents "banane" from matching a banana yogurt, and "salade" from
 *      matching an unrelated branded product.
 *   3. If no relevant match → return null (UI shows an empty state).
 *
 * Cache is permanent (`staleTime: Infinity`) — nutrition data for "Lait demi-écrémé"
 * doesn't change. To refresh, clear `nutrition_data` directly in the DB.
 */
export function useNutrition(item: PantryItem | undefined) {
  return useQuery({
    enabled: !!item?.id,
    queryKey: ["nutrition", item?.id],
    staleTime: Infinity,
    queryFn: async (): Promise<Nutrition | null> => {
      if (!item) return null;

      // 1. Cache hit
      if (item.nutrition_data) return item.nutrition_data;

      // 2. OFF search.
      // Key insight: sending "Barilla Mini Penne Rigate 500g" to OFF confuses its
      // search engine (size suffixes act as noise). Strip them and send only the
      // meaningful words: "Barilla Mini Penne Rigate".
      const queryWords = significantWords(item.name);
      if (queryWords.length === 0) return null;
      const searchQuery = queryWords.join(" ");

      const url =
        `https://world.openfoodfacts.org/cgi/search.pl` +
        `?search_terms=${encodeURIComponent(searchQuery)}` +
        `&search_simple=1&action=process&json=1&page_size=5&lc=fr&cc=fr` +
        `&fields=code,product_name,brands,nutriscore_grade,nutriments,image_thumb_url`;

      const res = await fetch(url, {
        headers: { "User-Agent": "eat-smart/1.0 (contact@example.com)" },
      });
      if (!res.ok) return null;
      const json = await res.json();

      // Relevance check — bidirectional word overlap.
      // We match against product_name + brands combined so that e.g. "Barilla" (which
      // OFF stores in `brands`, not in `product_name`) still counts as a match.
      //   Forward  (≥ 50%): at least half the query words appear in name+brand.
      //   Reverse  (≥ 35%): at least 35% of the result's words appear in the query.
      //   The reverse check rejects "DANONE ASSIL BANANE" for query "Banane" (1/3 = 33%)
      //   and "Salade & Compagnie Manhattan Poulet Rôti" for "Salade" (1/5 = 20%).
      const p = (json.products ?? []).find((prod: { product_name?: string; brands?: string }) => {
        const combined = `${prod.product_name ?? ""} ${prod.brands ?? ""}`.toLowerCase();
        const resultWords = significantWords(combined);
        if (resultWords.length === 0) return false;

        const forwardMatches = queryWords.filter((w) => combined.includes(w));
        const forwardRatio = forwardMatches.length / queryWords.length;

        const reverseMatches = resultWords.filter((w) =>
          queryWords.some((qw) => qw.includes(w) || w.includes(qw))
        );
        const reverseRatio = reverseMatches.length / resultWords.length;

        return forwardRatio >= 0.5 && reverseRatio >= 0.35;
      });
      if (!p) return null;

      const nutrition: Nutrition = {
        off_code: String(p.code ?? ""),
        product_name: [p.brands, p.product_name].filter(Boolean).join(" — ") || null,
        nutriscore_grade: p.nutriscore_grade ?? null,
        energy_kcal_100g: numOrNull(p.nutriments?.["energy-kcal_100g"]),
        proteins_100g: numOrNull(p.nutriments?.proteins_100g),
        carbohydrates_100g: numOrNull(p.nutriments?.carbohydrates_100g),
        sugars_100g: numOrNull(p.nutriments?.sugars_100g),
        fat_100g: numOrNull(p.nutriments?.fat_100g),
        salt_100g: numOrNull(p.nutriments?.salt_100g),
        image_url: p.image_thumb_url ?? null,
      };

      // 3. Persist on the row so we never refetch
      await supabase
        .from("pantry_items")
        .update({ nutrition_data: nutrition })
        .eq("id", item.id);

      return nutrition;
    },
  });
}

/** Extract lowercase words of 4+ chars from a product name for relevance matching. */
function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    // strip digits + size suffixes so "500g" doesn't become a match token
    .replace(/\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cl|pcs?|x\d+)\b/gi, " ")
    .split(/[^a-z\xc0-\xff]+/)
    .filter((w) => w.length >= 4);
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}
