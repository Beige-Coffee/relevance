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

  const MIN_DEGREE = 2;

  useEffect(() => {
    Promise.all([getGraph(), getEpisodes(), getConcepts(), getPeople(), getCourses()]).then(
      ([g, e, c, p, cr]) => {
        setGraph(g); setEpisodes(e); setConcepts(c); setPeople(p); setCourses(cr);
      }
    );
  }, []);

  useEffect(() => { setSelected(null); }, [mode]);

  function handleSearchSelect(node: GraphNode) {
    // Switch to the matching mode so the picked node is visible on the graph.
    if (node.kind === "concept" && mode !== "concepts") setMode("concepts");
    if (node.kind === "person" && mode !== "persons") setMode("persons");
    setSelected(node);
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-56px)] overflow-hidden">
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
          <NodeSearch concepts={concepts} people={people} onSelect={handleSearchSelect} />
        </div>

        <LegendBar mode={mode} />
      </div>

      {/* Main: graph + chat */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {graph ? (
            <>
              <GraphCanvas
                graph={graph}
                mode={mode}
                onSelect={setSelected}
                selectedId={selected?.id ?? null}
                minDegree={MIN_DEGREE}
                onHoverLabel={setHoverLabel}
              />
              {hoverLabel && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--bg)] text-sm font-medium shadow-lg whitespace-nowrap">
                    {hoverLabel}
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
