"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/lib/store";
import { modelsFor, type Provider } from "@/lib/anthropic";

export default function SettingsPage() {
  const settings = useSettings();
  const [mounted, setMounted] = useState(false);
  const [draftAnthropic, setDraftAnthropic] = useState("");
  const [draftOpenrouter, setDraftOpenrouter] = useState("");

  useEffect(() => setMounted(true), []);

  const masked = (k: string) =>
    !k ? "Not set" : `${k.slice(0, 7)}${k.slice(-4)}  (${k.length} chars)`;

  const provider: Provider = mounted ? settings.provider : "anthropic";
  const currentKey =
    provider === "anthropic" ? settings.anthropicKey : settings.openrouterKey;
  const currentModel =
    provider === "anthropic" ? settings.anthropicModel : settings.openrouterModel;
  const setKey = provider === "anthropic" ? settings.setAnthropicKey : settings.setOpenrouterKey;
  const setModel = provider === "anthropic" ? settings.setAnthropicModel : settings.setOpenrouterModel;
  const draft = provider === "anthropic" ? draftAnthropic : draftOpenrouter;
  const setDraft = provider === "anthropic" ? setDraftAnthropic : setDraftOpenrouter;
  const models = modelsFor(provider);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 w-full">
      <h1 className="serif text-4xl text-[var(--ink)]">Settings</h1>
      <p className="text-[var(--ink-soft)] mt-2 text-sm">
        Your key stays in your browser. It is never sent to this site&rsquo;s server.
      </p>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Provider</h2>
        <p className="text-sm text-[var(--ink-soft)] mb-4 leading-relaxed">
          Choose which API you want to use. Anthropic gives direct access to Claude. OpenRouter routes to Claude, GPT, Gemini, Llama, and many more with one key.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {(["anthropic", "openrouter"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => settings.setProvider(p)}
              className={`text-left px-4 py-3 rounded-md border transition-colors ${
                provider === p
                  ? "border-[var(--accent)] bg-[var(--accent-tint)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--elev)]"
              }`}
            >
              <div className="text-sm font-medium text-[var(--ink)]">
                {p === "anthropic" ? "Anthropic" : "OpenRouter"}
              </div>
              <div className="text-xs text-[var(--muted)] mt-0.5">
                {p === "anthropic"
                  ? "Direct Claude API (sk-ant- keys)"
                  : "One key, many models (sk-or-v1- keys)"}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">
          {provider === "anthropic" ? "Anthropic" : "OpenRouter"} API key
        </h2>
        <p className="text-sm text-[var(--ink-soft)] mb-4 leading-relaxed">
          {provider === "anthropic" ? (
            <>
              Get a key at{" "}
              <a className="lnk" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>
              . Keys start with <code className="mono text-xs">sk-ant-</code>.
            </>
          ) : (
            <>
              Get a key at{" "}
              <a className="lnk" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                openrouter.ai/keys
              </a>
              . Keys start with <code className="mono text-xs">sk-or-v1-</code>. One key unlocks Claude, GPT, Gemini, Llama, and more.
            </>
          )}
        </p>

        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Current key</label>
          <div className="mono text-sm text-[var(--ink)] mb-4">{mounted ? masked(currentKey) : ""}</div>

          <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Paste new key</label>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-or-v1-..."}
            className="mono w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                if (draft.trim()) {
                  setKey(draft.trim());
                  setDraft("");
                }
              }}
              disabled={!draft.trim()}
              className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save key
            </button>
            {currentKey && (
              <button
                onClick={() => setKey("")}
                className="px-4 py-2 rounded-md text-sm text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Model</h2>
        <p className="text-sm text-[var(--ink-soft)] mb-4">
          Which model to use for Dialogue and Ask.
        </p>
        <div className="space-y-2">
          {models.map((m) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                currentModel === m.id ? "border-[var(--accent)] bg-[var(--accent-tint)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--elev)]"
              }`}
            >
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={mounted ? currentModel === m.id : false}
                onChange={() => setModel(m.id)}
                className="accent-[var(--accent)]"
              />
              <div>
                <div className="text-sm text-[var(--ink)] font-medium">{m.label}</div>
                <div className="text-xs text-[var(--muted)]">{m.description}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-10 text-sm text-[var(--muted)] leading-relaxed">
        <h3 className="serif text-base text-[var(--ink-soft)] mb-1">What this key is used for</h3>
        <p>
          Your browser uses the key to call the {provider === "anthropic" ? "Anthropic" : "OpenRouter"} API directly. Requests go from your machine to their servers; this site&rsquo;s code only orchestrates retrieval and prompting in the page itself. You can verify by watching the Network tab in your browser&rsquo;s dev tools.
        </p>
        <p className="mt-2">
          Return to the{" "}
          <Link href="/" className="lnk">
            home graph
          </Link>{" "}
          or browse{" "}
          <Link href="/conversations" className="lnk">
            Conversations
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
