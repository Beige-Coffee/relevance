"use client";

import { useEffect, useState } from "react";
import { GraphCanvas, type GraphMode } from "@/components/graph-canvas";
import { GraphLegend } from "@/components/graph-legend";
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

  // Fixed minimum-episode threshold (drops concepts that appear in only one
  // episode, usually noise). Power-user knob was removed.
  const MIN_DEGREE = 2;

  useEffect(() => {
    Promise.all([getGraph(), getEpisodes(), getConcepts(), getPeople(), getCourses()]).then(
      ([g, e, c, p, cr]) => {
        setGraph(g); setEpisodes(e); setConcepts(c); setPeople(p); setCourses(cr);
      }
    );
  }, []);

  useEffect(() => { setSelected(null); }, [mode]);

  return (
    <div className="flex-1 flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Graph column */}
      <div className="flex-1 relative">
        {/* Top-left mode toggle */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-1 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur shadow-sm">
          {(["concepts", "persons"] as GraphMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                mode === m ? "bg-[var(--accent)] text-white" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
              }`}
            >
              {m === "concepts" ? "Concepts" : "Thinkers"}
            </button>
          ))}
        </div>

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
            <GraphLegend mode={mode} />
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

      {/* Right chat panel */}
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
  );
}
