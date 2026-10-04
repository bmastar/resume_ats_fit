"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PROVIDER_LABELS,
  DEFAULT_PROVIDER_MODELS,
  getActiveModel,
  type AppSettings,
  type Provider,
} from "@/lib/settings";

export default function AiConfigBar() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState<{
    type: "ok" | "err" | "saving";
    text: string;
  } | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState("");

  // Charger les parametres au montage
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        if (!isMounted) return;
        if (data.settings) {
          setSettings(data.settings);
          await loadAvailableModels(data.settings);
        }
      } catch {
        if (isMounted) {
          setStatusMsg({
            type: "err",
            text: "Impossible de charger les paramètres de l'IA.",
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadAvailableModels(currentSettings: AppSettings) {
    const provider = currentSettings.provider;
    const activeModel = getActiveModel(currentSettings);
    const defaults = DEFAULT_PROVIDER_MODELS[provider] ?? [];

    let apiKey = "";
    let baseUrl = "";
    if (provider === "google") {
      apiKey = currentSettings.google.apiKey;
    } else if (provider === "ollama") {
      apiKey = currentSettings.ollama.apiKey;
      baseUrl = currentSettings.ollama.baseUrl;
    } else {
      apiKey = currentSettings.openai.apiKey;
      baseUrl = currentSettings.openai.baseUrl;
    }

    // Initialiser immédiatement avec les modèles par défaut + modèle actif
    const initialList = Array.from(
      new Set([activeModel, ...defaults].filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    setModels(initialList);

    // Tenter de charger la liste officielle depuis le provider si configuré
    if ((provider === "google" && apiKey) || baseUrl) {
      setLoadingModels(true);
      try {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, apiKey, baseUrl }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.models) && data.models.length > 0) {
          const merged = Array.from(
            new Set([activeModel, ...data.models, ...defaults].filter(Boolean))
          ).sort((a, b) => a.localeCompare(b));
          setModels(merged);
        }
      } catch {
        // En cas d'erreur réseau, on conserve la liste par défaut
      } finally {
        setLoadingModels(false);
      }
    }
  }

  async function handleModelChange(newModel: string) {
    if (!settings) return;
    if (newModel === "__custom__") {
      setIsCustomMode(true);
      setCustomInput("");
      return;
    }

    const currentActive = getActiveModel(settings);
    if (!newModel || newModel === currentActive) return;

    setSaving(true);
    setStatusMsg({ type: "saving", text: "Enregistrement du modèle..." });

    const updatedSettings: AppSettings = {
      ...settings,
      [settings.provider]: {
        ...settings[settings.provider],
        model: newModel,
      },
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings),
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({
          type: "err",
          text: data.error ?? "Échec de l'enregistrement.",
        });
        return;
      }

      setSettings(data.settings ?? updatedSettings);
      setStatusMsg({
        type: "ok",
        text: `Modèle mis à jour : ${newModel}`,
      });

      setTimeout(() => {
        setStatusMsg((prev) => (prev?.type === "ok" ? null : prev));
      }, 3500);
    } catch {
      setStatusMsg({
        type: "err",
        text: "Erreur réseau lors de la mise à jour.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) {
      setIsCustomMode(false);
      return;
    }

    if (!models.includes(trimmed)) {
      setModels((prev) => [trimmed, ...prev].sort((a, b) => a.localeCompare(b)));
    }
    setIsCustomMode(false);
    await handleModelChange(trimmed);
  }

  if (loading) {
    return (
      <div className="ai-config-bar" role="region" aria-label="Configuration IA active">
        <div className="ai-config-col">
          <div className="ai-config-label-row">
            <span className="ai-config-label">
              <svg
                className="ai-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Provider IA
            </span>
            <span className="ai-readonly-tag">
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Lecture seule
            </span>
          </div>
          <div className="ai-provider-display">
            <span className="ai-status-dot" style={{ opacity: 0.5 }} />
            <span className="ai-provider-name" style={{ color: "var(--muted)" }}>Chargement du provider...</span>
          </div>
        </div>

        <div className="ai-config-col ai-config-col--model">
          <div className="ai-config-label-row">
            <span className="ai-config-label">
              <svg
                className="ai-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                <path d="M12 12L2.1 12a10 10 0 0 0 9.9 10V12z" />
              </svg>
              Modèle d&apos;IA utilisé
            </span>
          </div>
          <div className="ai-model-control-group">
            <select disabled className="ai-model-select">
              <option>Chargement des modèles...</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  const activeModel = getActiveModel(settings);
  const providerLabel = PROVIDER_LABELS[settings.provider] ?? settings.provider;

  return (
    <div className="ai-config-bar" role="region" aria-label="Configuration IA active">
      {/* 1. Provider en LECTURE SEULE */}
      <div className="ai-config-col">
        <div className="ai-config-label-row">
          <span className="ai-config-label">
            <svg
              className="ai-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Provider IA
          </span>
          <span className="ai-readonly-tag" title="Le provider se modifie dans les Paramètres">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Lecture seule
          </span>
        </div>

        <div className="ai-provider-display">
          <span className="ai-status-dot" aria-hidden="true" />
          <span className="ai-provider-name">{providerLabel}</span>
          <Link
            href="/settings"
            className="ai-settings-link"
            title="Modifier le provider ou les clés d'API dans les paramètres"
          >
            Paramètres &rarr;
          </Link>
        </div>
      </div>

      {/* 2. Modèle d'IA utilisé MODIFIABLE via une sélection */}
      <div className="ai-config-col ai-config-col--model">
        <div className="ai-config-label-row">
          <label htmlFor="ai-model-select" className="ai-config-label">
            <svg
              className="ai-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
              <path d="M12 12L2.1 12a10 10 0 0 0 9.9 10V12z" />
            </svg>
            Modèle d&apos;IA utilisé
          </label>

          {statusMsg && (
            <span
              className={`ai-status-badge ai-status-badge--${statusMsg.type}`}
              role="status"
            >
              {statusMsg.text}
            </span>
          )}
        </div>

        {isCustomMode ? (
          <form onSubmit={handleCustomSubmit} className="ai-custom-model-form">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="ex: gpt-4o, gemini-2.5-pro..."
              className="ai-custom-input"
              autoFocus
            />
            <button
              type="submit"
              disabled={saving}
              className="primary ai-custom-btn"
            >
              {saving ? "Sauvegarde..." : "Valider"}
            </button>
            <button
              type="button"
              onClick={() => setIsCustomMode(false)}
              className="secondary ai-custom-btn"
            >
              Annuler
            </button>
          </form>
        ) : (
          <div className="ai-model-control-group">
            <select
              id="ai-model-select"
              value={activeModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={saving}
              className="ai-model-select"
              title="Sélectionner le modèle IA à utiliser pour l'optimisation et le scan"
            >
              {activeModel && !models.includes(activeModel) && (
                <option value={activeModel}>{activeModel} (actuel)</option>
              )}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m} {m === activeModel ? "— actif" : ""}
                </option>
              ))}
              <option disabled>──────────</option>
              <option value="__custom__">✏️ Saisir un autre modèle...</option>
            </select>

            <button
              type="button"
              onClick={() => settings && loadAvailableModels(settings)}
              disabled={loadingModels || saving}
              className="ai-refresh-btn"
              title="Recharger la liste des modèles disponibles depuis le provider"
              aria-label="Recharger les modèles"
            >
              <svg
                className={`ai-refresh-icon ${loadingModels ? "is-spinning" : ""}`}
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
