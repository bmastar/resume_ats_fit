import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { readSettingsFromEnv, serializeSettingsToEnv, type AppSettings, type Provider } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function envPath(): string {
  return path.join(process.cwd(), ".env.local");
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function buildSettingsFromBody(body: Record<string, unknown>): AppSettings {
  const current = readSettingsFromEnv();
  const provider = (
    typeof body.provider === "string" && ["google", "ollama", "openai"].includes(body.provider)
      ? body.provider
      : current.provider
  ) as Provider;

  const google = (body.google ?? {}) as Record<string, unknown>;
  const ollama = (body.ollama ?? {}) as Record<string, unknown>;
  const openai = (body.openai ?? {}) as Record<string, unknown>;

  // Si "model" est passe directement au premier niveau, il s'applique au provider cible
  const directModel = typeof body.model === "string" ? body.model.trim() : undefined;

  const rawMaxTokens = Number(body.maxTokens);
  const maxTokens = Number.isFinite(rawMaxTokens) && rawMaxTokens > 0
    ? rawMaxTokens
    : (current.maxTokens || 8192);

  const rawCtx = Number(body.contextWindow);
  const contextWindow = Number.isFinite(rawCtx) && rawCtx > 0
    ? rawCtx
    : (current.contextWindow || 16384);

  return {
    provider,
    maxTokens,
    contextWindow,
    google: {
      apiKey: typeof google.apiKey === "string" ? google.apiKey.trim() : current.google.apiKey,
      model: typeof google.model === "string"
        ? google.model.trim()
        : (provider === "google" && directModel !== undefined ? directModel : current.google.model),
    },
    ollama: {
      baseUrl: typeof ollama.baseUrl === "string" ? normalizeUrl(ollama.baseUrl) : current.ollama.baseUrl,
      apiKey: typeof ollama.apiKey === "string" ? ollama.apiKey.trim() : current.ollama.apiKey,
      model: typeof ollama.model === "string"
        ? ollama.model.trim()
        : (provider === "ollama" && directModel !== undefined ? directModel : current.ollama.model),
    },
    openai: {
      baseUrl: typeof openai.baseUrl === "string" ? normalizeUrl(openai.baseUrl) : current.openai.baseUrl,
      apiKey: typeof openai.apiKey === "string" ? openai.apiKey.trim() : current.openai.apiKey,
      model: typeof openai.model === "string"
        ? openai.model.trim()
        : (provider === "openai" && directModel !== undefined ? directModel : current.openai.model),
    },
  };
}

export async function GET() {
  const settings = readSettingsFromEnv();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Corps de requete invalide." }, { status: 400 });
  }

  const settings = buildSettingsFromBody(body);

  // Validation minimale (on autorise save meme si champs vides, mais provider doit etre valide)
  if (!["google", "ollama", "openai"].includes(settings.provider)) {
    return NextResponse.json({ error: "Provider invalide." }, { status: 400 });
  }

  if (settings.provider === "ollama" && settings.ollama.baseUrl) {
    try { new URL(settings.ollama.baseUrl); } catch {
      return NextResponse.json({ error: "URL Ollama invalide." }, { status: 400 });
    }
  }
  if (settings.provider === "openai" && settings.openai.baseUrl) {
    try { new URL(settings.openai.baseUrl); } catch {
      return NextResponse.json({ error: "URL OpenAI invalide." }, { status: 400 });
    }
  }

  const content = serializeSettingsToEnv(settings);
  try {
    await fs.writeFile(envPath(), content, "utf-8");
  } catch (err) {
    return NextResponse.json(
      { error: `Ecriture .env.local echouee: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  // Recharger en memoire pour ce process (Next.js ne recharge pas automatiquement .env.local)
  // On mute process.env pour que les routes suivantes dans le meme process voient la nouvelle valeur.
  process.env.PROVIDER = settings.provider;
  process.env.MAX_TOKENS = String(settings.maxTokens);
  process.env.CONTEXT_WINDOW = String(settings.contextWindow);
  process.env.OLLAMA_NUM_CTX = String(settings.contextWindow);
  process.env.GEMINI_API_KEY = settings.google.apiKey;
  process.env.GEMINI_MODEL = settings.google.model;
  process.env.MODEL = settings.google.model;
  process.env.OLLAMA_API_URL = settings.ollama.baseUrl;
  process.env.OLLAMA_API_KEY = settings.ollama.apiKey;
  process.env.OLLAMA_MODEL = settings.ollama.model;
  process.env.OPENAI_API_URL = settings.openai.baseUrl;
  process.env.OPENAI_API_KEY = settings.openai.apiKey;
  process.env.OPENAI_MODEL = settings.openai.model;

  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(request: Request) {
  return POST(request);
}
