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

  const MIN_DEGREE = 2;

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

      {/* Main: graph + chat */}
      <div className="flex-1 flex overflow-hidden min-w-0 min-h-0">
        <div className="flex-1 min-w-0 relative">
          {graph ? (
            <>
              <GraphCanvas
                graph={graph}
                mode={mode}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
                minDegree={MIN_DEGREE}
                onHoverLabel={setHoverLabel}
                isolatedId={isolatedId}
              />
              {isolatedId && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-5 py-2.5 rounded-full bg-[var(--ink)] text-[var(--bg)] text-sm shadow-lg whitespace-nowrap max-w-[calc(100%-32px)]">
                  <span className="text-[10px] uppercase tracking-[0.16em] opacity-60 shrink-0">
                    Isolated
                  </span>
                  <span className="font-medium truncate">
                    {concepts.find((c) => `concept:${c.id}` === isolatedId)?.canonicalName ?? "concept"}
                  </span>
                  <button
                    onClick={() => setIsolatedId(null)}
                    className="shrink-0 text-xs opacity-70 hover:opacity-100 underline-offset-2 hover:underline"
                    aria-label="Exit isolation"
                  >
                    Exit ✕
                  </button>
                </div>
              )}
              {hoverLabel && !isolatedId && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--bg)] text-sm font-medium shadow-lg whitespace-nowrap">
                    {hoverLabel}
                  </div>
                </div>
              )}
              {isolatedId && (
                <div className="absolute inset-x-0 top-16 z-10 pointer-events-none flex justify-between px-12 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  <span>← Prerequisites</span>
                  <span>Contrasted →</span>
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
          onIsolate={(conceptId) => setIsolatedId(`concept:${conceptId}`)}
        />
      </div>
    </div>
  );
}
