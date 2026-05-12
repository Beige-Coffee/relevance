"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, getConcepts, getEpisodes } from "@/lib/data";
import type { Course, Concept, Episode, ChatMessage, Module, ToolEventLog } from "@/lib/types";
import { useChat, useSettings } from "@/lib/store";
import { makeClientForProvider } from "@/lib/anthropic";
import { streamText, describeError } from "@/lib/stream";
import { buildModuleSystemPrompt } from "@/lib/prompts";
import { TOOLS, ToolBudget, executeTool as runTool } from "@/lib/tools";
import { RenderedText } from "@/components/rendered-text";
import { ToolTrace } from "@/components/tool-trace";

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [activeModule, setActiveModule] = useState<number>(0);

  useEffect(() => {
    Promise.all([getConcepts(), getEpisodes()]).then(([cs, es]) => {
      setConcepts(cs);
      setEpisodes(es);
    });
    getCourse(id).then(setCourse).catch(() => setCourse(null));
  }, [id]);

  if (course === undefined) return <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--muted)]">Loading...</div>;
  if (course === null) return notFound();

  const concept = concepts?.find((c) => c.id === course.conceptId);
  const eMap = new Map(episodes?.map((e) => [e.num, e]) ?? []);
  const mod = course.modules[activeModule];

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 56px)" }}
    >
      {/* Compact top header */}
      <div className="border-b border-[var(--border-soft)] px-6 py-3 shrink-0">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3 min-w-0">
            <Link
              href="/conversations"
              className="text-xs text-[var(--muted)] hover:text-[var(--accent)] shrink-0"
            >
              ← All Conversations
            </Link>
            <span className="text-[var(--muted)]">·</span>
            <h1 className="serif text-xl text-[var(--ink)] leading-tight truncate">
              {course.title}
            </h1>
            <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] shrink-0 hidden md:inline">
              {concept?.cluster ? concept.cluster.replace("-", " ") : ""}
            </span>
          </div>
          {concept && (
            <Link
              href={`/concept/${concept.id}`}
              className="text-xs text-[var(--muted)] hover:text-[var(--accent)] whitespace-nowrap"
            >
              Concept deep-dive →
            </Link>
          )}
        </div>
      </div>

      {/* Main body: modules list (narrow) | dialogue (everything else) */}
      <div className="flex-1 flex overflow-hidden min-h-0 min-w-0">
        <aside className="w-56 shrink-0 border-r border-[var(--border-soft)] px-4 py-5 overflow-y-auto min-h-0">
          <h2 className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3 px-1">
            Modules
          </h2>
          <ol className="space-y-1">
            {course.modules.map((m, i) => (
              <li key={m.id || `m-${i}`}>
                <button
                  onClick={() => setActiveModule(i)}
                  className={`w-full text-left px-3 py-2 rounded-md text-[13px] leading-snug transition-colors ${
                    i === activeModule
                      ? "bg-[var(--accent)] text-white"
                      : "hover:bg-[var(--elev)] text-[var(--ink-soft)]"
                  }`}
                >
                  <span className="mono text-[10px] opacity-70 mr-1.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {m.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <ModuleDialogue
          courseTitle={course.title}
          courseAbstract={course.abstract}
          mod={mod}
          moduleIndex={activeModule}
          totalModules={course.modules.length}
          episodesMap={eMap}
          onPrev={activeModule > 0 ? () => setActiveModule(activeModule - 1) : undefined}
          onNext={activeModule < course.modules.length - 1 ? () => setActiveModule(activeModule + 1) : undefined}
        />
      </div>
    </div>
  );
}

function ModuleDialogue({
  courseTitle,
  courseAbstract,
  mod,
  moduleIndex,
  totalModules,
  episodesMap,
  onPrev,
  onNext,
}: {
  courseTitle: string;
  courseAbstract: string;
  mod: Module;
  moduleIndex: number;
  totalModules: number;
  episodesMap: Map<number, Episode>;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { provider, activeKey, activeModel } = useSettings();
  const { messages, append, setLastContent, patchLast, isStreaming, setStreaming, reset } = useChat();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seededForRef = useRef<string | null>(null);

  // Reset chat and seed with an opener whenever the module changes.
  const moduleKey = `${courseTitle}::${moduleIndex}::${mod.id || mod.title}`;
  useEffect(() => {
    if (seededForRef.current === moduleKey) return;
    seededForRef.current = moduleKey;
    reset();
    setError(null);
    setShowAbout(false);
    const opener = mod.socraticSeeds[0]?.prompt ?? `Let's begin. ${mod.learningObjective}`;
    append({
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Let's explore **${mod.title}**.\n\n${opener}`,
      createdAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim()) return;
    const key = activeKey();
    if (!key) {
      setError("Add an API key on the Settings page to start the dialogue.");
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
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolEvents: [],
      createdAt: Date.now(),
    };
    append(assistantMsg);
    setStreaming(true);

    const budget = new ToolBudget();
    const toolEvents: ToolEventLog[] = [];

    try {
      const client = makeClientForProvider(provider, key);
      const system = buildModuleSystemPrompt(courseTitle, mod);
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      let buf = "";
      await streamText({
        client,
        model: activeModel(),
        system,
        messages: history,
        tools: TOOLS,
        executeTool: (call) => runTool(call, budget),
        onDelta: (d) => {
          buf += d;
          setLastContent(buf);
        },
        onToolEvent: (ev) => {
          if (ev.kind === "start") {
            toolEvents.push({ id: ev.id, name: ev.name, input: ev.input, done: false });
          } else {
            const idx = toolEvents.findIndex((e) => e.id === ev.id);
            if (idx >= 0) toolEvents[idx] = { ...toolEvents[idx], done: true, result: ev.result, cached: ev.cached };
          }
          patchLast({ toolEvents: [...toolEvents] });
        },
        maxTokens: 1600,
      });
    } catch (e) {
      const details = describeError(e);
      const looksLikeAuth = /401|invalid|unauthor|api.key/i.test(details);
      setError(looksLikeAuth ? `${details} (check your API key on the Settings page)` : details);
      // Also log to the devtools console with the full Error chain so it can
      // be inspected interactively.
      // eslint-disable-next-line no-console
      console.error("Dialogue send failed:", e);
    } finally {
      setStreaming(false);
    }
  }

  // Auto-grow the reply textarea up to ~10 lines so long messages stay visible.
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = next + "px";
  }

  return (
    <section className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Compact module header. The static context (title + objective + source
          passages + course abstract) lives behind an "About this module"
          toggle, so the dialogue itself owns the real estate. */}
      <header className="px-6 py-3 border-b border-[var(--border-soft)] shrink-0">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Module {moduleIndex + 1} of {totalModules}
            </div>
            <h2 className="serif text-lg text-[var(--ink)] leading-tight truncate mt-0.5">
              {mod.title}
            </h2>
          </div>
          <button
            onClick={() => setShowAbout((v) => !v)}
            className="shrink-0 text-[11px] text-[var(--muted)] hover:text-[var(--accent)] whitespace-nowrap"
          >
            {showAbout ? "Hide details ▴" : "About this module ▾"}
          </button>
        </div>

        {showAbout && (
          <div className="mt-3 pt-3 border-t border-[var(--border-soft)] space-y-3 text-[13px]">
            <p className="text-[var(--ink-soft)] italic leading-snug">
              {mod.learningObjective}
            </p>
            {mod.expositionPassages.length > 0 && (
              <div>
                <h3 className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-2">
                  Source passages ({mod.expositionPassages.length})
                </h3>
                <div className="space-y-2">
                  {mod.expositionPassages.map((p, i) => (
                    <blockquote
                      key={i}
                      className="rounded-md border-l-2 border-[var(--accent)] bg-[var(--bg-tinted)] px-3.5 py-2.5"
                    >
                      <div className="flex items-baseline gap-2 mb-1 text-[10px]">
                        <span className="mono text-[var(--accent)]">Ep {p.episode}</span>
                        <span className="text-[var(--muted)] truncate">
                          {episodesMap.get(p.episode)?.title}
                        </span>
                      </div>
                      <p className="serif italic text-[var(--ink)] leading-snug text-[14px]">
                        &ldquo;{p.phrase}&rdquo;
                      </p>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[12px] text-[var(--muted)] leading-relaxed pt-2 border-t border-[var(--border-soft)]">
              <span className="uppercase tracking-wider text-[10px]">About the course</span>
              <br />
              {courseAbstract}
            </p>
          </div>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="space-y-5 max-w-3xl mx-auto">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--accent)] text-white px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                  {m.content}
                </div>
              ) : (
                <div>
                  {m.toolEvents && m.toolEvents.length > 0 && <ToolTrace events={m.toolEvents} />}
                  {m.content ? (
                    <RenderedText text={m.content} />
                  ) : !m.toolEvents?.length ? (
                    <div className="dot-pulse"><span /><span /><span /></div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          {error && (
            <div className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent-tint)] p-3 text-sm text-[var(--ink)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--border-soft)] px-6 py-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isStreaming) send(input);
          }}
          className="flex items-end gap-2 max-w-3xl mx-auto"
        >
          <textarea
            ref={autoGrow}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (!isStreaming) send(input);
              }
            }}
            placeholder={isStreaming ? "Thinking..." : "Reply..."}
            rows={1}
            disabled={isStreaming}
            className="flex-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none text-[15px] leading-snug min-h-[40px] max-h-[240px] overflow-y-auto"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-40"
          >
            Send
          </button>
        </form>
        <div className="flex items-center justify-between mt-2 max-w-3xl mx-auto text-xs text-[var(--muted)]">
          <span>⌘+Enter to send</span>
          <div className="flex items-center gap-3">
            {onPrev && (
              <button onClick={onPrev} className="hover:text-[var(--accent)]">
                ← Previous module
              </button>
            )}
            {onNext && (
              <button onClick={onNext} className="hover:text-[var(--accent)]">
                Next module →
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
