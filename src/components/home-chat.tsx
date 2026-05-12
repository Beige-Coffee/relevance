"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useThread, useSettings, useChatThreads } from "@/lib/store";
import { makeClientForProvider } from "@/lib/anthropic";
import { streamText, describeError } from "@/lib/stream";
import { SOCRATIC_SYSTEM_PROMPT, buildModuleSystemPrompt } from "@/lib/prompts";
import { TOOLS, ToolBudget, executeTool as runTool } from "@/lib/tools";
import { getCourse } from "@/lib/data";
import type {
  ChatMessage,
  ToolEventLog,
  GraphNode,
  Concept,
  Person,
  Course,
  CourseSummary,
} from "@/lib/types";
import type { GraphMode } from "./graph-canvas";
import { RenderedText } from "./rendered-text";
import { ToolTrace } from "./tool-trace";

interface Props {
  selected: GraphNode | null;
  mode: GraphMode;
  concepts: Concept[];
  people: Person[];
  courses: CourseSummary[];
  onClearSelected: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const STARTER_PROMPTS = [
  "What is relevance realization, in a sentence?",
  "Where does Vervaeke contrast agape with eros?",
  "How does he define the meaning crisis?",
  "Suggest a place to start if I have not watched the series.",
];

export function HomeChat({
  selected,
  mode,
  concepts,
  people,
  courses,
  onClearSelected,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const { provider, activeKey, activeModel, hasKey, enterToSend, setEnterToSend } = useSettings();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);
  // Guard against hydration mismatch: settings are read from localStorage
  // synchronously on the client but are not available on the server, so
  // conditional UI keyed on those settings has to wait one render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // When a Conversation is running inside this panel, hold the full Course
  // and which module is currently in focus.
  const [activeConversation, setActiveConversation] = useState<{ course: Course; moduleIndex: number } | null>(null);

  // Pick a thread key for the current topic. Threads are persisted per-key
  // so users can come back to a concept or a Conversation module and pick
  // up where they left off.
  const threadKey = activeConversation
    ? `course:${activeConversation.course.id}:${activeConversation.moduleIndex}`
    : selected?.kind === "concept"
      ? `home:concept:${selected.id.replace(/^concept:/, "")}`
      : selected?.kind === "person"
        ? `home:person:${selected.id.replace(/^person:/, "")}`
        : "home:free";
  const { messages, append, setLastContent, patchLast, isStreaming, setStreaming, reset } = useThread(threadKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Resizable panel width. Default 400px; persisted to localStorage.
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 900;
  const [chatWidth, setChatWidth] = useState<number>(400);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = Number(localStorage.getItem("home-chat-width"));
    if (Number.isFinite(saved) && saved >= MIN_WIDTH) {
      setChatWidth(Math.min(saved, Math.min(MAX_WIDTH, window.innerWidth - 200)));
    }
  }, []);

  // Re-clamp if the browser window resizes (otherwise a saved wide chat
  // overflows on a now-narrow window and content is clipped off-screen).
  useEffect(() => {
    function onWindowResize() {
      const max = Math.min(MAX_WIDTH, window.innerWidth - 200);
      setChatWidth((w) => Math.max(MIN_WIDTH, Math.min(max, w)));
    }
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, []);

  // Persist width after it changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("home-chat-width", String(chatWidth));
  }, [chatWidth]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.userSelect = "none";
  }

  function onResizeMove(e: React.MouseEvent) {
    if (!isResizing) return;
    const maxForViewport = Math.min(MAX_WIDTH, window.innerWidth - 200);
    const next = Math.max(MIN_WIDTH, Math.min(maxForViewport, window.innerWidth - e.clientX));
    setChatWidth(next);
  }

  function endResize() {
    if (!isResizing) return;
    setIsResizing(false);
    document.body.style.userSelect = "";
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Resolve the selected GraphNode to its concept or person record.
  const selectedConcept = selected?.kind === "concept"
    ? concepts.find((c) => c.id === selected.id.replace(/^concept:/, "")) ?? null
    : null;
  const selectedPerson = selected?.kind === "person"
    ? people.find((p) => p.id === selected.id.replace(/^person:/, "")) ?? null
    : null;
  const selectedCourse = selectedConcept
    ? courses.find((cr) => cr.conceptId === selectedConcept.id)
    : null;

  function seedModule(course: Course, moduleIndex: number) {
    const mod = course.modules[moduleIndex];
    const opener = mod.socraticSeeds[0]?.prompt ?? `Let's begin. ${mod.learningObjective}`;
    append({
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Let's explore **${mod.title}**.\n\n${opener}`,
      createdAt: Date.now(),
    });
  }

  // Seed the module opener when entering a Conversation thread that has no
  // history yet. If the user has been here before (persisted thread), the
  // opener is already in messages and we leave it alone. Read thread state
  // imperatively so React Strict Mode's double-mount doesn't double-seed.
  useEffect(() => {
    if (!activeConversation) return;
    const current = useChatThreads.getState().threads[threadKey] ?? [];
    if (current.length > 0) return;
    seedModule(activeConversation.course, activeConversation.moduleIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadKey]);

  async function beginConversation(courseSummary: CourseSummary) {
    if (loadingCourseId) return;
    setError(null);
    setLoadingCourseId(courseSummary.id);
    try {
      const course = await getCourse(courseSummary.id);
      // Don't reset: if the user has an existing thread for this course's
      // first module, keep it. The useEffect above will seed if empty.
      setActiveConversation({ course, moduleIndex: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCourseId(null);
    }
  }

  function switchModule(nextIndex: number) {
    if (!activeConversation) return;
    if (nextIndex < 0 || nextIndex >= activeConversation.course.modules.length) return;
    // Don't reset: switch to a different module's persisted thread; the
    // useEffect above will seed it if it's empty.
    setActiveConversation({ ...activeConversation, moduleIndex: nextIndex });
  }

  function exitConversation() {
    // Drop out of conversation mode but DON'T wipe the thread; user can
    // come back to it later.
    setActiveConversation(null);
    setError(null);
  }

  function clearChat() {
    reset();
    setError(null);
    if (activeConversation) {
      // Re-seed the opener since the useEffect won't re-fire (threadKey
      // didn't change). Defer one microtask so the reset's state update
      // commits first.
      const course = activeConversation.course;
      const idx = activeConversation.moduleIndex;
      queueMicrotask(() => seedModule(course, idx));
    }
  }

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
      const system = activeConversation
        ? buildModuleSystemPrompt(
            activeConversation.course.title,
            activeConversation.course.modules[activeConversation.moduleIndex],
          )
        : buildSystem({ mode, selectedConcept, selectedPerson });
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
        onDelta: (d) => { buf += d; setLastContent(buf); },
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
      // eslint-disable-next-line no-console
      console.error("Dialogue send failed:", e);
    } finally {
      setStreaming(false);
    }
  }

  // Auto-grow the reply textarea so long messages stay visible.
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = next + "px";
  }

  if (collapsed) {
    return (
      <aside className="h-full w-12 shrink-0 border-l border-[var(--border)] bg-[var(--surface)]/95 flex flex-col items-center py-3">
        <button
          onClick={onToggleCollapsed}
          aria-label="Expand chat"
          className="w-9 h-9 rounded-md text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)] flex items-center justify-center"
          title="Expand chat"
        >
          ‹
        </button>
        <div className="mt-3 vertical-text text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
          Dialogue
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* While dragging, this fixed overlay sits above the graph canvas and
          owns all pointer events so the canvas can not eat them. */}
      {isResizing && (
        <div
          className="fixed inset-0 z-[100]"
          style={{ cursor: "col-resize" }}
          onMouseMove={onResizeMove}
          onMouseUp={endResize}
          onMouseLeave={endResize}
        />
      )}
      <aside
        className="relative h-full shrink-0 bg-[var(--surface)] flex flex-col min-h-0"
        style={{ width: chatWidth }}
      >
        {/* Resize handle doubles as the left border. 8px transparent hit zone
            with a 1px visible line on the inside edge that highlights on hover. */}
        <div
          onMouseDown={startResize}
          onDoubleClick={() => setChatWidth(400)}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-20 group"
          aria-label="Resize chat panel (double-click to reset)"
          title="Drag to resize. Double-click to reset."
        >
          <span className={`absolute inset-y-0 left-0 w-px ${isResizing ? "bg-[var(--accent)] w-[2px]" : "bg-[var(--border)] group-hover:bg-[var(--accent)] group-hover:w-[2px]"} transition-all`} />
        </div>
      <header className="px-4 py-3 border-b border-[var(--border-soft)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onToggleCollapsed}
            aria-label="Collapse chat"
            className="w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)] flex items-center justify-center shrink-0"
            title="Collapse"
          >
            ›
          </button>
          {activeConversation ? (
            <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--accent)] truncate">
              Conversation
            </span>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">Dialogue</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
            >
              Clear
            </button>
          )}
          {activeConversation && (
            <button
              onClick={exitConversation}
              className="text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {activeConversation ? (
        <div className="px-4 py-2 border-b border-[var(--border-soft)] bg-[var(--bg-tinted)]">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {activeConversation.course.title}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <button
              onClick={() => switchModule(activeConversation.moduleIndex - 1)}
              disabled={activeConversation.moduleIndex === 0 || isStreaming}
              className="w-5 h-5 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)] disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
              aria-label="Previous module"
              title="Previous module"
            >
              ‹
            </button>
            <span className="text-[var(--ink-soft)]">
              Module {activeConversation.moduleIndex + 1} of {activeConversation.course.modules.length}
              <span className="mx-1.5 text-[var(--muted)]">·</span>
              <span className="text-[var(--ink)] font-medium">
                {activeConversation.course.modules[activeConversation.moduleIndex].title}
              </span>
            </span>
            <button
              onClick={() => switchModule(activeConversation.moduleIndex + 1)}
              disabled={activeConversation.moduleIndex >= activeConversation.course.modules.length - 1 || isStreaming}
              className="ml-auto w-5 h-5 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)] disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-center"
              aria-label="Next module"
              title="Next module"
            >
              ›
            </button>
          </div>
        </div>
      ) : (selectedConcept || selectedPerson) && (
        <div className="px-4 py-2 border-b border-[var(--border-soft)] bg-[var(--bg-tinted)] flex items-center gap-2 text-xs">
          <span className="text-[var(--muted)]">Discussing:</span>
          {selectedConcept && (
            <Link href={`/concept/${selectedConcept.id}`} className="text-[var(--accent)] font-medium hover:underline truncate">
              {selectedConcept.canonicalName}
            </Link>
          )}
          {selectedPerson && (
            <Link href={`/person/${selectedPerson.id}`} className="text-[var(--accent)] font-medium hover:underline truncate">
              {selectedPerson.canonicalName}
            </Link>
          )}
          <button
            onClick={onClearSelected}
            aria-label="Clear anchor"
            className="ml-auto w-5 h-5 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)] flex items-center justify-center"
            title="Clear anchor"
          >
            ×
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          selectedConcept && selectedCourse ? (
            <ConversationOffer
              concept={selectedConcept}
              course={selectedCourse}
              loading={loadingCourseId === selectedCourse.id}
              onBegin={() => beginConversation(selectedCourse)}
            />
          ) : selectedConcept ? (
            <NodeIntro
              kind="concept"
              name={selectedConcept.canonicalName}
              tag={formatClusterLabel(selectedConcept.cluster)}
              description={selectedConcept.definition}
              href={`/concept/${selectedConcept.id}`}
            />
          ) : selectedPerson ? (
            <NodeIntro
              kind="person"
              name={selectedPerson.canonicalName}
              tag={null}
              description={selectedPerson.shortBio}
              extra={selectedPerson.roleInArgument}
              href={`/person/${selectedPerson.id}`}
            />
          ) : (
            <EmptyState onStarter={send} canChat={mounted && Boolean(hasKey())} />
          )
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-[var(--accent)] text-white px-3.5 py-2 text-[14px] leading-relaxed whitespace-pre-wrap">
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
        )}
      </div>

      <div className="border-t border-[var(--border-soft)] px-3 py-3">
      <form
        onSubmit={(e) => { e.preventDefault(); if (!isStreaming) send(input); }}
        className="flex items-end gap-2"
      >
        <textarea
          ref={autoGrow}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow(e.currentTarget);
          }}
          onKeyDown={(e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (enterToSend && e.key === "Enter" && !e.shiftKey && !mod) {
              e.preventDefault();
              if (!isStreaming) send(input);
            } else if (!enterToSend && mod && e.key === "Enter") {
              e.preventDefault();
              if (!isStreaming) send(input);
            }
          }}
          placeholder={
            isStreaming
              ? "Thinking..."
              : activeConversation
                ? "Reply..."
                : selectedConcept
                  ? `Ask about ${selectedConcept.canonicalName}...`
                  : selectedPerson
                    ? `Ask about ${selectedPerson.canonicalName}...`
                    : "Ask anything..."
          }
          rows={1}
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none text-sm leading-snug min-h-[36px] max-h-[240px] overflow-y-auto"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="px-3 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </form>
        <button
          onClick={() => setEnterToSend(!enterToSend)}
          className="mt-2 text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
          title="Click to switch send shortcut"
        >
          {enterToSend ? "Enter to send (Shift+Enter for newline)" : "⌘+Enter to send"}
        </button>
      </div>
      </aside>
    </>
  );
}

function formatClusterLabel(cluster: string): string {
  // "cognitive-science" -> "Cognitive science"
  const spaced = cluster.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function NodeIntro({
  kind,
  name,
  tag,
  description,
  extra,
  href,
}: {
  kind: "concept" | "person";
  name: string;
  tag: string | null;
  description: string;
  extra?: string;
  href: string;
}) {
  const kindLabel = kind === "concept" ? "Concept" : "Thinker";
  const cardLabel = kind === "concept" ? "Open the concept card →" : "Open the thinker card →";
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-1">
          {kindLabel}
          {tag && (
            <>
              <span className="mx-1.5 text-[var(--muted)]">·</span>
              <span>{tag}</span>
            </>
          )}
        </div>
        <h3 className="serif text-xl text-[var(--ink)] leading-tight">{name}</h3>
        <p className="text-[13px] text-[var(--ink-soft)] mt-1.5 leading-relaxed">
          {description}
        </p>
        {extra && (
          <p className="text-[12px] text-[var(--muted)] mt-2 leading-relaxed italic">
            {extra}
          </p>
        )}
        <Link
          href={href}
          className="inline-block mt-2 text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
        >
          {cardLabel}
        </Link>
      </div>

      <p className="text-[11px] text-[var(--muted)] leading-relaxed">
        Type a question below to chat about {name}, grounded in the corpus.
      </p>
    </div>
  );
}

function ConversationOffer({
  concept,
  course,
  loading,
  onBegin,
}: {
  concept: Concept;
  course: CourseSummary;
  loading: boolean;
  onBegin: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-1">
          Flagship concept
        </div>
        <h3 className="serif text-xl text-[var(--ink)] leading-tight">
          {concept.canonicalName}
        </h3>
        <p className="text-[13px] text-[var(--ink-soft)] mt-1.5 leading-relaxed">
          {concept.definition}
        </p>
        <Link
          href={`/concept/${concept.id}`}
          className="inline-block mt-2 text-[11px] text-[var(--muted)] hover:text-[var(--accent)]"
        >
          Open the concept card →
        </Link>
      </div>

      <div className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)] p-3.5">
        <p className="text-[13px] text-[var(--ink)] leading-relaxed">
          There&rsquo;s a guided <strong>Conversation</strong> on this concept: {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"} of Socratic dialogue grounded in the transcripts. It runs here in this panel.
        </p>
        <button
          onClick={onBegin}
          disabled={loading}
          className="mt-3 inline-flex items-center justify-center w-full px-3 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-60 disabled:cursor-wait"
        >
          {loading ? "Loading..." : "Begin the Conversation →"}
        </button>
      </div>

      <p className="text-[11px] text-[var(--muted)] leading-relaxed">
        Or type a question below for freeform chat about {concept.canonicalName}.
      </p>
    </div>
  );
}

function EmptyState({ onStarter, canChat }: { onStarter: (s: string) => void; canChat: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="serif text-base text-[var(--ink)] leading-snug">Welcome.</p>
        <p className="text-sm text-[var(--ink-soft)] mt-1.5 leading-relaxed">
          Ask anything about Vervaeke&rsquo;s lecture series, or click a node on the graph to explore that idea together. The dialogue is grounded in the actual transcripts and will cite episodes inline.
        </p>
      </div>
      {!canChat ? (
        <div className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)] p-3 text-xs text-[var(--ink-soft)]">
          Add an API key on the{" "}
          <Link href="/settings" className="text-[var(--accent)] underline">
            Settings page
          </Link>{" "}
          to start chatting. Your key stays in your browser.
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Try one of these</div>
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => onStarter(p)}
              className="block w-full text-left text-xs px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-tinted)] hover:border-[var(--accent)] hover:bg-[var(--elev)] text-[var(--ink-soft)] transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function buildSystem({
  mode,
  selectedConcept,
  selectedPerson,
}: {
  mode: GraphMode;
  selectedConcept: Concept | null;
  selectedPerson: Person | null;
}): string {
  const orientation = `\n\nSITE ORIENTATION:
You live inside the "relevance" app, an unaffiliated educational study tool for John Vervaeke's lecture series "Awakening from the Meaning Crisis." The student is currently viewing a force-directed graph of concepts and thinkers in the corpus.

- Current graph view: ${mode === "concepts" ? "Concepts" : "Thinkers"}.
- The student can also browse Conversations (pre-curated multi-module walkthroughs on flagship concepts at /conversation/[id]), individual episode overviews (/episode/[num]), and full concept or thinker pages (/concept/[id], /person/[id]).
- They may ask about specific nodes they have clicked, or ask freeform questions about the corpus. Either is fine.`;

  let anchor = "";
  if (selectedConcept) {
    anchor = `\n\nCURRENTLY SELECTED NODE (concept):
The student clicked the concept "${selectedConcept.canonicalName}" (id: ${selectedConcept.id}, cluster: ${selectedConcept.cluster}, depth: ${selectedConcept.depth}).
Brief definition: ${selectedConcept.definition}
${selectedConcept.isFlagship ? "This is a flagship concept; a pre-curated Conversation exists for it." : ""}
If they want to discuss it, call read_concept('${selectedConcept.id}') to get the full canonical entry first.`;
  } else if (selectedPerson) {
    anchor = `\n\nCURRENTLY SELECTED NODE (thinker):
The student clicked the thinker "${selectedPerson.canonicalName}" (id: ${selectedPerson.id}).
Brief bio: ${selectedPerson.shortBio}
Role in Vervaeke's argument: ${selectedPerson.roleInArgument}
Episodes where Vervaeke discusses them: ${selectedPerson.discussedIn.join(", ")}.
If they want to discuss this thinker, ground your answer in the corpus via the tools.`;
  }

  return SOCRATIC_SYSTEM_PROMPT + orientation + anchor;
}
