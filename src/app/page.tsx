"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, type GraphMode } from "@/components/graph-canvas";
import { LegendBar } from "@/components/legend-bar";
import { NodeSearch } from "@/components/node-search";
import { HomeChat } from "@/components/home-chat";
import { getGraph, getEpisodes, getConcepts, getPeople, getCourses } from "@/lib/data";
import type { Graph, GraphNode, Episode, Concept, Person, CourseSummary } from "@/lib/types";

export default function Home() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [, setEpisodes] = useState<Episode[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [mode, setMode] = useState<GraphMode>("concepts");
  const [chatCollapsed, setChatCollapsed] = useState(false);
  // When set, the graph swaps to an "isolate" layout focused on this concept:
  // its full transitive prerequisite chain on the left, contrasts on the
  // right, related concepts below.
  const [isolatedId, setIsolatedId] = useState<string | null>(null);

  // Per-mode visibility threshold. Concept degree distribution is shifted
  // higher (min 4, max 28), so we use 7 to prune the long tail. Thinker
  // degrees are smaller (most thinkers connect to a couple of others);
  // we use 2 to drop only the very isolated ones and keep the rest.
  const minDegree = mode === "concepts" ? 7 : 2;

  useEffect(() => {
    Promise.all([getGraph(), getEpisodes(), getConcepts(), getPeople(), getCourses()]).then(
      ([g, e, c, p, cr]) => {
        setGraph(g); setEpisodes(e); setConcepts(c); setPeople(p); setCourses(cr);
      }
    );
  }, []);

  useEffect(() => {
    setSelected(null);
    setIsolatedId(null);
  }, [mode]);

  function handleSearchSelect(node: GraphNode) {
    setSelected(node);
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100dvh - 56px)" }}
    >
      {/* Sub-bar below nav: filter pills, search, legend */}
      <div className="relative z-40 border-b border-[var(--border-soft)] bg-[var(--bg)]/85 backdrop-blur px-4 py-2 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 px-1 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] shrink-0">
          {(["concepts", "persons"] as GraphMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-0.5 text-[12px] rounded-full transition-colors ${
                mode === m ? "bg-[var(--accent)] text-white" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {m === "concepts" ? "Concepts" : "Thinkers"}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[200px] max-w-[360px]">
          <NodeSearch concepts={concepts} people={people} mode={mode} onSelect={handleSearchSelect} />
        </div>

        <LegendBar mode={mode} />
      </div>

      {/* Main: graph + chat. Side-by-side on desktop, stacked (graph on
          top, chat below) on mobile so neither panel gets clipped. */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0 min-h-0">
        <div className="flex-1 min-w-0 min-h-0 relative">
          {graph ? (
            <>
              <GraphCanvas
                graph={graph}
                mode={mode}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
                minDegree={minDegree}
                onHoverLabel={setHoverLabel}
                isolatedId={isolatedId}
              />
              {isolatedId && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-2 rounded-full bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)] text-sm shadow-sm whitespace-nowrap max-w-[calc(100%-32px)]">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] shrink-0">
                    Isolated
                  </span>
                  <span className="font-medium truncate">
                    {concepts.find((c) => `concept:${c.id}` === isolatedId)?.canonicalName ?? "concept"}
                  </span>
                  <button
                    onClick={() => setIsolatedId(null)}
                    className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--accent)] underline-offset-2 hover:underline"
                    aria-label="Exit isolation"
                  >
                    Exit ✕
                  </button>
                </div>
              )}
              {hoverLabel && !isolatedId && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="px-4 py-2 rounded-full bg-[var(--surface)] text-[var(--accent)] border border-[var(--accent)] text-sm font-medium shadow-sm whitespace-nowrap">
                    {hoverLabel}
                  </div>
                </div>
              )}
              {/* When a concept is selected but not yet isolated, offer the
                  isolate action right where the Edges legend will appear
                  once they take it. Keeps both pieces of UI in the same
                  visual slot. */}
              {!isolatedId && selected?.kind === "concept" && (
                <button
                  onClick={() => setIsolatedId(selected.id)}
                  className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)] text-[12px] shadow-sm hover:bg-[var(--accent-tint)] transition-colors"
                  title="Show this concept's full dependency structure"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M3 12h6" />
                    <path d="M15 12h6" />
                    <path d="M12 3v6" />
                    <path d="M12 15v6" />
                  </svg>
                  <span className="font-medium">Isolate</span>
                  <span className="text-[var(--ink-soft)] max-w-[180px] truncate">
                    {selected.label}
                  </span>
                </button>
              )}
              {isolatedId && (
                <div className="absolute top-4 right-4 z-10 rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-sm p-3 text-[11px] leading-snug space-y-1.5 pointer-events-none">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">Edges</div>
                  <div className="flex items-center gap-2">
                    <svg width="36" height="10" aria-hidden>
                      <line x1="3" y1="5" x2="32" y2="5" stroke="#b8c3d6" strokeWidth="1.5" />
                    </svg>
                    <span>Related</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="36" height="10" aria-hidden>
                      <line x1="3" y1="5" x2="27" y2="5" stroke="#1f3a8a" strokeWidth="1.6" />
                      <polygon points="27,2 33,5 27,8" fill="#1f3a8a" />
                    </svg>
                    <span>Prerequisite</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg width="36" height="10" aria-hidden>
                      <line x1="3" y1="5" x2="32" y2="5" stroke="#7c3aed" strokeWidth="1.6" strokeDasharray="6 3" />
                    </svg>
                    <span>Contrasted</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-sm">
              Loading graph...
            </div>
          )}
        </div>

        <HomeChat
          selected={selected}
          mode={mode}
          concepts={concepts}
          people={people}
          courses={courses}
          onClearSelected={() => setSelected(null)}
          collapsed={chatCollapsed}
          onToggleCollapsed={() => setChatCollapsed((v) => !v)}
        />
      </div>
    </div>
  );
}
