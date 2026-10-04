import { NextResponse } from "next/server";
import {
  MAX_TOKENS,
  TEMPERATURE,
  SCAN_SYSTEM_PROMPT,
  buildScanUserPrompt,
  type ScanResult,
} from "@/lib/scanPrompt";
import { parseLenientJson } from "@/lib/lenientJson";
import { enforceRateLimit } from "@/lib/rateLimit";
import { callLlm } from "@/lib/llm";
import { readSettingsFromEnv } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalize(data: unknown): ScanResult {
  const obj = (data ?? {}) as Record<string, unknown>;
  const scoreRaw = Number(obj.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 0;
  const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter((x) => x.length > 0) : [];
  const toSev = (s: string): ScanResult["problemes"][number]["severite"] => {
    const n = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (n === "elevee") return "elevee" as unknown as ScanResult["problemes"][number]["severite"];
    if (n === "moyenne") return "moyenne";
    return "faible";
  };
  // On mappe elevee sans accent vers elevee avec accent pour le type
  const mapSev = (s: string) => {
    const v = toSev(s);
    return (v === ("elevee" as unknown as string) ? "\u00e9levee" : v) as ScanResult["problemes"][number]["severite"];
  };
  const problemes = Array.isArray(obj.problemes)
    ? obj.problemes.map((p) => {
        const po = (p ?? {}) as Record<string, unknown>;
        const severite = mapSev(String(po.severite ?? ""));
        const texte = String(po.texte ?? "").trim();
        return { severite, texte };
      }).filter((p) => p.texte.length > 0)
    : [];
  return { score, pointsForts: asStringArray(obj.pointsForts), problemes, motsClesManquants: asStringArray(obj.motsClesManquants), recommandations: asStringArray(obj.recommandations) };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "scan", 10, 60_000);
  if (limited) return limited;
  let cv: string;
  let annonce: string | undefined;
  try {
    const body = await request.json();
    cv = typeof body?.cv === "string" ? body.cv.trim() : "";
    annonce = typeof body?.annonce === "string" ? body.annonce.trim() : "";
  } catch { return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 }); }
  if (!cv) return NextResponse.json({ error: "Le CV est requis." }, { status: 400 });
  const settings = readSettingsFromEnv();
  const maxOutputTokens = settings.maxTokens || MAX_TOKENS;
  const res = await callLlm({ system: SCAN_SYSTEM_PROMPT, user: buildScanUserPrompt(cv, annonce), maxOutputTokens, temperature: TEMPERATURE, settings });
  if (!res.ok) {
    if (res.reason === "no-key") return NextResponse.json({ error: `Cle API manquante pour le provider "${settings.provider}". Va dans Parametres pour la configurer.`, detail: res.detail }, { status: 500 });
    if (res.reason === "no-model") return NextResponse.json({ error: `Modele manquant pour le provider "${settings.provider}". Va dans Parametres pour le choisir.`, detail: res.detail }, { status: 500 });
    if (res.reason === "truncated") {
      return NextResponse.json({
        error: `La reponse a ete tronquee (limite de ${maxOutputTokens} tokens atteinte). Pour les grands modeles (Gemini 3.7/3.8, Claude, o1...), augmente les "Tokens de sortie max" dans Parametres (ex: 16384 ou 32768).`,
        detail: res.detail,
      }, { status: 502 });
    }
    console.error("Erreur /api/scan:", res.reason, res.detail ?? "");
    let errorMessage = "Le scan a echoue. Reessaie dans un instant.";
    if (res.detail) { try { const parsed = typeof res.detail === "string" ? JSON.parse(res.detail) : res.detail; errorMessage = parsed?.error?.message || String(res.detail); } catch { errorMessage = String(res.detail); } }
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }
  let result: ScanResult;
  try { result = normalize(parseLenientJson(res.text)); } catch { console.error("Scan : JSON invalide:", res.text.slice(0, 500)); return NextResponse.json({ error: "Le diagnostic n a pas pu etre lu (format inattendu). Reessaie." }, { status: 502 }); }
  return NextResponse.json({ result });
}
