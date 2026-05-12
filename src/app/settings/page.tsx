"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";
import { MODELS } from "@/lib/anthropic";
import Link from "next/link";

export default function SettingsPage() {
  const { apiKey, model, setApiKey, setModel, clearApiKey } = useSettings();
  const [draft, setDraft] = useState("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const masked = mounted && apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)} (${apiKey.length} chars)` : "Not set";

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 w-full">
      <h1 className="serif text-4xl text-[var(--ink)]">Settings</h1>
      <p className="text-[var(--ink-soft)] mt-2 text-sm">Your key stays in your browser. It is never sent to this site&rsquo;s server.</p>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Anthropic API key</h2>
        <p className="text-sm text-[var(--ink-soft)] mb-4 leading-relaxed">
          Required to use Dialogue and Ask. Get a key at{" "}
          <a className="lnk" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          . Keys start with <code className="mono text-xs">sk-ant-</code>.
        </p>

        <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
          <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Current key</label>
          <div className="mono text-sm text-[var(--ink)] mb-4">{mounted ? masked : "—"}</div>

          <label className="block text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Paste new key</label>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="sk-ant-…"
            className="mono w-full px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--accent)]"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                if (draft.trim()) {
                  setApiKey(draft.trim());
                  setDraft("");
                }
              }}
              disabled={!draft.trim()}
              className="px-4 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save key
            </button>
            {apiKey && (
              <button
                onClick={clearApiKey}
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
          Which Claude model to use for Dialogue and Ask. Smaller is faster and cheaper.
        </p>
        <div className="space-y-2">
          {MODELS.map((m) => (
            <label
              key={m.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer transition-colors ${
                model === m.id ? "border-[var(--accent)] bg-[var(--elev)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--elev)]"
              }`}
            >
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={mounted ? model === m.id : false}
                onChange={() => setModel(m.id)}
                className="accent-[var(--accent)]"
              />
              <div>
                <div className="text-sm text-[var(--ink)] font-medium">{m.label.split(" — ")[0]}</div>
                <div className="text-xs text-[var(--muted)]">{m.label.split(" — ")[1]}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="mt-10 text-sm text-[var(--muted)] leading-relaxed">
        <h3 className="serif text-base text-[var(--ink-soft)] mb-1">What this key is used for</h3>
        <p>
          Your browser uses the key to call the Anthropic API directly. Requests go from your machine to Anthropic&rsquo;s
          servers; this site&rsquo;s code only orchestrates retrieval and prompting in the page itself. You can verify by
          watching the Network tab in your browser&rsquo;s dev tools.
        </p>
        <p className="mt-2">
          Return to the{" "}
          <Link href="/" className="lnk">
            home page
          </Link>{" "}
          or jump straight to{" "}
          <Link href="/dialogue" className="lnk">
            dialogue
          </Link>
          {" / "}
          <Link href="/ask" className="lnk">
            ask
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
