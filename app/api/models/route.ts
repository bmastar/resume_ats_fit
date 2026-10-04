import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { listGoogleModels, listOllamaModels, listOpenAIModels } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "models", 15, 60_000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const provider = typeof body.provider === "string" ? body.provider : "";
  const rawApiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  const rawBaseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";

  try {
    if (provider === "google") {
      if (!rawApiKey) return NextResponse.json({ error: "Cle API Google manquante." }, { status: 400 });
      const models = await listGoogleModels(rawApiKey);
      return NextResponse.json({ models });
    }
    if (provider === "ollama") {
      if (!rawBaseUrl) return NextResponse.json({ error: "URL Ollama manquante." }, { status: 400 });
      const models = await listOllamaModels(rawBaseUrl, rawApiKey || undefined);
      return NextResponse.json({ models });
    }
    if (provider === "openai") {
      if (!rawBaseUrl) return NextResponse.json({ error: "URL OpenAI manquante." }, { status: 400 });
      if (!rawApiKey) return NextResponse.json({ error: "Cle API OpenAI manquante." }, { status: 400 });
      const models = await listOpenAIModels(rawBaseUrl, rawApiKey);
      return NextResponse.json({ models });
    }
    return NextResponse.json({ error: "Provider invalide. Utilise google | ollama | openai." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
