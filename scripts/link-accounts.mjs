#!/usr/bin/env node
// Link faty*, kiroz*, and sanae* accounts into a single shared household.
//
// Safe to run multiple times — all operations are idempotent.
// Migration 0007 already merged kiroz + sanae. This script handles faty
// (and re-validates that kiroz/sanae are still correct).
//
// Usage:  node scripts/link-accounts.mjs
// Requires: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

// ─── env loading (same pattern as import-historical-receipts.mjs) ──────────
const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── 1. List all auth users ────────────────────────────────────────────────
console.log("🔍  Listing auth users…");
const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
if (listErr) {
  console.error("❌  listUsers failed:", listErr.message);
  process.exit(1);
}

const TARGET_PREFIXES = ["faty", "kiroz", "sanae"];
const targetUsers = users.filter((u) =>
  TARGET_PREFIXES.some((p) => u.email?.toLowerCase().startsWith(p))
);

if (targetUsers.length === 0) {
  console.error("❌  No users found matching faty/kiroz/sanae. Check email prefixes.");
  console.error("    All user emails:", users.map((u) => u.email).join(", "));
  process.exit(1);
}

console.log(`\n👤  Target users (${targetUsers.length}):`);
for (const u of targetUsers) {
  console.log(`    ${u.email}  →  ${u.id}`);
}

// ─── 2. Find which households these users belong to ────────────────────────
const userIds = targetUsers.map((u) => u.id);

const { data: memberships, error: memErr } = await supabase
  .from("household_members")
  .select("household_id, user_id, role")
  .in("user_id", userIds);
if (memErr) {
  console.error("❌  Could not fetch memberships:", memErr.message);
  process.exit(1);
}

const householdIds = [...new Set(memberships.map((m) => m.household_id))];
console.log(`\n🏠  Distinct households: ${householdIds.length}`);
for (const id of householdIds) {
  const members = memberships.filter((m) => m.household_id === id);
  const emails = members.map((m) => targetUsers.find((u) => u.id === m.user_id)?.email ?? m.user_id);
  console.log(`    ${id}  [${emails.join(", ")}]`);
}

if (householdIds.length === 0) {
  console.error("❌  No households found for target users. Have they signed in yet?");
  process.exit(1);
}

if (householdIds.length === 1) {
  console.log("\n✅  All target users are already in one household. Nothing to do.");
  process.exit(0);
}

// ─── 3. Pick the canonical household (most pantry_items = most data) ───────
const pantryCountsByHousehold = await Promise.all(
  householdIds.map(async (hhId) => {
    const { count } = await supabase
      .from("pantry_items")
      .select("*", { count: "exact", head: true })
      .eq("household_id", hhId);
    return { hhId, count: count ?? 0 };
  })
);
pantryCountsByHousehold.sort((a, b) => b.count - a.count);
const canonicalId = pantryCountsByHousehold[0].hhId;

console.log("\n📊  Pantry item counts per household:");
for (const { hhId, count } of pantryCountsByHousehold) {
  const marker = hhId === canonicalId ? "  ← CANONICAL (will keep this one)" : "";
  console.log(`    ${hhId}  ${count} items${marker}`);
}

// ─── 4. Merge each doomed household into the canonical one ─────────────────
const doomedIds = householdIds.filter((id) => id !== canonicalId);

for (const doomedId of doomedIds) {
  console.log(`\n🔀  Merging household ${doomedId} → ${canonicalId}`);

  // 4a. Add all members of the doomed household into the canonical one.
  const doomedMembers = memberships.filter((m) => m.household_id === doomedId);
  for (const m of doomedMembers) {
    const email = targetUsers.find((u) => u.id === m.user_id)?.email ?? m.user_id;
    const { error: insertErr } = await supabase
      .from("household_members")
      .insert({ household_id: canonicalId, user_id: m.user_id, role: m.role });

    if (insertErr && insertErr.code === "23505") {
      console.log(`   ↩️   ${email} already a member of canonical household (skipped)`);
    } else if (insertErr) {
      console.error(`   ❌  Insert member ${email}: ${insertErr.message}`);
      process.exit(1);
    } else {
      console.log(`   ✅  Added ${email} as ${m.role}`);
    }
  }

  // 4b. Move pantry_items.
  const { error: pantryErr } = await supabase
    .from("pantry_items")
    .update({ household_id: canonicalId })
    .eq("household_id", doomedId);
  if (pantryErr) {
    console.error(`   ❌  Move pantry_items: ${pantryErr.message}`);
    process.exit(1);
  }
  const { count: leftover } = await supabase
    .from("pantry_items")
    .select("*", { count: "exact", head: true })
    .eq("household_id", doomedId);
  console.log(`   📦  pantry_items moved (${leftover ?? 0} remaining in doomed — should be 0)`);

  // 4c. Move receipts.
  const { error: receiptsErr } = await supabase
    .from("receipts")
    .update({ household_id: canonicalId })
    .eq("household_id", doomedId);
  if (receiptsErr) {
    console.error(`   ❌  Move receipts: ${receiptsErr.message}`);
    process.exit(1);
  }
  console.log(`   🧾  Receipts moved`);

  // 4d. Move shopping_list_items (if any).
  const { error: shopErr } = await supabase
    .from("shopping_list_items")
    .update({ household_id: canonicalId })
    .eq("household_id", doomedId);
  if (shopErr && shopErr.code !== "23505") {
    // 23505 = unique conflict on (household_id, normalized_name) — safe to ignore
    console.error(`   ❌  Move shopping_list_items: ${shopErr.message}`);
    process.exit(1);
  }
  console.log(`   🛒  Shopping list items moved`);

  // 4e. Delete the doomed household (CASCADE removes its household_members row).
  const { error: deleteErr } = await supabase
    .from("households")
    .delete()
    .eq("id", doomedId);
  if (deleteErr) {
    console.error(`   ❌  Delete household ${doomedId}: ${deleteErr.message}`);
    process.exit(1);
  }
  console.log(`   🗑️   Household ${doomedId} deleted`);
}

// ─── 5. Verification ───────────────────────────────────────────────────────
console.log("\n✅  Merge complete. Verifying…\n");

const { data: finalMembers } = await supabase
  .from("household_members")
  .select("user_id, role")
  .eq("household_id", canonicalId);

console.log(`🏠  Canonical household ${canonicalId}`);
console.log(`    Members (${finalMembers?.length ?? 0}):`);
for (const m of finalMembers ?? []) {
  const email = users.find((u) => u.id === m.user_id)?.email ?? m.user_id;
  console.log(`      ${email}  (${m.role})`);
}

const { count: finalPantry } = await supabase
  .from("pantry_items")
  .select("*", { count: "exact", head: true })
  .eq("household_id", canonicalId);

const { count: finalReceipts } = await supabase
  .from("receipts")
  .select("*", { count: "exact", head: true })
  .eq("household_id", canonicalId);

console.log(`\n    pantry_items : ${finalPantry ?? 0}`);
console.log(`    receipts     : ${finalReceipts ?? 0}`);
console.log("\n🎉  Done.");
