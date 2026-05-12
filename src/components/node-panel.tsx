"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Concept, Person, Episode, CourseSummary, ChatMessage, GraphNode } from "@/lib/types";
import { useChat, useSettings } from "@/lib/store";
import { makeClientForProvider } from "@/lib/anthropic";
import { streamText } from "@/lib/stream";
import { retrieve } from "@/lib/retrieve";
import { SOCRATIC_SYSTEM_PROMPT, buildContextBlock } from "@/lib/prompts";
import { RenderedText } from "./rendered-text";

type Mode = "details" | "chat" | "conversation";

interface Props {
  node: GraphNode | null;
  concepts: Concept[];
  people: Person[];
  episodes: Episode[];
  courses: CourseSummary[];
  onClose: () => void;
  onOpenConversation: (conceptId: string) => void;
}

export function NodePanel({ node, concepts, people, episodes, courses, onClose, onOpenConversation }: Props) {
  const [mode, setMode] = useState<Mode>("details");
  const [chatSeed, setChatSeed] = useState<string>("");

  useEffect(() => {
    setMode("details");
    setChatSeed("");
  }, [node?.id]);

  if (!node) return null;

  const cMap = new Map(concepts.map((x) => [x.id, x]));
  const pMap = new Map(people.map((x) => [x.id, x]));
  const eMap = new Map(episodes.map((x) => [x.num, x]));
  const courseFor = (cid: string) => courses.find((cr) => cr.conceptId === cid);

  if (node.kind === "concept") {
    const id = node.id.replace(/^concept:/, "");
    const c = cMap.get(id);
    if (!c) return <PanelShell onClose={onClose}><p className="text-[var(--muted)]">Concept not found.</p></PanelShell>;
    const course = courseFor(c.id);

    return (
      <PanelShell onClose={onClose} kind="concept" title={c.canonicalName} flagship={c.isFlagship}>
        {mode === "details" && (
          <ConceptDetails
            concept={c}
            cMap={cMap}
            pMap={pMap}
            eMap={eMap}
            hasCourse={Boolean(course)}
            onDiscuss={(seed) => { setChatSeed(seed); setMode("chat"); }}
            onOpenConversation={() => course && onOpenConversation(course.id)}
          />
        )}
        {mode === "chat" && (
          <ChatThread
            seed={chatSeed}
            anchor={`${c.canonicalName}: ${c.definition}`}
            onBack={() => setMode("details")}
          />
        )}
      </PanelShell>
    );
  }

  if (node.kind === "person") {
    const id = node.id.replace(/^person:/, "");
    const p = pMap.get(id);
    if (!p) return <PanelShell onClose={onClose}><p className="text-[var(--muted)]">Person not found.</p></PanelShell>;
    return (
      <PanelShell onClose={onClose} kind="person" title={p.canonicalName}>
        {mode === "details" && (
          <PersonDetails
            person={p}
            cMap={cMap}
            eMap={eMap}
            onDiscuss={(seed) => { setChatSeed(seed); setMode("chat"); }}
          />
        )}
        {mode === "chat" && (
          <ChatThread
            seed={chatSeed}
            anchor={`${p.canonicalName}: ${p.shortBio}`}
            onBack={() => setMode("details")}
          />
        )}
      </PanelShell>
    );
  }

  return null;
}

function PanelShell({
  children,
  onClose,
  kind,
  title,
  flagship,
}: {
  children: React.ReactNode;
  onClose: () => void;
  kind?: "concept" | "person";
  title?: string;
  flagship?: boolean;
}) {
  return (
    <aside className="slide-in-right h-full w-full sm:w-[440px] flex flex-col bg-[var(--surface)] border-l border-[var(--border)] overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border-soft)]">
        <div className="min-w-0">
          {kind && (
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">
              {kind}{flagship ? " · flagship" : ""}
            </div>
          )}
          {title && <h2 className="serif text-[1.4rem] leading-tight text-[var(--ink)] truncate">{title}</h2>}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-7 h-7 rounded-md text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--elev)] flex items-center justify-center"
        >
          ×
        </button>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
    </aside>
  );
}

function ConceptDetails({
  concept: c,
  cMap,
  pMap,
  eMap,
  hasCourse,
  onDiscuss,
  onOpenConversation,
}: {
  concept: Concept;
  cMap: Map<string, Concept>;
  pMap: Map<string, Person>;
  eMap: Map<number, Episode>;
  hasCourse: boolean;
  onDiscuss: (seed: string) => void;
  onOpenConversation: () => void;
}) {
  const epPill = (n: number) => (
    <Link key={n} href={`/episode/${n}`} className="cite-pill" title={eMap.get(n)?.title}>
      Ep {n}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="text-xs text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1">
        <span>{c.cluster}</span>
        <span>depth {c.depth}</span>
        <Link href={`/concept/${c.id}`} className="ml-auto text-[var(--accent)] hover:underline">
          Open full page
        </Link>
      </div>

      <p className="prose-reader text-[15px]">{c.definition}</p>

      {hasCourse && (
        <button
          onClick={onOpenConversation}
          className="w-full px-4 py-2.5 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors"
        >
          Start the Conversation
        </button>
      )}

      <Section label="Source passage">
        <Quote ep={c.sourcePassage.episode} epTitle={eMap.get(c.sourcePassage.episode)?.title}>
          {c.sourcePassage.quote}
        </Quote>
        <DiscussButton onClick={() => onDiscuss(`Help me understand the source passage for "${c.canonicalName}": "${c.sourcePassage.quote.slice(0, 200)}..." (Ep ${c.sourcePassage.episode})`)} />
      </Section>

      {c.notes && (
        <Section label="Notes">
          <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed">{c.notes}</p>
        </Section>
      )}

      <Section label="Where it appears">
        <div className="space-y-1.5 text-sm">
          <div><span className="text-[var(--muted)] text-xs">Introduced: </span>{epPill(c.introducedIn)}</div>
          {c.developedIn.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[var(--muted)] text-xs self-center mr-1">Developed: </span>
              {c.developedIn.map(epPill)}
            </div>
          )}
          {c.appliedIn.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[var(--muted)] text-xs self-center mr-1">Applied: </span>
              {c.appliedIn.map(epPill)}
            </div>
          )}
        </div>
      </Section>

      {c.subConcepts && c.subConcepts.length > 0 && (
        <Section label={`Sub-concepts (${c.subConcepts.length})`}>
          <div className="space-y-2">
            {c.subConcepts.map((sc) => (
              <details key={sc.id} className="rounded-md border border-[var(--border-soft)] bg-[var(--bg-tinted)]">
                <summary className="cursor-pointer px-3 py-2 text-sm text-[var(--ink)] hover:text-[var(--accent)]">
                  {sc.name}
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-[13px] text-[var(--ink-soft)]">{sc.summary}</p>
                  {sc.passages?.map((pp, i) => (
                    <Quote key={i} ep={pp.episode} epTitle={eMap.get(pp.episode)?.title} small>
                      {pp.phrase}
                    </Quote>
                  ))}
                  <DiscussButton
                    small
                    onClick={() => onDiscuss(`Walk me through the sub-concept "${sc.name}" of "${c.canonicalName}": ${sc.summary}`)}
                  />
                </div>
              </details>
            ))}
          </div>
        </Section>
      )}

      {c.commonConfusions && c.commonConfusions.length > 0 && (
        <Section label="Common confusions">
          <ul className="space-y-2 text-sm text-[var(--ink-soft)]">
            {c.commonConfusions.map((cc, i) => (
              <li key={i} className="leading-relaxed">{cc}</li>
            ))}
          </ul>
        </Section>
      )}

      {c.keyPassages && c.keyPassages.length > 0 && (
        <Section label="Key passages">
          <div className="space-y-2">
            {c.keyPassages.slice(0, 6).map((kp, i) => (
              <Quote key={i} ep={kp.episode} epTitle={eMap.get(kp.episode)?.title} role={kp.role}>
                {kp.phrase}
              </Quote>
            ))}
          </div>
        </Section>
      )}

      {(c.prerequisites.length > 0 || c.relatedConcepts.length > 0 || (c.contrastedWith ?? []).length > 0) && (
        <Section label="Adjacent concepts">
          <div className="space-y-2 text-sm">
            {c.prerequisites.length > 0 && (
              <div><span className="text-[var(--muted)] text-xs mr-1">Prereqs: </span>{c.prerequisites.map((cid) => {
                const t = cMap.get(cid);
                return t ? (
                  <Link key={cid} href={`/concept/${cid}`} className="cite-pill mr-1">{t.canonicalName}</Link>
                ) : null;
              })}</div>
            )}
            {c.relatedConcepts.length > 0 && (
              <div><span className="text-[var(--muted)] text-xs mr-1">Related: </span>{c.relatedConcepts.map((cid) => {
                const t = cMap.get(cid);
                return t ? (
                  <Link key={cid} href={`/concept/${cid}`} className="cite-pill mr-1">{t.canonicalName}</Link>
                ) : null;
              })}</div>
            )}
            {(c.contrastedWith ?? []).length > 0 && (
              <div><span className="text-[var(--muted)] text-xs mr-1">Contrast: </span>{(c.contrastedWith ?? []).map((cid) => {
                const t = cMap.get(cid);
                return t ? (
                  <Link key={cid} href={`/concept/${cid}`} className="cite-pill mr-1">{t.canonicalName}</Link>
                ) : null;
              })}</div>
            )}
          </div>
        </Section>
      )}

      {c.associatedPeople.length > 0 && (
        <Section label="Associated thinkers">
          <div className="flex flex-wrap gap-1.5">
            {c.associatedPeople.map((pid) => {
              const t = pMap.get(pid);
              return t ? (
                <Link key={pid} href={`/person/${pid}`} className="cite-pill">{t.canonicalName}</Link>
              ) : null;
            })}
          </div>
        </Section>
      )}

      <div className="pt-4 border-t border-[var(--border-soft)]">
        <button
          onClick={() => onDiscuss(`Help me think through the concept "${c.canonicalName}". ${c.definition}`)}
          className="w-full px-4 py-2.5 rounded-md border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent-tint)] transition-colors"
        >
          Discuss this concept
        </button>
      </div>
    </div>
  );
}

function PersonDetails({
  person: p,
  cMap,
  eMap,
  onDiscuss,
}: {
  person: Person;
  cMap: Map<string, Concept>;
  eMap: Map<number, Episode>;
  onDiscuss: (seed: string) => void;
}) {
  const epPill = (n: number) => (
    <Link key={n} href={`/episode/${n}`} className="cite-pill" title={eMap.get(n)?.title}>
      Ep {n}
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="text-xs text-[var(--muted)] flex justify-end">
        <Link href={`/person/${p.id}`} className="text-[var(--accent)] hover:underline">Open full page</Link>
      </div>

      <p className="prose-reader text-[15px]">{p.shortBio}</p>

      <Section label="Role in Vervaeke's argument">
        <p className="text-[14px] text-[var(--ink-soft)] leading-relaxed">{p.roleInArgument}</p>
      </Section>

      <Section label="Where they appear">
        <div className="space-y-1.5 text-sm">
          <div><span className="text-[var(--muted)] text-xs">Introduced: </span>{epPill(p.introducedIn)}</div>
          {p.discussedIn.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[var(--muted)] text-xs self-center mr-1">Discussed: </span>
              {p.discussedIn.map(epPill)}
            </div>
          )}
        </div>
      </Section>

      {p.keyClaimsAbout.length > 0 && (
        <Section label="What Vervaeke says about them">
          <ul className="space-y-2 text-sm text-[var(--ink-soft)]">
            {p.keyClaimsAbout.map((c, i) => (
              <li key={i} className="leading-relaxed">{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {p.associatedConcepts.length > 0 && (
        <Section label="Associated concepts">
          <div className="flex flex-wrap gap-1.5">
            {p.associatedConcepts.map((cid) => {
              const t = cMap.get(cid);
              return t ? (
                <Link key={cid} href={`/concept/${cid}`} className="cite-pill">{t.canonicalName}</Link>
              ) : null;
            })}
          </div>
        </Section>
      )}

      <div className="pt-4 border-t border-[var(--border-soft)]">
        <button
          onClick={() => onDiscuss(`Tell me how Vervaeke engages with ${p.canonicalName}. ${p.roleInArgument}`)}
          className="w-full px-4 py-2.5 rounded-md border border-[var(--accent)] text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent-tint)] transition-colors"
        >
          Discuss this thinker
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-2">{label}</h3>
      {children}
    </section>
  );
}

function Quote({
  ep,
  epTitle,
  children,
  role,
  small,
}: {
  ep: number;
  epTitle?: string;
  children: React.ReactNode;
  role?: string;
  small?: boolean;
}) {
  return (
    <blockquote className={`rounded-md border-l-2 border-[var(--accent)] bg-[var(--bg-tinted)] ${small ? "px-3 py-2" : "px-3.5 py-2.5"}`}>
      <div className="flex items-baseline gap-2 mb-1 text-[10px]">
        <span className="mono text-[var(--accent)]">Ep {ep}</span>
        {epTitle && <span className="text-[var(--muted)] truncate">{epTitle}</span>}
        {role && <span className="ml-auto mono text-[var(--muted)] uppercase tracking-wider">{role}</span>}
      </div>
      <p className={`serif italic text-[var(--ink)] leading-snug ${small ? "text-[13px]" : "text-[14px]"}`}>
        &ldquo;{children}&rdquo;
      </p>
    </blockquote>
  );
}

function DiscussButton({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`mt-2 text-[var(--accent)] hover:underline ${small ? "text-[11px]" : "text-xs"}`}
    >
      Discuss this →
    </button>
  );
}

function ChatThread({ seed, anchor, onBack }: { seed: string; anchor: string; onBack: () => void }) {
  const { provider, activeKey, activeModel } = useSettings();
  const { messages, append, setLastContent, isStreaming, setStreaming, reset } = useChat();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  // Seed the conversation once when this thread first mounts.
  // Guarded with a ref so React StrictMode's dev-only double-mount doesn't
  // fire two parallel streams.
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (messages.length === 0 && seed) {
      send(seed);
    }
    // No cleanup reset here: that was wiping the chat history between
    // StrictMode unmount and remount, racing the two seed calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string) {
    if (!text.trim()) return;
    const key = activeKey();
    if (!key) {
      setError("Add an API key on the Settings page to start a Conversation.");
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
    const results = await retrieve(`${anchor} ${text}`.slice(-1500), 6);
    const citations = results.map((r) => ({
      passageId: r.passage.id,
      episode: r.passage.episode,
      episodeTitle: r.passage.episodeTitle,
      excerpt: r.passage.text.slice(0, 280),
    }));
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
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      history[history.length - 1] = {
        role: "user",
        content: `${context}\n\n[Student says:]\n${text.trim()}`,
      };
      let buf = "";
      await streamText({
        client,
        model: activeModel(),
        system: SOCRATIC_SYSTEM_PROMPT,
        messages: history,
        onDelta: (d) => { buf += d; setLastContent(buf, citations); },
        maxTokens: 1400,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Surface the underlying API error verbatim plus a hint if it's a key issue.
      const looksLikeAuth = /401|invalid|unauthor|api.key/i.test(msg);
      setError(looksLikeAuth ? `${msg} (check your API key on the Settings page)` : msg);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onBack} className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">← Back to details</button>
        <button onClick={() => { reset(); setError(null); }} className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">Clear thread</button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 -mx-1 px-1">
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--accent)] text-white px-3.5 py-2 text-[14px] leading-relaxed">
                {m.content}
              </div>
            ) : (
              <div className="">
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">Atlas</div>
                {m.content ? (
                  <RenderedText text={m.content} />
                ) : (
                  <div className="dot-pulse"><span /><span /><span /></div>
                )}
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

      <form
        onSubmit={(e) => { e.preventDefault(); if (!isStreaming) send(input); }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (!isStreaming) send(input); } }}
          placeholder={isStreaming ? "Thinking..." : "Reply..."}
          rows={1}
          disabled={isStreaming}
          className="flex-1 px-3 py-2 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] resize-none text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="px-3 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
