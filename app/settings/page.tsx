"use client";
import { useEffect, useState } from "react";
import type { AppSettings, Provider } from "@/lib/settings";
import Link from "next/link";

type ModelsState = { loading: boolean; error: string; list: string[] };

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showKeys, setShowKeys] = useState(false);
  const [modelsState, setModelsState] = useState<ModelsState>({ loading: false, error: "", list: [] });

  useEffect(() => {
    fetch("/api/settings").then(async (r) => {
      const data = await r.json();
      if (data.settings) setSettings(data.settings);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (settings) setModelsState({ loading: false, error: "", list: [] });
  }, [settings?.provider]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "err", text: data.error ?? "Echec de la sauvegarde." }); return; }
      setMsg({ type: "ok", text: "Parametres enregistres dans .env.local (en clair). Redemarre le serveur si necessaire." });
    } catch { setMsg({ type: "err", text: "Impossible de contacter le serveur." }); }
    finally { setSaving(false); }
  }

  async function handleLoadModels() {
    if (!settings) return;
    setModelsState({ loading: true, error: "", list: [] });
    const provider = settings.provider;
    let apiKey = "";
    let baseUrl = "";
    if (provider === "google") apiKey = settings.google.apiKey;
    else if (provider === "ollama") { apiKey = settings.ollama.apiKey; baseUrl = settings.ollama.baseUrl; }
    else { apiKey = settings.openai.apiKey; baseUrl = settings.openai.baseUrl; }
    try {
      const res = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey, baseUrl }) });
      const data = await res.json();
      if (!res.ok) { setModelsState({ loading: false, error: data.error ?? "Erreur", list: [] }); return; }
      setModelsState({ loading: false, error: "", list: data.models ?? [] });
    } catch (e) {
      setModelsState({ loading: false, error: e instanceof Error ? e.message : "Erreur reseau", list: [] });
    }
  }

  function update(path: string, value: string) {
    if (!settings) return;
    const next = structuredClone(settings) as AppSettings;
    const parts = path.split(".");
    let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) cur = cur[parts[i]] as Record<string, unknown>;
    cur[parts[parts.length - 1]] = value;
    setSettings(next);
  }

  if (loading) return <main className="container"><p style={{ color: "var(--muted)" }}>Chargement...</p></main>;
  if (!settings) return <main className="container"><p style={{ color: "var(--error)" }}>Impossible de charger les parametres.</p></main>;

  const currentModel = settings.provider === "google" ? settings.google.model : settings.provider === "ollama" ? settings.ollama.model : settings.openai.model;
  const modelPath = settings.provider === "google" ? "google.model" : settings.provider === "ollama" ? "ollama.model" : "openai.model";

  return (
    <main className="container">
      <div style={{ marginBottom: "1.2rem" }}><Link href="/" className="secondary" style={{ textDecoration: "none", padding: "0.4rem 0.9rem", border: "1px solid var(--border)", borderRadius: "0.5rem" }}>&larr; Retour accueil</Link></div>
      <header className="header">
        <h1>Parametres</h1>
        <p className="subtitle">Choisis ton provider et configure le modele. Les valeurs sont stockees en clair dans <code>.env.local</code> (non chiffre).</p>
      </header>

      <div className="settings-card">
        <div className="field">
          <label htmlFor="provider">Provider</label>
          <select id="provider" value={settings.provider} onChange={(e) => setSettings({ ...settings, provider: e.target.value as Provider })}>
            <option value="google">Google Gemini</option>
            <option value="ollama">Ollama compatible</option>
            <option value="openai">OpenAI Compatible</option>
          </select>
          <span className="label-hint">{settings.provider === "google" ? "Utilise l API Google Gemini (ModelService.ListModels)." : settings.provider === "ollama" ? "Utilise le endpoint Ollama natif {ApiUrl}/api/tags." : "Utilise le SDK OpenAI via {ApiUrl}/models."}</span>
        </div>

        {settings.provider === "google" && (
          <div className="settings-group">
            <div className="field">
              <label htmlFor="g-key">Cle API (GEMINI_API_KEY)</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input id="g-key" type={showKeys ? "text" : "password"} value={settings.google.apiKey} onChange={(e) => update("google.apiKey", e.target.value)} placeholder="AQ..." style={{ flex: 1 }} />
                <button type="button" onClick={() => setShowKeys(!showKeys)} className="secondary" style={{ whiteSpace: "nowrap" }}>{showKeys ? "Masquer" : "Afficher"}</button>
              </div>
            </div>
            <ModelField label="Modele" value={currentModel} path={modelPath} onChange={(v) => update(modelPath, v)} models={modelsState} onLoad={handleLoadModels} placeholder="gemini-2.0-flash" />
          </div>
        )}

        {settings.provider === "ollama" && (
          <div className="settings-group">
            <div className="field">
              <label htmlFor="o-url">Endpoint (OLLAMA_API_URL)</label>
              <input id="o-url" type="text" value={settings.ollama.baseUrl} onChange={(e) => update("ollama.baseUrl", e.target.value)} placeholder="http://localhost:11434" />
            </div>
            <div className="field">
              <label htmlFor="o-key">Cle API (OLLAMA_API_KEY) <span className="label-hint">optionnelle</span></label>
              <input id="o-key" type={showKeys ? "text" : "password"} value={settings.ollama.apiKey} onChange={(e) => update("ollama.apiKey", e.target.value)} placeholder="Optionnel" />
            </div>
            <ModelField label="Modele" value={currentModel} path={modelPath} onChange={(v) => update(modelPath, v)} models={modelsState} onLoad={handleLoadModels} placeholder="llama3.1" />
          </div>
        )}

        {settings.provider === "openai" && (
          <div className="settings-group">
            <div className="field">
              <label htmlFor="oa-url">Endpoint (OPENAI_API_URL)</label>
              <input id="oa-url" type="text" value={settings.openai.baseUrl} onChange={(e) => update("openai.baseUrl", e.target.value)} placeholder="https://api.openai.com/v1" />
            </div>
            <div className="field">
              <label htmlFor="oa-key">Cle API (OPENAI_API_KEY)</label>
              <input id="oa-key" type={showKeys ? "text" : "password"} value={settings.openai.apiKey} onChange={(e) => update("openai.apiKey", e.target.value)} placeholder="sk-..." />
            </div>
            <ModelField label="Modele" value={currentModel} path={modelPath} onChange={(v) => update(modelPath, v)} models={modelsState} onLoad={handleLoadModels} placeholder="gpt-4o-mini" />
          </div>
        )}

        {/* Fenetre de contexte & Generation */}
        <div className="settings-group">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>Fenêtre de contexte &amp; Génération de tokens</h3>
          </div>
          <p className="label-hint" style={{ margin: "0.25rem 0 0.8rem 0" }}>
            Indispensable pour les <strong>grands modèles</strong> (Gemini 3.7 / 3.8, Claude 3.7, o1, o3-mini...) qui consomment des tokens de réflexion (thinking / reasoning). Si la limite est trop basse, la réponse est tronquée.
          </p>

          <div className="field">
            <label htmlFor="max-tokens">
              Tokens de sortie max (MAX_TOKENS)
              <span className="label-hint"> — limite allouée à la réponse du modèle</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                id="max-tokens"
                type="number"
                min={1024}
                max={131072}
                step={1024}
                value={settings.maxTokens ?? 8192}
                onChange={(e) => setSettings({ ...settings, maxTokens: Number(e.target.value) || 8192 })}
                style={{ flex: 1, minWidth: "150px" }}
              />
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {[4096, 8192, 16384, 32768, 65536].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="secondary"
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.35rem 0.65rem",
                      background: (settings.maxTokens ?? 8192) === v ? "var(--accent)" : "transparent",
                      color: (settings.maxTokens ?? 8192) === v ? "#fff" : "var(--text)",
                      borderColor: (settings.maxTokens ?? 8192) === v ? "var(--accent)" : "var(--border)",
                    }}
                    onClick={() => setSettings({ ...settings, maxTokens: v })}
                  >
                    {v >= 1000 ? `${v / 1024}k` : v}
                  </button>
                ))}
              </div>
            </div>
            <span className="label-hint">Recommandé : <strong>8192</strong> pour usage standard, <strong>16384</strong> ou <strong>32768</strong> pour Gemini 3.7/3.8 et modèles avec thinking activé.</span>
          </div>

          <div className="field" style={{ marginTop: "0.5rem" }}>
            <label htmlFor="context-window">
              Fenêtre de contexte Ollama (num_ctx / CONTEXT_WINDOW)
              <span className="label-hint"> — taille totale prompt + réponse</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                id="context-window"
                type="number"
                min={2048}
                max={262144}
                step={2048}
                value={settings.contextWindow ?? 16384}
                onChange={(e) => setSettings({ ...settings, contextWindow: Number(e.target.value) || 16384 })}
                style={{ flex: 1, minWidth: "150px" }}
              />
              <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                {[8192, 16384, 32768, 65536, 131072].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className="secondary"
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.35rem 0.65rem",
                      background: (settings.contextWindow ?? 16384) === v ? "var(--accent)" : "transparent",
                      color: (settings.contextWindow ?? 16384) === v ? "#fff" : "var(--text)",
                      borderColor: (settings.contextWindow ?? 16384) === v ? "var(--accent)" : "var(--border)",
                    }}
                    onClick={() => setSettings({ ...settings, contextWindow: v })}
                  >
                    {`${v / 1024}k`}
                  </button>
                ))}
              </div>
            </div>
            <span className="label-hint">Ollama limite par défaut à 2048 tokens si non spécifié. Nous appliquons 16384 par défaut.</span>
          </div>
        </div>

        <div className="settings-actions">
          <button onClick={handleSave} disabled={saving} className="primary">{saving ? "Enregistrement..." : "Enregistrer dans .env.local"}</button>
          <button type="button" onClick={() => setShowKeys(!showKeys)} className="secondary">{showKeys ? "Masquer les cles" : "Afficher les cles"}</button>
        </div>
        {msg && <div className={msg.type === "ok" ? "notice" : "error"} style={{ marginTop: "0.8rem" }}>{msg.text}</div>}
        <p className="label-hint" style={{ marginTop: "0.8rem" }}>Apres enregistrement, redemarre <code>npm run dev</code> pour que Next.js recharge <code>.env.local</code> si l app tournait deja.</p>
      </div>
    </main>
  );
}

function ModelField({ label, value, onChange, models, onLoad, placeholder }: { label: string; value: string; path: string; onChange: (v: string) => void; models: ModelsState; onLoad: () => void; placeholder: string }) {
  return (
    <div className="field">
      <label>{label} {models.list.length > 0 && <span className="label-hint">({models.list.length} trouves)</span>}</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        {models.list.length > 0 ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
            <option value="">-- Choisir un modele --</option>
            {models.list.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        ) : (
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ flex: 1 }} />
        )}
        <button type="button" onClick={onLoad} disabled={models.loading} className="secondary" style={{ whiteSpace: "nowrap" }}>{models.loading ? "Chargement..." : "Charger les modeles"}</button>
      </div>
      {models.error && <span className="error" style={{ fontSize: "0.88rem", padding: "0.4rem 0.6rem" }}>{models.error}</span>}
      {models.list.length > 0 && (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ou saisir manuellement" style={{ marginTop: "0.4rem" }} />
      )}
    </div>
  );
}
