"use client";

import { useState } from "react";
import { useSettings } from "@/lib/store";
import { retrieve, type RetrievalResult } from "@/lib/retrieve";
import { makeClientForProvider } from "@/lib/anthropic";
import { streamText } from "@/lib/stream";
import { ASK_SYSTEM_PROMPT } from "@/lib/prompts";
import { TOOLS, ToolBudget, executeTool as runTool } from "@/lib/tools";
import { PassageCard } from "@/components/passage-card";
import { RenderedText } from "@/components/rendered-text";
import { ApiKeyBanner } from "@/components/api-key-banner";
import { ToolTrace } from "@/components/tool-trace";
import type { ToolEventLog } from "@/lib/types";

interface AnswerState {
  query: string;
  results: RetrievalResult[];
  answer: string;
  streaming: boolean;
  toolEvents: ToolEventLog[];
  error?: string;
}

export default function AskPage() {
  const { provider, activeKey, activeModel } = useSettings();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<AnswerState | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const q = query.trim();
    const next: AnswerState = { query: q, results: [], answer: "", streaming: true, toolEvents: [] };
    setState(next);

    // Show the BM25 results as a side-by-side reference for the user. The
    // model will do its own look_up calls via tools regardless.
    let results: RetrievalResult[] = [];
    try {
      results = await retrieve(q, 8);
    } catch {
      // Non-fatal: the model can still synthesize via tools.
    }
    setState({ ...next, results });

    const key = activeKey();
    if (!key) {
      setState({ ...next, results, streaming: false, error: "Add an API key on the Settings page to synthesize an answer." });
      return;
    }

    const budget = new ToolBudget();
    const toolEvents: ToolEventLog[] = [];

    try {
      const client = makeClientForProvider(provider, key);
      let buf = "";
      await streamText({
        client,
        model: activeModel(),
        system: ASK_SYSTEM_PROMPT,
        messages: [{ role: "user", content: q }],
        tools: TOOLS,
        executeTool: (call) => runTool(call, budget),
        onDelta: (d) => {
          buf += d;
          setState((cur) => (cur ? { ...cur, answer: buf } : cur));
        },
        onToolEvent: (ev) => {
          if (ev.kind === "start") {
            toolEvents.push({ id: ev.id, name: ev.name, input: ev.input, done: false });
          } else {
            const idx = toolEvents.findIndex((e) => e.id === ev.id);
            if (idx >= 0) toolEvents[idx] = { ...toolEvents[idx], done: true, result: ev.result, cached: ev.cached };
          }
          setState((cur) => (cur ? { ...cur, toolEvents: [...toolEvents] } : cur));
        },
      });
      setState((cur) => (cur ? { ...cur, streaming: false } : cur));
    } catch (err) {
      setState((cur) =>
        cur ? { ...cur, streaming: false, error: err instanceof Error ? err.message : String(err) } : cur
      );
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 w-full">
      <h1 className="serif text-4xl text-[var(--ink)]">Ask</h1>
      <p className="text-[var(--ink-soft)] mt-2 text-sm">
        Where in the lectures does Vervaeke discuss something? Get a synthesized answer with episode citations.
      </p>

      <ApiKeyBanner requiredFor="synthesizing answers (search itself works without one)" />

      <form onSubmit={onSubmit} className="mt-6">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. How does Vervaeke connect relevance realization to wisdom?"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none serif text-lg"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-[var(--muted)]">⌘+Enter to submit</p>
          <button
            type="submit"
            disabled={!query.trim() || state?.streaming}
            className="px-5 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {state?.streaming ? "Searching…" : "Ask"}
          </button>
        </div>
      </form>

      {state && (
        <div className="mt-10 space-y-8">
          {state.error && (
            <div className="rounded-md border border-[var(--accent)]/40 bg-[var(--elev)] p-4 text-sm text-[var(--ink)]">
              {state.error}
            </div>
          )}

          {(state.answer || state.streaming || state.toolEvents.length > 0) && (
            <section>
              <h2 className="serif text-2xl text-[var(--ink)] mb-3">Answer</h2>
              {state.toolEvents.length > 0 && <ToolTrace events={state.toolEvents} />}
              {state.answer ? (
                <RenderedText text={state.answer} />
              ) : !state.toolEvents.length ? (
                <div className="dot-pulse text-[var(--muted)]">
                  <span /> <span /> <span />
                </div>
              ) : null}
            </section>
          )}

          {state.results.length > 0 && (
            <section>
              <h2 className="serif text-2xl text-[var(--ink)] mb-3">
                Sources <span className="text-sm text-[var(--muted)] font-normal">({state.results.length} passages)</span>
              </h2>
              <div className="space-y-3">
                {state.results.map((r) => (
                  <PassageCard key={r.passage.id} passage={r.passage} score={r.score} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
