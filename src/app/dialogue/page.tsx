"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings, useChat } from "@/lib/store";
import { retrieve, type RetrievalResult } from "@/lib/retrieve";
import { makeClientForProvider } from "@/lib/anthropic";
import { streamText } from "@/lib/stream";
import { SOCRATIC_SYSTEM_PROMPT, buildContextBlock } from "@/lib/prompts";
import { RenderedText } from "@/components/rendered-text";
import { ApiKeyBanner } from "@/components/api-key-banner";
import type { Citation, ChatMessage } from "@/lib/types";

const STARTER_PROMPTS = [
  "What is relevance realization, and why does it matter?",
  "I keep hearing 'agape', help me understand what makes it different from love-as-feeling.",
  "How does Vervaeke argue that science alone can't address the meaning crisis?",
  "Walk me through the cave allegory, but in his framing, not Plato's.",
];

export default function DialoguePage() {
  const { provider, activeKey, activeModel } = useSettings();
  const { messages, append, setLastContent, isStreaming, setStreaming, reset } = useChat();
  const [input, setInput] = useState("");
  const [retrieved, setRetrieved] = useState<RetrievalResult[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, retrieved]);

  async function send(text: string) {
    if (!text.trim()) return;
    const key = activeKey();
    if (!key) {
      setError("Add an API key on the Settings page to start a dialogue.");
      return;
    }
    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text.trim(),
      createdAt: Date.now(),
    };
    append(userMsg);
    setInput("");

    // Retrieve passages based on the new user message, biased by recent history.
    const history = messages
      .slice(-4)
      .map((m) => m.content)
      .join(" ");
    const retrievalQuery = `${history} ${text}`.slice(-1500);
    const results = await retrieve(retrievalQuery, 6);
    setRetrieved(results);
    const citations: Citation[] = results.map((r) => ({
      passageId: r.passage.id,
      episode: r.passage.episode,
      episodeTitle: r.passage.episodeTitle,
      excerpt: r.passage.text.slice(0, 280),
    }));

    // Add a placeholder assistant message that we stream into.
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      citations,
      createdAt: Date.now(),
    };
    append(assistantMsg);
    setStreaming(true);

    try {
      const client = makeClientForProvider(provider, key);
      const context = buildContextBlock(results.map((r) => ({ episode: r.passage.episode, text: r.passage.text })));
      const historyMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      // Replace the last user message content with one that includes context.
      const lastIdx = historyMessages.length - 1;
      historyMessages[lastIdx] = {
        role: "user",
        content: `${context}\n\n[Student says:]\n${text.trim()}`,
      };

      let buf = "";
      await streamText({
        client,
        model: activeModel(),
        system: SOCRATIC_SYSTEM_PROMPT,
        messages: historyMessages,
        onDelta: (d) => {
          buf += d;
          setLastContent(buf, citations);
        },
        maxTokens: 1800,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLastContent("(error generating response, see banner above)", citations);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-3xl mx-auto w-full px-6 pt-8 pb-2">
        <h1 className="serif text-4xl text-[var(--ink)]">Dialogue</h1>
        <p className="text-[var(--ink-soft)] mt-1 text-sm">
          A Socratic study partner that draws on the corpus. <span className="text-[var(--muted)]">It is not John Vervaeke and does not speak as him.</span>
        </p>
      </div>

      <ApiKeyBanner requiredFor="dialogue" />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {messages.length === 0 && !error && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--muted)] mb-2">Try a starter, or ask anything:</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="text-left text-sm p-3 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)] hover:bg-[var(--elev)] transition-colors text-[var(--ink-soft)]"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--ink)] text-[var(--bg)] px-4 py-3 serif text-[16px] leading-relaxed">
                  {m.content}
                </div>
              ) : (
                <article className="rounded-lg">
                  <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Atlas</div>
                  {m.content ? (
                    <RenderedText text={m.content} />
                  ) : (
                    <div className="dot-pulse"><span /><span /><span /></div>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <details className="mt-4 group">
                      <summary className="cursor-pointer text-xs text-[var(--muted)] hover:text-[var(--accent)] mono">
                        retrieved sources ({m.citations.length})
                      </summary>
                      <div className="mt-3 space-y-2">
                        {m.citations.map((c) => (
                          <div
                            key={c.passageId}
                            className="text-xs p-3 rounded-md border border-[var(--border)] bg-[var(--surface)]"
                          >
                            <div className="mono text-[var(--accent)] mb-1">
                              Episode {c.episode} <span className="text-[var(--muted)]">· {c.episodeTitle}</span>
                            </div>
                            <p className="text-[var(--ink-soft)]">{c.excerpt}…</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </article>
              )}
            </div>
          ))}

          {error && (
            <div className="rounded-md border border-[var(--accent)]/40 bg-[var(--elev)] p-3 text-sm text-[var(--ink)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur sticky bottom-0">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isStreaming) send(input);
            }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (!isStreaming) send(input);
                }
              }}
              placeholder={isStreaming ? "Thinking…" : "Type a question or thought…"}
              rows={1}
              disabled={isStreaming}
              className="flex-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none serif text-base"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="px-4 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--accent)] transition-colors disabled:opacity-40"
            >
              Send
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  reset();
                  setRetrieved([]);
                  setError(null);
                }}
                className="px-3 py-2 rounded-md text-xs text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)]"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
