/**
 * LLM abstraction — Google Gemini / Ollama natif / OpenAI Compatible (SDK)
 * Utilise les settings stockes dans .env.local (via process.env).
 */
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { readSettingsFromEnv, type AppSettings } from "./settings";

export type LlmResult =
  | { ok: true; text: string }
  | { ok: false; reason: "no-key" | "no-model" | "empty" | "truncated" | "error"; detail?: string };

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function callGoogle(opts: {
  apiKey: string; model: string; system: string; user: string;
  maxOutputTokens: number; temperature: number;
}): Promise<LlmResult> {
  if (!opts.apiKey) return { ok: false, reason: "no-key", detail: "GEMINI_API_KEY manquante" };
  if (!opts.model) return { ok: false, reason: "no-model", detail: "GEMINI_MODEL manquant" };
  try {
    const ai = new GoogleGenAI({ apiKey: opts.apiKey });
    const response = await ai.models.generateContent({
      model: opts.model,
      contents: opts.user,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        maxOutputTokens: opts.maxOutputTokens,
        temperature: opts.temperature,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const finish = response.candidates?.[0]?.finishReason;
    const text = (response.text ?? "").trim();
    if (finish === "MAX_TOKENS") return { ok: false, reason: "truncated" };
    if (!text) return { ok: false, reason: "empty", detail: String(finish ?? "") };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : "inconnue" };
  }
}

async function callOllama(opts: {
  baseUrl: string; apiKey: string; model: string; system: string; user: string;
  maxOutputTokens: number; contextWindow: number; temperature: number;
}): Promise<LlmResult> {
  if (!opts.baseUrl) return { ok: false, reason: "error", detail: "OLLAMA_API_URL manquante" };
  if (!opts.model) return { ok: false, reason: "no-model", detail: "OLLAMA_MODEL manquant" };
  const base = normalizeUrl(opts.baseUrl);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (opts.apiKey) headers["Authorization"] = `Bearer ${opts.apiKey}`;
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        format: "json",
        stream: false,
        options: {
          temperature: opts.temperature,
          num_predict: opts.maxOutputTokens,
          num_ctx: opts.contextWindow,
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, reason: "error", detail: `Ollama ${res.status}: ${txt.slice(0, 500)}` };
    }
    const data = await res.json() as { message?: { content?: string }; done_reason?: string };
    const text = (data.message?.content ?? "").trim();
    if (data.done_reason === "length") return { ok: false, reason: "truncated" };
    if (!text) return { ok: false, reason: "empty", detail: String(data.done_reason ?? "") };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : "inconnue" };
  }
}

async function callOpenAICompat(opts: {
  baseUrl: string; apiKey: string; model: string; system: string; user: string;
  maxOutputTokens: number; temperature: number;
}): Promise<LlmResult> {
  if (!opts.baseUrl) return { ok: false, reason: "error", detail: "OPENAI_API_URL manquante" };
  if (!opts.apiKey) return { ok: false, reason: "no-key", detail: "OPENAI_API_KEY manquante" };
  if (!opts.model) return { ok: false, reason: "no-model", detail: "OPENAI_MODEL manquant" };
  try {
    const client = new OpenAI({ apiKey: opts.apiKey, baseURL: normalizeUrl(opts.baseUrl) });
    const isReasoning = /^(o1|o3|gpt-5)/i.test(opts.model);
    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: opts.model,
      messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }],
      response_format: { type: "json_object" },
    };
    if (isReasoning) {
      params.max_completion_tokens = opts.maxOutputTokens;
    } else {
      params.temperature = opts.temperature;
      params.max_tokens = opts.maxOutputTokens;
    }

    const completion = await client.chat.completions.create(params);
    const choice = completion.choices?.[0];
    const finish = choice?.finish_reason;
    const text = (choice?.message?.content ?? "").trim();
    if (finish === "length") return { ok: false, reason: "truncated" };
    if (!text) return { ok: false, reason: "empty", detail: String(finish ?? "") };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, reason: "error", detail: err instanceof Error ? err.message : "inconnue" };
  }
}

export async function callLlm(opts: {
  system: string; user: string; maxOutputTokens?: number; temperature: number;
  settings?: AppSettings;
}): Promise<LlmResult> {
  const settings = opts.settings ?? readSettingsFromEnv();
  const maxOutputTokens = opts.maxOutputTokens ?? settings.maxTokens ?? 8192;
  const contextWindow = settings.contextWindow ?? 16384;

  if (settings.provider === "ollama") {
    return callOllama({
      baseUrl: settings.ollama.baseUrl, apiKey: settings.ollama.apiKey, model: settings.ollama.model,
      system: opts.system, user: opts.user, maxOutputTokens, contextWindow, temperature: opts.temperature,
    });
  }
  if (settings.provider === "openai") {
    return callOpenAICompat({
      baseUrl: settings.openai.baseUrl, apiKey: settings.openai.apiKey, model: settings.openai.model,
      system: opts.system, user: opts.user, maxOutputTokens, temperature: opts.temperature,
    });
  }
  return callGoogle({
    apiKey: settings.google.apiKey, model: settings.google.model,
    system: opts.system, user: opts.user, maxOutputTokens, temperature: opts.temperature,
  });
}

export async function listGoogleModels(apiKey: string): Promise<string[]> {
  const result: string[] = [];
  try {
    const ai = new GoogleGenAI({ apiKey });
    const pager: unknown = await (ai.models as unknown as { list: () => Promise<unknown> }).list();
    const extract = (item: unknown): string | null => {
      const o = item as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : typeof o.id === "string" ? o.id : null;
      if (!name) return null;
      return name.replace(/^models\//, "");
    };
    if (Array.isArray(pager)) {
      for (const m of pager as unknown[]) { const n = extract(m); if (n) result.push(n); }
    } else if (pager && typeof pager === "object" && "models" in (pager as Record<string, unknown>)) {
      const arr = (pager as Record<string, unknown>).models;
      if (Array.isArray(arr)) for (const m of arr) { const n = extract(m); if (n) result.push(n); }
    } else if (pager && typeof (pager as unknown as Record<string|symbol, unknown>)[Symbol.asyncIterator] === "function") {
      for await (const m of pager as AsyncIterable<unknown>) { const n = extract(m); if (n) result.push(n); }
    } else if (pager && typeof (pager as unknown as Record<string|symbol, unknown>)[Symbol.iterator] === "function") {
      for (const m of pager as Iterable<unknown>) { const n = extract(m); if (n) result.push(n); }
    }
  } catch { /* fallback REST */ }
  if (result.length === 0) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Gemini ${res.status}: ${t.slice(0, 400)}`); }
    const json = await res.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    for (const m of json.models ?? []) {
      if (m.name && (!m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent"))) {
        result.push(m.name.replace(/^models\//, ""));
      }
    }
  }
  return result.sort();
}

export async function listOllamaModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  const base = normalizeUrl(baseUrl);
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${base}/api/tags`, { headers });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Ollama ${res.status}: ${t.slice(0, 400)}`); }
  const json = await res.json() as { models?: Array<{ name?: string; model?: string }> };
  const out: string[] = [];
  for (const m of json.models ?? []) { const n = m.name ?? m.model; if (n) out.push(n); }
  return out.sort();
}

export async function listOpenAIModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const client = new OpenAI({ apiKey, baseURL: normalizeUrl(baseUrl) });
  const list = await client.models.list();
  const out: string[] = [];
  for (const m of list.data) if (m.id) out.push(m.id);
  return out.sort();
}
