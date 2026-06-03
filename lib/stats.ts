import { differenceInDays, format, parseISO, startOfMonth, subMonths } from "date-fns";

import type { ConsumedItem } from "@/lib/hooks/useConsumedHistory";

// ─── header KPIs ──────────────────────────────────────────────────────────

export type Kpi = {
  totalSpent: number;     // EUR
  receiptCount: number;
  avgBasket: number;      // EUR
  windowMonths: number;
};

/** Total spent / receipts / avg basket over the last `windowMonths` months. */
export function computeKpis(items: ConsumedItem[], windowMonths = 3): Kpi {
  const cutoff = subMonths(new Date(), windowMonths);
  const inWindow = items.filter((i) => i.purchased_at && parseISO(i.purchased_at) >= cutoff);
  const totalSpent = inWindow.reduce((s, i) => s + (i.price ?? 0), 0);
  const receipts = new Set(inWindow.map((i) => i.receipt_id).filter(Boolean));
  return {
    totalSpent,
    receiptCount: receipts.size,
    avgBasket: receipts.size > 0 ? totalSpent / receipts.size : 0,
    windowMonths,
  };
}

// ─── top items ────────────────────────────────────────────────────────────

export type TopItem = {
  normalizedName: string;
  count: number;
  totalSpent: number;
  categoryId: number | null;
  displayName: string;
};

/** Most-purchased items, grouped by normalized_name. */
export function computeTopItems(items: ConsumedItem[], limit = 20): TopItem[] {
  const map = new Map<string, TopItem>();
  for (const i of items) {
    const key = (i.normalized_name ?? i.name).trim();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalSpent += i.price ?? 0;
    } else {
      map.set(key, {
        normalizedName: key,
        count: 1,
        totalSpent: i.price ?? 0,
        categoryId: i.category_id,
        displayName: titleCase(key),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

function titleCase(s: string): string {
  return s
    .split(" ")
    .map((w) => (w.length === 0 ? "" : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

// ─── monthly spend ────────────────────────────────────────────────────────

export type MonthlyBucket = {
  key: string;       // YYYY-MM
  label: string;     // "févr."
  spent: number;
};

/** Sum prices per month for a rolling N-month window. */
export function computeMonthlySpend(items: ConsumedItem[], months = 6): MonthlyBucket[] {
  const start = startOfMonth(subMonths(new Date(), months - 1));
  const buckets = new Map<string, MonthlyBucket>();
  for (let i = 0; i < months; i++) {
    const d = subMonths(new Date(), months - 1 - i);
    const key = format(startOfMonth(d), "yyyy-MM");
    buckets.set(key, { key, label: format(d, "LLL").replace(".", ""), spent: 0 });
  }
  for (const it of items) {
    if (!it.purchased_at || !it.price) continue;
    const d = parseISO(it.purchased_at);
    if (d < start) continue;
    const key = format(startOfMonth(d), "yyyy-MM");
    const b = buckets.get(key);
    if (b) b.spent += it.price;
  }
  return [...buckets.values()];
}

// ─── category breakdown ───────────────────────────────────────────────────

export type CategorySlice = {
  categoryId: number | null;
  name: string;
  spent: number;
  share: number;     // 0..1
};

export function computeCategoryBreakdown(
  items: ConsumedItem[],
  categories: { id: number; name: string }[],
  windowMonths = 3,
): CategorySlice[] {
  const cutoff = subMonths(new Date(), windowMonths);
  const inWindow = items.filter((i) => i.purchased_at && parseISO(i.purchased_at) >= cutoff);
  const total = inWindow.reduce((s, i) => s + (i.price ?? 0), 0);
  if (total === 0) return [];

  const byCat = new Map<number | null, number>();
  for (const i of inWindow) {
    const k = i.category_id;
    byCat.set(k, (byCat.get(k) ?? 0) + (i.price ?? 0));
  }
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));
  return [...byCat.entries()]
    .map(([id, spent]) => ({
      categoryId: id,
      name: id != null ? (catNameById.get(id) ?? "Autre") : "Sans catégorie",
      spent,
      share: spent / total,
    }))
    .sort((a, b) => b.spent - a.spent);
}

// ─── smart shopping list ──────────────────────────────────────────────────

export type ShoppingSuggestion = {
  normalizedName: string;
  displayName: string;
  categoryId: number | null;
  lastPurchased: string;     // YYYY-MM-DD
  avgIntervalDays: number;
  daysSinceLast: number;
  daysOverdue: number;       // positive = overdue
  purchaseCount: number;
};

/**
 * Returns items the user "usually buys around now":
 *   days_since_last >= 0.9 * avg_interval_between_purchases
 * Excludes anything currently in the active pantry (matching normalized name).
 *
 * Requires ≥ 2 historical purchases to estimate an interval.
 */
export function computeShoppingSuggestions(
  history: ConsumedItem[],
  activeNormalizedNames: Set<string>,
  today = new Date(),
): ShoppingSuggestion[] {
  // Group by normalized_name → sorted purchase dates
  const groups = new Map<string, { dates: Date[]; categoryId: number | null }>();
  for (const i of history) {
    const key = (i.normalized_name ?? i.name).trim();
    if (!key || !i.purchased_at) continue;
    const g = groups.get(key) ?? { dates: [], categoryId: i.category_id };
    g.dates.push(parseISO(i.purchased_at));
    if (g.categoryId == null) g.categoryId = i.category_id;
    groups.set(key, g);
  }

  const out: ShoppingSuggestion[] = [];
  for (const [key, { dates, categoryId }] of groups) {
    if (dates.length < 2) continue;                       // need ≥2 to estimate cadence
    if (activeNormalizedNames.has(key)) continue;         // already in pantry

    dates.sort((a, b) => a.getTime() - b.getTime());
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) {
      totalGap += differenceInDays(dates[i], dates[i - 1]);
    }
    const avgInterval = totalGap / (dates.length - 1);
    const lastPurchased = dates[dates.length - 1];
    const daysSince = differenceInDays(today, lastPurchased);
    if (daysSince < avgInterval * 0.9) continue;          // not due yet

    out.push({
      normalizedName: key,
      displayName: titleCase(key),
      categoryId,
      lastPurchased: format(lastPurchased, "yyyy-MM-dd"),
      avgIntervalDays: Math.round(avgInterval),
      daysSinceLast: daysSince,
      daysOverdue: Math.round(daysSince - avgInterval),
      purchaseCount: dates.length,
    });
  }
  return out.sort((a, b) => b.daysOverdue - a.daysOverdue);
}
