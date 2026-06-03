#!/usr/bin/env node
// Bulk-import historical receipts from ./receipts/ (PDFs or JPGs).
// Each receipt is uploaded to Supabase Storage, sent to the scan-receipt
// Edge Function, and its items are inserted into pantry_items as
// status='consumed' so they don't appear in the active pantry but DO feed
// stats and the smart shopping list.
//
// Usage:  node scripts/import-historical-receipts.mjs

import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ─── env loading (same pattern as test-scan.mjs) ──────────────────────────
const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split("\n").map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)]; })
);
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── normalize name ───────────────────────────────────────────────────────
// "Yaourt grec citron 4x125g" → "yaourt grec citron"
// "Lait Mflactel 1L"          → "lait mflactel"
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?\s*(?:g|kg|ml|l|cl|pcs?|pc)\b/gi, "")
    .replace(/\bx\s*\d+/gi, "")
    // Allow letters (incl. accented + œ + ç), digits, spaces, and hyphens.
    .replace(/[^a-z0-9\sàâäéèêëïîôöùûüçœ-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── pick the test household ──────────────────────────────────────────────
const { data: households, error: hhErr } = await supabase
  .from("households")
  .select("id, name")
  .limit(1);
if (hhErr || !households?.length) {
  console.error("❌ No household found:", hhErr?.message ?? "empty");
  process.exit(1);
}
const householdId = households[0].id;
console.log(`🏠 household: ${households[0].name ?? householdId}\n`);

// ─── enumerate receipts/ ──────────────────────────────────────────────────
const dir = resolve(new URL("../receipts", import.meta.url).pathname);
let files;
try {
  files = (await readdir(dir))
    .filter((f) => !f.startsWith(".") && /\.(pdf|jpg|jpeg|png)$/i.test(f))
    .sort();
} catch (e) {
  console.error(`❌ Could not read ${dir}:`, e.message);
  console.error("   Download the 11 historical receipts from Google Drive into receipts/ first.");
  process.exit(1);
}
console.log(`📂 ${files.length} files to process in ${dir}\n`);

// ─── main loop ────────────────────────────────────────────────────────────
let totalItems = 0;
let grandTotal = 0;
const processed = [];

for (const filename of files) {
  const fullPath = resolve(dir, filename);
  const fileBuffer = await readFile(fullPath);
  const fileStats = await stat(fullPath);
  const ext = extname(filename).slice(1).toLowerCase();
  const contentType = ext === "pdf" ? "application/pdf"
    : ext === "png" ? "image/png"
    : "image/jpeg";

  // Upload to storage under _historical/<filename>
  const storagePath = `_historical/${Date.now()}-${basename(filename)}`;
  console.log(`📷 ${filename}  (${(fileBuffer.byteLength / 1024).toFixed(0)} KB)`);
  const { error: upErr } = await supabase.storage
    .from("receipts")
    .upload(storagePath, fileBuffer, { contentType, upsert: false });
  if (upErr) {
    console.error(`   ❌ upload: ${upErr.message}\n`);
    continue;
  }

  // Call Edge Function
  const t0 = Date.now();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ image_path: storagePath, household_id: householdId }),
  });
  const data = await res.json();
  const elapsed = Date.now() - t0;

  if (!res.ok) {
    console.error(`   ❌ Edge Function ${res.status}: ${data.error ?? JSON.stringify(data)}\n`);
    continue;
  }

  const items = data.items ?? [];
  // Fall back to the file mtime if Claude couldn't read the date.
  const purchasedAt = data.purchased_at ?? fileStats.mtime.toISOString().slice(0, 10);
  const lineSum = items.reduce((s, it) => s + (typeof it.price === "number" ? it.price : 0), 0);
  console.log(`   → ${items.length} items · ${purchasedAt} · ${lineSum.toFixed(2)}€  (${elapsed}ms)`);

  // Update the receipts row with purchased_at / total_amount / status=confirmed
  await supabase.from("receipts")
    .update({
      purchased_at: purchasedAt,
      total_amount: data.total ?? lineSum,
      status: "confirmed",
    })
    .eq("id", data.receipt_id);

  // Look up category ids by name once, share across all items
  const { data: categories } = await supabase
    .from("item_categories")
    .select("id, name");
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

  // Insert items as status='consumed' so they don't appear in the active pantry.
  const rows = items.map((item) => {
    const categoryId = catByName.get(String(item.category ?? "").toLowerCase()) ?? null;
    const expiresOnDays = item.suggested_expiry_days ?? 7;
    const purchaseDate = new Date(purchasedAt);
    const expiresOn = new Date(purchaseDate.getTime() + expiresOnDays * 86400000)
      .toISOString().slice(0, 10);
    return {
      household_id: householdId,
      name: item.name,
      category_id: categoryId,
      quantity: item.quantity ?? 1,
      unit: item.unit ?? null,
      expires_on: expiresOn,
      status: "consumed",
      receipt_id: data.receipt_id,
      added_by: null,  // service-role import, no specific user
      price: item.price ?? null,
      purchased_at: purchasedAt,
      normalized_name: normalizeName(item.name),
    };
  });

  // pantry_items.added_by is NOT NULL → need a real user. Use the household's first member.
  if (rows.length > 0) {
    const { data: member } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .limit(1)
      .single();
    const userId = member?.user_id;
    if (!userId) {
      console.error("   ❌ no household member found, cannot set added_by");
      continue;
    }
    for (const r of rows) r.added_by = userId;
    const { error: insErr } = await supabase.from("pantry_items").insert(rows);
    if (insErr) {
      console.error(`   ❌ pantry insert: ${insErr.message}\n`);
      continue;
    }
  }

  totalItems += items.length;
  grandTotal += lineSum;
  processed.push({ filename, purchasedAt, items: items.length, total: lineSum });
}

console.log(`\n✅ ${processed.length}/${files.length} receipts processed`);
console.log(`   ${totalItems} items, total ${grandTotal.toFixed(2)}€`);
console.log(`\n📊 Verify:`);
console.log(`   select count(*), sum(price) from pantry_items where status='consumed';`);
