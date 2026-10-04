/**
 * SETTINGS — Types & helpers pour la page de parametrage
 * Stockage : fichier .env.local en clair.
 */
export type Provider = "google" | "ollama" | "openai";

export type AppSettings = {
  provider: Provider;
  maxTokens: number;
  contextWindow: number;
  google: { apiKey: string; model: string };
  ollama: { baseUrl: string; apiKey: string; model: string };
  openai: { baseUrl: string; apiKey: string; model: string };
};

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "google",
  maxTokens: 8192,
  contextWindow: 16384,
  google: { apiKey: "", model: "gemini-2.0-flash" },
  ollama: { baseUrl: "http://localhost:11434", apiKey: "", model: "" },
  openai: { baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
};

export const PROVIDER_LABELS: Record<Provider, string> = {
  google: "Google Gemini",
  ollama: "Ollama compatible",
  openai: "OpenAI Compatible",
};

export const DEFAULT_PROVIDER_MODELS: Record<Provider, string[]> = {
  google: [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
  ],
  openai: [
  ],
  ollama: [
  ],
};

function strip(v: string | undefined): string {
  return (v ?? "").trim();
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function readSettingsFromEnv(): AppSettings {
  const raw = strip(process.env.PROVIDER).toLowerCase();
  const provider: Provider = raw === "ollama" ? "ollama" : raw === "openai" ? "openai" : "google";
  const rawMaxTokens = Number(process.env.MAX_TOKENS || process.env.MAX_OUTPUT_TOKENS);
  const maxTokens = Number.isFinite(rawMaxTokens) && rawMaxTokens > 0 ? rawMaxTokens : DEFAULT_SETTINGS.maxTokens;
  const rawCtx = Number(process.env.CONTEXT_WINDOW || process.env.OLLAMA_NUM_CTX);
  const contextWindow = Number.isFinite(rawCtx) && rawCtx > 0 ? rawCtx : DEFAULT_SETTINGS.contextWindow;

  return {
    provider,
    maxTokens,
    contextWindow,
    google: {
      apiKey: strip(process.env.GEMINI_API_KEY),
      model: strip(process.env.GEMINI_MODEL),
    },
    ollama: {
      baseUrl: normalizeUrl(strip(process.env.OLLAMA_API_URL) || DEFAULT_SETTINGS.ollama.baseUrl),
      apiKey: strip(process.env.OLLAMA_API_KEY),
      model: strip(process.env.OLLAMA_MODEL),
    },
    openai: {
      baseUrl: normalizeUrl(strip(process.env.OPENAI_API_URL) || DEFAULT_SETTINGS.openai.baseUrl),
      apiKey: strip(process.env.OPENAI_API_KEY),
      model: strip(process.env.OPENAI_MODEL || DEFAULT_SETTINGS.openai.model),
    },
  };
}

export function parseEnvContent(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let value = t.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function readSettingsFromEnvMap(map: Record<string, string>): AppSettings {
  const raw = strip(map.PROVIDER).toLowerCase();
  const provider: Provider = raw === "ollama" ? "ollama" : raw === "openai" ? "openai" : "google";
  const rawMaxTokens = Number(map.MAX_TOKENS || map.MAX_OUTPUT_TOKENS);
  const maxTokens = Number.isFinite(rawMaxTokens) && rawMaxTokens > 0 ? rawMaxTokens : DEFAULT_SETTINGS.maxTokens;
  const rawCtx = Number(map.CONTEXT_WINDOW || map.OLLAMA_NUM_CTX);
  const contextWindow = Number.isFinite(rawCtx) && rawCtx > 0 ? rawCtx : DEFAULT_SETTINGS.contextWindow;

  return {
    provider,
    maxTokens,
    contextWindow,
    google: {
      apiKey: strip(map.GEMINI_API_KEY),
      model: strip(map.GEMINI_MODEL || map.MODEL || DEFAULT_SETTINGS.google.model),
    },
    ollama: {
      baseUrl: normalizeUrl(strip(map.OLLAMA_API_URL) || DEFAULT_SETTINGS.ollama.baseUrl),
      apiKey: strip(map.OLLAMA_API_KEY),
      model: strip(map.OLLAMA_MODEL),
    },
    openai: {
      baseUrl: normalizeUrl(strip(map.OPENAI_API_URL) || DEFAULT_SETTINGS.openai.baseUrl),
      apiKey: strip(map.OPENAI_API_KEY),
      model: strip(map.OPENAI_MODEL || DEFAULT_SETTINGS.openai.model),
    },
  };
}

export function serializeSettingsToEnv(s: AppSettings): string {
  const lines: string[] = [];
  lines.push("# Genere par la page Parametres — stocke en clair (non chiffre).");
  lines.push("# Ne committe jamais ce fichier (.env.local est dans .gitignore).");
  lines.push("");
  lines.push("# Provider actif : google | ollama | openai");
  lines.push(`PROVIDER=${s.provider}`);
  lines.push("");
  lines.push("# --- Fenetre de generation & contexte ---");
  lines.push(`MAX_TOKENS=${s.maxTokens || DEFAULT_SETTINGS.maxTokens}`);
  lines.push(`CONTEXT_WINDOW=${s.contextWindow || DEFAULT_SETTINGS.contextWindow}`);
  lines.push("");
  lines.push("# --- Google Gemini ---");
  lines.push(`GEMINI_API_KEY=${s.google.apiKey}`);
  lines.push(`GEMINI_MODEL=${s.google.model}`);
  lines.push("");
  lines.push("# --- Ollama compatible (endpoint natif) ---");
  lines.push(`OLLAMA_API_URL=${normalizeUrl(s.ollama.baseUrl)}`);
  lines.push(`OLLAMA_API_KEY=${s.ollama.apiKey}`);
  lines.push(`OLLAMA_MODEL=${s.ollama.model}`);
  lines.push("");
  lines.push("# --- OpenAI Compatible (via SDK openai) ---");
  lines.push(`OPENAI_API_URL=${normalizeUrl(s.openai.baseUrl)}`);
  lines.push(`OPENAI_API_KEY=${s.openai.apiKey}`);
  lines.push(`OPENAI_MODEL=${s.openai.model}`);
  lines.push("");
  return lines.join("\n");
}

export function validateSettings(s: AppSettings): string[] {
  const e: string[] = [];
  if (!["google", "ollama", "openai"].includes(s.provider)) e.push("Provider invalide.");
  if (s.provider === "google") {
    if (!s.google.apiKey) e.push("Cle API Google manquante.");
    if (!s.google.model) e.push("Modele Google manquant.");
  }
  if (s.provider === "ollama") {
    if (!s.ollama.baseUrl) e.push("URL Ollama manquante.");
    else { try { new URL(s.ollama.baseUrl); } catch { e.push("URL Ollama invalide."); } }
    if (!s.ollama.model) e.push("Modele Ollama manquant.");
  }
  if (s.provider === "openai") {
    if (!s.openai.baseUrl) e.push("URL OpenAI manquante.");
    else { try { new URL(s.openai.baseUrl); } catch { e.push("URL OpenAI invalide."); } }
    if (!s.openai.apiKey) e.push("Cle API OpenAI manquante.");
    if (!s.openai.model) e.push("Modele OpenAI manquant.");
  }
  return e;
}

export function getActiveModel(settings: AppSettings): string {
  if (settings.provider === "google") return settings.google.model;
  if (settings.provider === "ollama") return settings.ollama.model;
  return settings.openai.model;
}
