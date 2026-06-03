import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

Deno.serve(async () => {
  const today = new Date().toISOString().split("T")[0];
  const in1  = offsetDate(1);
  const in3  = offsetDate(3);

  // Find items expiring today, in 1 day, or in 3 days that haven't been notified yet.
  const { data: items, error } = await supabase
    .from("pantry_items")
    .select("id, name, expires_on, household_id, notified_0d, notified_1d, notified_3d")
    .eq("status", "active")
    .in("expires_on", [today, in1, in3]);

  if (error) return new Response(error.message, { status: 500 });

  const messages: object[] = [];
  const updates: { id: string; field: string }[] = [];

  for (const item of items ?? []) {
    const { data: members } = await supabase
      .from("household_members")
      .select("expo_push_token")
      .eq("household_id", item.household_id)
      .not("expo_push_token", "is", null);

    const tokens = (members ?? []).map((m: { expo_push_token: string }) => m.expo_push_token);
    if (!tokens.length) continue;

    if (item.expires_on === today && !item.notified_0d) {
      for (const to of tokens) messages.push({ to, title: "⚠️ Expire aujourd'hui", body: item.name, data: { item_id: item.id } });
      updates.push({ id: item.id, field: "notified_0d" });
    } else if (item.expires_on === in1 && !item.notified_1d) {
      for (const to of tokens) messages.push({ to, title: "📅 Expire demain", body: item.name, data: { item_id: item.id } });
      updates.push({ id: item.id, field: "notified_1d" });
    } else if (item.expires_on === in3 && !item.notified_3d) {
      for (const to of tokens) messages.push({ to, title: "🕐 Expire dans 3 jours", body: item.name, data: { item_id: item.id } });
      updates.push({ id: item.id, field: "notified_3d" });
    }
  }

  if (messages.length) {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
  }

  for (const { id, field } of updates) {
    await supabase.from("pantry_items").update({ [field]: true }).eq("id", id);
  }

  return new Response(JSON.stringify({ sent: messages.length }), {
    headers: { "Content-Type": "application/json" },
  });
});

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
