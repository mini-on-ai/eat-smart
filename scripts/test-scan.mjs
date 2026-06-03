#!/usr/bin/env node
// Local test harness for the scan-receipt Edge Function.
// Uploads a receipt JPG to Supabase Storage, calls the deployed Edge Function,
// and pretty-prints the parsed items — no emulator needed.
//
// Usage:
//   node scripts/test-scan.mjs                              # uses default receipt
//   node scripts/test-scan.mjs ./path/to/receipt.jpg

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env manually (no dotenv dependency)
const envText = await readFile(new URL("../.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx), l.slice(idx + 1)];
    })
);

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const filePath = resolve(process.argv[2] ?? "./3-8467-1857_facture_page-0001.jpg");
console.log(`📷 ${filePath}`);

const fileBuffer = await readFile(filePath);
console.log(`   ${(fileBuffer.byteLength / 1024).toFixed(1)} KB\n`);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Pick the first household
const { data: households, error: hhErr } = await supabase
  .from("households")
  .select("id, name")
  .limit(1);
if (hhErr || !households?.length) {
  console.error("❌ No household found:", hhErr?.message ?? "empty");
  process.exit(1);
}
const householdId = households[0].id;
console.log(`🏠 household: ${households[0].name ?? householdId}`);

// Detect MIME from file extension so we can test PDFs and PNGs too.
const ext = filePath.toLowerCase().split(".").pop();
const contentTypeByExt = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
}[ext] ?? "application/octet-stream";

// Upload to storage
const imagePath = `_test/${Date.now()}.${ext}`;
console.log(`⬆️  uploading → receipts/${imagePath} (${contentTypeByExt})`);
const t0 = Date.now();
const { error: upErr } = await supabase.storage
  .from("receipts")
  .upload(imagePath, fileBuffer, { contentType: contentTypeByExt });
if (upErr) {
  console.error("❌ upload failed:", upErr.message);
  process.exit(1);
}
console.log(`   ${Date.now() - t0}ms\n`);

// Call the Edge Function
console.log(`🤖 calling Edge Function …`);
const t1 = Date.now();
const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ image_path: imagePath, household_id: householdId }),
});
const elapsed = Date.now() - t1;
const data = await res.json();

console.log(`   ${res.status} in ${elapsed}ms\n`);

if (!res.ok) {
  console.error("❌ Edge Function error:", data.error ?? data);
  // Try to fetch the raw Claude text from the receipts row, in case it was persisted
  if (data.receipt_id) {
    const { data: row } = await supabase
      .from("receipts")
      .select("raw_llm_response")
      .eq("id", data.receipt_id)
      .single();
    if (row) console.error("raw_llm_response:", JSON.stringify(row.raw_llm_response, null, 2));
  }
} else {
  const items = data.items ?? [];
  console.log(`✅ ${items.length} items · purchased_at=${data.purchased_at ?? "?"} · total=${data.total ?? "?"}€\n`);
  if (items.length > 0) {
    // Pretty print as a table
    const namePad = Math.max(...items.map((i) => i.name.length), 4);
    const catPad = Math.max(...items.map((i) => (i.category ?? "").length), 8);
    console.log(
      "  " +
        "name".padEnd(namePad) +
        "  " +
        "category".padEnd(catPad) +
        "  qty  price   expiry"
    );
    console.log(
      "  " +
        "-".repeat(namePad) +
        "  " +
        "-".repeat(catPad) +
        "  ---  ------  ------"
    );
    let priceSum = 0;
    for (const it of items) {
      if (typeof it.price === "number") priceSum += it.price;
      console.log(
        "  " +
          (it.name ?? "").padEnd(namePad) +
          "  " +
          (it.category ?? "").padEnd(catPad) +
          "  " +
          String(it.quantity ?? "").padEnd(3) +
          "  " +
          (it.price != null ? String(it.price.toFixed(2)) + "€" : "—").padEnd(6) +
          "  " +
          String(it.suggested_expiry_days ?? "") +
          "d"
      );
    }
    console.log(`\n  Σ prices = ${priceSum.toFixed(2)}€  (claimed total: ${data.total ?? "?"}€)`);
  } else {
    // Empty items — fetch the raw Claude text so we can see why
    if (data.receipt_id) {
      const { data: row } = await supabase
        .from("receipts")
        .select("raw_llm_response")
        .eq("id", data.receipt_id)
        .single();
      if (row?.raw_llm_response?.raw) {
        console.log("⚠️  raw Claude text (first 500 chars):");
        console.log(row.raw_llm_response.raw.slice(0, 500));
      }
    }
  }
}

// Cleanup the test upload
await supabase.storage.from("receipts").remove([imagePath]);
console.log(`\n🧹 cleaned up receipts/${imagePath}`);

// Also clean up the receipts row we just created — keep DB tidy
if (data.receipt_id) {
  await supabase.from("receipts").delete().eq("id", data.receipt_id);
  console.log(`🧹 deleted receipts row ${data.receipt_id}`);
}
