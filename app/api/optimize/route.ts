import { NextResponse } from "next/server";
import {
  MAX_TOKENS,
  TEMPERATURE,
  SYSTEM_PROMPT,
  buildUserPrompt,
  normalizeCvContent,
} from "@/lib/prompt";
import { parseLenientJson } from "@/lib/lenientJson";
import { enforceRateLimit } from "@/lib/rateLimit";
import { callLlm } from "@/lib/llm";
import { readSettingsFromEnv } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "optimize", 10, 60_000);
  if (limited) return limited;

  let cv: string;
  let annonce: string;
  try {
    const body = await request.json();
    cv = typeof body?.cv === "string" ? body.cv.trim() : "";
    annonce = typeof body?.annonce === "string" ? body.annonce.trim() : "";
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  if (!cv || !annonce) {
    return NextResponse.json({ error: "Le CV et l annonce sont tous les deux requis." }, { status: 400 });
  }

  const settings = readSettingsFromEnv();
  const maxOutputTokens = settings.maxTokens || MAX_TOKENS;
  const res = await callLlm({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(cv, annonce),
    maxOutputTokens,
    temperature: TEMPERATURE,
    settings,
  });

  if (!res.ok) {
    if (res.reason === "no-key") {
      return NextResponse.json({ error: `Cle API manquante pour le provider "${settings.provider}". Va dans Parametres pour la configurer.`, detail: res.detail }, { status: 500 });
    }
    if (res.reason === "no-model") {
      return NextResponse.json({ error: `Modele manquant pour le provider "${settings.provider}". Va dans Parametres pour le choisir.`, detail: res.detail }, { status: 500 });
    }
    if (res.reason === "truncated") {
      return NextResponse.json({
        error: `La generation a ete tronquee (limite de ${maxOutputTokens} tokens atteinte). Pour les grands modeles (Gemini 3.7/3.8, Claude, o1...), augmente les "Tokens de sortie max" dans Parametres (ex: 16384 ou 32768).`,
        detail: res.detail,
      }, { status: 502 });
    }
    console.error("Erreur /api/optimize:", res.reason, res.detail ?? "");
    let errorMessage = "L optimisation a echoue. Reessayez plus tard.";
    if (res.detail) {
      try {
        const parsed = typeof res.detail === "string" ? JSON.parse(res.detail) : res.detail;
        errorMessage = parsed?.error?.message || String(res.detail);
      } catch { errorMessage = String(res.detail); }
    }
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  let result;
  try {
    result = normalizeCvContent(parseLenientJson(res.text));
  } catch {
    console.error("Optimize : JSON invalide recu:", res.text.slice(0, 500));
    return NextResponse.json({ error: "Le CV optimise n a pas pu etre lu (format inattendu). Reessaie." }, { status: 502 });
  }
  return NextResponse.json({ result });
}
