import { differenceInCalendarDays, parseISO } from "date-fns";

export function daysUntilExpiry(expiresOn: string): number {
  return differenceInCalendarDays(parseISO(expiresOn), new Date());
}

export type ExpiryLevel = "fresh" | "soon" | "urgent";

export function expiryLevel(days: number): ExpiryLevel {
  if (days <= 0) return "urgent";
  if (days <= 3) return "soon";
  return "fresh";
}

export function expiryLabel(days: number): string {
  if (days < 0) return "Périmé";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}
