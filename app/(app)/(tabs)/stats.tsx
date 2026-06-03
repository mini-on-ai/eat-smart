import * as React from "react";
import { useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";

import { useConsumedHistory } from "@/lib/hooks/useConsumedHistory";
import { useCategories } from "@/lib/hooks/useCategories";
import {
  computeCategoryBreakdown,
  computeKpis,
  computeMonthlySpend,
  computeTopItems,
} from "@/lib/stats";

const COLORS = [
  "#3F8F5C", "#C8553D", "#D9A441", "#3A6F84",
  "#7A5EA0", "#A07A2C", "#4A5FA0", "#5C7B57",
  "#9C5E8A", "#7A7568", "#A04A36", "#3D7575",
];

export default function StatsScreen() {
  const { data: history, isLoading } = useConsumedHistory();
  const { data: categories } = useCategories();

  const kpis = useMemo(() => computeKpis(history ?? [], 3), [history]);
  const topItems = useMemo(() => computeTopItems(history ?? [], 15), [history]);
  const monthly = useMemo(() => computeMonthlySpend(history ?? [], 6), [history]);
  const breakdown = useMemo(
    () => computeCategoryBreakdown(history ?? [], categories ?? [], 3),
    [history, categories],
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center" edges={["top"]}>
        <ActivityIndicator color="#3F8F5C" />
      </SafeAreaView>
    );
  }

  if (!history || history.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-4xl mb-3">📊</Text>
          <Text className="text-base text-ink text-center font-semibold">
            Pas encore de données
          </Text>
          <Text className="text-sm text-ink-faint text-center mt-2">
            Scanne quelques tickets pour voir tes statistiques apparaître ici.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[11px] font-semibold uppercase tracking-widest text-ink-faint">
          {kpis.windowMonths} derniers mois
        </Text>
        <Text className="text-2xl font-semibold text-ink mt-0.5" style={{ letterSpacing: -0.5 }}>
          Statistiques
        </Text>

        {/* KPI row */}
        <View className="flex-row gap-3 mt-5">
          <KpiCard label="Dépensé" value={`${kpis.totalSpent.toFixed(0)}€`} />
          <KpiCard label="Tickets" value={String(kpis.receiptCount)} />
          <KpiCard label="Panier moyen" value={`${kpis.avgBasket.toFixed(0)}€`} />
        </View>

        {/* Monthly spend chart */}
        <SectionTitle>Dépenses par mois</SectionTitle>
        <MonthlyBars data={monthly} />

        {/* Category breakdown */}
        <SectionTitle>Par catégorie</SectionTitle>
        <CategoryBar slices={breakdown} />

        {/* Top items */}
        <SectionTitle>Top articles</SectionTitle>
        <TopItemsList items={topItems} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── pieces ───────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className="text-[12px] font-semibold uppercase tracking-widest text-ink-faint mt-7 mb-3"
    >
      {children}
    </Text>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="flex-1 rounded-2xl bg-card border border-borderSoft px-3 py-4"
      style={{ minHeight: 78 }}
    >
      <Text className="text-[11px] text-ink-faint">{label}</Text>
      <Text className="text-2xl font-semibold text-ink mt-1" style={{ letterSpacing: -0.5 }}>
        {value}
      </Text>
    </View>
  );
}

function MonthlyBars({ data }: { data: ReturnType<typeof computeMonthlySpend> }) {
  const maxSpent = Math.max(...data.map((d) => d.spent), 1);
  const chartWidth = 320;
  const chartHeight = 140;
  const padding = { top: 18, right: 4, bottom: 22, left: 32 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;
  const barW = innerW / data.length - 8;

  return (
    <View className="rounded-2xl bg-card border border-borderSoft p-4">
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Y-axis label (max) */}
        <SvgText x={4} y={padding.top + 4} fontSize="9" fill="#9A9A91">
          {Math.round(maxSpent)}€
        </SvgText>
        <Line
          x1={padding.left} y1={padding.top + innerH}
          x2={padding.left + innerW} y2={padding.top + innerH}
          stroke="#E6E5DF" strokeWidth="1"
        />
        {data.map((d, i) => {
          const h = (d.spent / maxSpent) * innerH;
          const x = padding.left + i * (innerW / data.length) + 4;
          const y = padding.top + innerH - h;
          return (
            <React.Fragment key={d.key}>
              <Rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={3} fill="#3F8F5C" />
              {d.spent > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize="9"
                  fill="#1A1A17"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {Math.round(d.spent)}
                </SvgText>
              )}
              <SvgText
                x={x + barW / 2}
                y={chartHeight - 6}
                fontSize="10"
                fill="#7A7568"
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function CategoryBar({ slices }: { slices: ReturnType<typeof computeCategoryBreakdown> }) {
  if (slices.length === 0) {
    return (
      <View className="rounded-2xl bg-card border border-borderSoft p-4">
        <Text className="text-sm text-ink-faint">Pas de prix renseignés.</Text>
      </View>
    );
  }
  return (
    <View className="rounded-2xl bg-card border border-borderSoft p-4 gap-3">
      {/* Stacked bar */}
      <View className="flex-row h-3 rounded-full overflow-hidden" style={{ gap: 1 }}>
        {slices.map((s, i) => (
          <View
            key={String(s.categoryId)}
            style={{ flex: s.share, backgroundColor: COLORS[i % COLORS.length] }}
          />
        ))}
      </View>
      {/* Legend */}
      <View className="gap-1.5">
        {slices.slice(0, 6).map((s, i) => (
          <View key={String(s.categoryId)} className="flex-row items-center gap-2">
            <View
              style={{
                width: 10, height: 10, borderRadius: 3,
                backgroundColor: COLORS[i % COLORS.length],
              }}
            />
            <Text className="text-sm text-ink flex-1" numberOfLines={1}>{s.name}</Text>
            <Text className="text-sm text-ink-soft">{s.spent.toFixed(0)}€</Text>
            <Text className="text-xs text-ink-faint w-10 text-right">
              {Math.round(s.share * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function TopItemsList({ items }: { items: ReturnType<typeof computeTopItems> }) {
  const maxCount = items[0]?.count ?? 1;
  return (
    <View className="rounded-2xl bg-card border border-borderSoft p-2">
      {items.map((it, i) => (
        <View
          key={it.normalizedName}
          className="flex-row items-center px-3 py-2.5"
          style={{
            borderBottomWidth: i === items.length - 1 ? 0 : 1,
            borderBottomColor: "#F0EFEA",
          }}
        >
          <View className="flex-1 min-w-0 pr-3">
            <Text className="text-[14px] font-medium text-ink" numberOfLines={1}>
              {it.displayName}
            </Text>
            {/* mini bar */}
            <View className="h-1 mt-1.5 rounded-full bg-borderSoft">
              <View
                style={{
                  height: 4, borderRadius: 2,
                  width: `${(it.count / maxCount) * 100}%`,
                  backgroundColor: "#3F8F5C",
                }}
              />
            </View>
          </View>
          <View className="items-end">
            <Text className="text-[14px] font-semibold text-ink">{it.count}×</Text>
            {it.totalSpent > 0 && (
              <Text className="text-[11px] text-ink-faint">
                {it.totalSpent.toFixed(2)}€
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

