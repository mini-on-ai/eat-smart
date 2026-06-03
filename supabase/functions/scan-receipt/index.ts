import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const CATEGORIES = [
  "Lait","Yaourt","Fromage (dur)","Fromage (mou)","Œufs","Pain",
  "Viande fraîche","Poisson frais","Légumes feuilles","Fruits tendres",
  "Fruits fermes","Légumes","Conserves","Surgelés","Épicerie sèche","Autre",
];

const SYSTEM_PROMPT = `Tu es un expert en analyse de tickets de caisse alimentaires français.
Extrait TOUS les produits alimentaires du ticket et retourne UNIQUEMENT un objet JSON valide, sans aucun texte autour, sans markdown.

Format de la réponse :
{
  "purchased_at": "YYYY-MM-DD",   // date du ticket de caisse, ou null si illisible
  "total": 87.42,                 // total TTC du ticket en EUR, ou null si illisible
  "items": [ ... ]
}

Pour chaque produit dans "items" :
- name : MARQUE + type de produit UNIQUEMENT — sans taille, sans grammage, sans conditionnement.
  Ex: "Barilla Mini Penne Rigate", "Danone Oikos Yaourt grec 0%", "Elle & Vire Crème Fraîche Épaisse", "Président Beurre Doux".
  Si la marque est lisible, elle est OBLIGATOIRE. Ne remplace jamais la marque par un nom générique.
- quantity : nombre d'unités achetées (défaut 1).
- unit : conditionnement du produit (ex. "500g", "1L", "4x125g", "250ml", "33cl") pour les produits emballés ;
  unité de vente ("kg", "g") pour les produits vendus au poids ; null si inconnu.
- category : exactement une valeur parmi ${JSON.stringify(CATEGORIES)}
- suggested_expiry_days : durée de conservation typique en jours depuis la date d'achat
- price : prix total de la ligne en EUR (numérique, ex: 4.29) ou null si illisible

RÈGLES IMPORTANTES :
1. TAILLE DANS UNIT, PAS DANS NAME — Toute indication de taille ou de conditionnement va dans \`unit\`, jamais dans \`name\`.
   Ex: "BARILLA MINI PENNE RIGATE 500G"  → name="Barilla Mini Penne Rigate",  unit="500g",   quantity=1
   Ex: "ELLE & VIRE CREME FRAICHE 50CL"  → name="Elle & Vire Crème Fraîche",  unit="50cl",   quantity=1
   Ex: "PRESIDENT BEURRE DOUX 250G"      → name="Président Beurre Doux",      unit="250g",   quantity=1
   Ex: "PENNE RIGATE 500G" (sans marque) → name="Penne Rigate",               unit="500g",   quantity=1
   NE mets JAMAIS la taille dans \`name\` : "Barilla Mini Penne Rigate" ✓, "Barilla Mini Penne Rigate 500g" ✗
2. CONDITIONNEMENT MULTIPLE — Pour les packs de type "4x125g" ou "6x33cl", le format va dans \`unit\` tel quel.
   Ex: "DANONE OIKOS YAOURT GREC 4X125G" → name="Danone Oikos Yaourt grec",   unit="4x125g", quantity=1
   Ex: "PERLE DE LAIT 4X125G"            → name="Perle de lait",               unit="4x125g", quantity=2  (si 2 boîtes achetées)
3. MULTIPLICATEURS D'ACHAT — Seules les notations "x2", "x4" séparées indiquant plusieurs articles distincts achetés changent \`quantity\`.
   Ex: "Pavé de thon x4"  → name="Pavé de thon",  unit=null, quantity=4
   Ex: "Œufs x70"         → name="Œufs",           unit=null, quantity=70
4. LIGNES ILLISIBLES — Si le texte est tronqué ou méconnaissable au point que tu ne peux pas identifier un vrai produit alimentaire, OMETS la ligne. Ne retourne JAMAIS un \`name\` qui est juste une unité ("g", "kg", "ml", "L"), un seul chiffre, ou un fragment d'un mot.
5. DÉDUPLICATION — Si le même produit apparaît sur plusieurs lignes consécutives, fusionne-les en UNE entrée et additionne les quantités et les prix.
6. Si le ticket affiche une remise ou un avoir négatif, NE l'inclus PAS comme un produit.
7. Réponse JSON UNIQUEMENT, pas de \`\`\`json\`\`\` fences.`;

type ParsedItem = {
  name: string;
  quantity: number;
  unit: string | null;
  category: string;
  suggested_expiry_days: number;
  price: number | null;
};

type ParsedReceipt = {
  purchased_at: string | null;
  total: number | null;
  items: ParsedItem[];
};

// Chunk-based base64 — avoids stack overflow on large files
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Try to extract embedded text from a digital PDF. Returns null for scanned PDFs. */
async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("npm:unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = text?.trim() ?? "";
    // A real digital receipt has hundreds of chars; scanned PDFs return near-empty strings
    return trimmed.length > 200 ? trimmed : null;
  } catch (e) {
    console.warn("[scan] PDF text extraction failed:", String(e));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const { image_path, household_id } = await req.json();
    if (!image_path || !household_id) {
      return json({ error: "image_path and household_id required" }, 400);
    }

    // ── Auth & authorisation ──────────────────────────────────────────────
    // 1. Caller must be authenticated (valid JWT).
    const callerToken = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(callerToken);
    if (!user) {
      return json({ error: "Unauthorized: valid session required" }, 401);
    }

    // 2. Caller must be a member of the target household.
    //    The function uses service-role (bypasses RLS), so we enforce this manually.
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("household_id", household_id)
      .eq("user_id", user.id)
      .single();
    if (!membership) {
      return json({ error: "Forbidden: not a member of this household" }, 403);
    }

    // 3. image_path must be scoped to the caller's household storage folder.
    //    Storage paths are structured as "{household_id}/{filename}".
    if (!image_path.startsWith(`${household_id}/`)) {
      return json({ error: "Forbidden: image_path does not belong to this household" }, 403);
    }

    // Generate signed URL to read the file
    const { data: signedData, error: signedError } = await supabase.storage
      .from("receipts")
      .createSignedUrl(image_path, 60);
    if (signedError || !signedData) return json({ error: "Image not found" }, 404);

    const fileResponse = await fetch(signedData.signedUrl);
    const fileBuffer = await fileResponse.arrayBuffer();
    const bytes = new Uint8Array(fileBuffer);
    const headerContentType = fileResponse.headers.get("content-type") ?? "";
    const isPdf =
      headerContentType.includes("pdf") || image_path.toLowerCase().endsWith(".pdf");

    // ── Build Claude message content ───────────────────────────────────────
    // Strategy:
    //   PDF + embedded text  → plain text message  (cheap, accurate)
    //   PDF + no text        → document vision block (scanned PDF fallback)
    //   Image (JPG/PNG/…)   → image vision block
    type ContentBlock = Record<string, unknown>;
    let messageContent: ContentBlock[];

    if (isPdf) {
      const pdfText = await extractPdfText(bytes);
      if (pdfText) {
        console.log(`[scan] digital PDF, text extracted: ${pdfText.length} chars`);
        messageContent = [
          {
            type: "text",
            text: `Voici le texte brut extrait d'un ticket de caisse :\n\n${pdfText}\n\nAnalyse ce ticket et retourne l'objet JSON décrit dans les instructions.`,
          },
        ];
      } else {
        console.log("[scan] scanned PDF, using vision fallback");
        const base64 = toBase64(bytes);
        messageContent = [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: "Analyse ce ticket de caisse et retourne l'objet JSON décrit dans les instructions.",
          },
        ];
      }
    } else {
      const base64 = toBase64(bytes);
      const mediaType = headerContentType.startsWith("image/")
        ? headerContentType
        : "image/jpeg";
      messageContent = [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        },
        {
          type: "text",
          text: "Analyse ce ticket de caisse et retourne l'objet JSON décrit dans les instructions.",
        },
      ];
    }

    // ── Claude API call (retry + model fallback on 529 Overloaded) ────────
    // Primary: claude-haiku-4-5 (latest, best quality)
    // Fallback: claude-3-5-haiku-20241022 (established, more available capacity)
    // Both models are identical in price and more than capable for receipt parsing.
    const MODELS = ["claude-haiku-4-5", "claude-3-haiku-20240307"];
    const claudeHeaders = {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    };

    let claudeData: Record<string, unknown> = {};
    let succeeded = false;

    for (const model of MODELS) {
      const claudeBody = JSON.stringify({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: messageContent }],
      });

      const ATTEMPTS = 3;
      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: claudeHeaders,
          body: claudeBody,
        });
        claudeData = await claudeRes.json() as Record<string, unknown>;

        const isOverloaded = claudeRes.status === 529 ||
          (claudeData as any)?.error?.type === "overloaded_error";

        if (isOverloaded) {
          if (attempt < ATTEMPTS) {
            const delay = attempt * 3000; // 3s, 6s
            console.log(`[scan] ${model} overloaded (attempt ${attempt}/${ATTEMPTS}), retrying in ${delay}ms…`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          // All retries exhausted for this model — try the next one
          console.log(`[scan] ${model} overloaded after ${ATTEMPTS} attempts, trying fallback model…`);
          break;
        }

        if (!claudeRes.ok || (claudeData as any).error) {
          throw new Error(`Claude API error [${model}]: ${JSON.stringify((claudeData as any).error ?? claudeData)}`);
        }

        console.log(`[scan] success with model: ${model}`);
        succeeded = true;
        break;
      }
      if (succeeded) break;
    }

    if (!succeeded) {
      throw new Error("Claude API overloaded on all models — please retry in a moment.");
    }

    const rawText: string = claudeData.content?.[0]?.text ?? "{}";

    // Extract JSON — Claude may (rarely) wrap in ```json``` fences
    let parsed: ParsedReceipt = { purchased_at: null, total: null, items: [] };
    try {
      const start = rawText.indexOf("{");
      const end = rawText.lastIndexOf("}");
      if (start !== -1 && end > start) {
        parsed = JSON.parse(rawText.slice(start, end + 1));
      }
    } catch (parseErr) {
      console.error("[scan] JSON parse failed:", String(parseErr));
    }

    const items: ParsedItem[] = Array.isArray(parsed.items) ? parsed.items : [];
    const purchasedAt: string | null = parsed.purchased_at ?? null;
    const total: number | null = typeof parsed.total === "number" ? parsed.total : null;

    const totalToStore = total ?? items.reduce((s, it) => s + (typeof it.price === "number" ? it.price : 0), 0);
    const { data: receipt, error: insertErr } = await supabase.from("receipts").insert({
      household_id,
      image_path,
      purchased_at: purchasedAt,
      total_amount: totalToStore || null,
      raw_llm_response: { items, purchased_at: purchasedAt, total, raw: rawText },
      status: "pending",
      scanned_by: user?.id ?? null,
    }).select("id").single();
    if (insertErr) console.error("[scan] insert error:", insertErr.message, insertErr.code);

    return json({ receipt_id: receipt?.id, items, purchased_at: purchasedAt, total }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
