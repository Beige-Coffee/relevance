"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraphCanvas, type GraphMode } from "@/components/graph-canvas";
import { GraphLegend } from "@/components/graph-legend";
import { NodePanel } from "@/components/node-panel";
import { getGraph, getEpisodes, getConcepts, getPeople, getCourses } from "@/lib/data";
import type { Graph, GraphNode, Episode, Concept, Person, CourseSummary } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [mode, setMode] = useState<GraphMode>("concepts");
  // Fixed minimum-episode threshold: drops concepts that appear in only one
  // episode (usually noise). Power-user knob has been removed for simplicity.
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
    <div className="flex-1 flex relative min-h-[calc(100vh-56px)]">
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

        {/* Bottom-left intro/help */}
        {!selected && graph && (
          <div className="absolute bottom-5 left-5 z-10 max-w-sm p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur shadow-sm pointer-events-none">
            <p className="serif text-base text-[var(--ink)] leading-tight">
              The web of ideas in <span className="italic">Awakening from the Meaning Crisis.</span>
            </p>
            <p className="text-xs text-[var(--muted)] mt-1.5 leading-snug">
              Click a node to inspect. Drag to rearrange. Toggle Concepts and Thinkers above.
            </p>
          </div>
        )}

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
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[280px] z-10 pointer-events-none">
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

      {/* Right panel */}
      <div className={`${selected ? "block" : "hidden"} fixed sm:absolute right-0 top-14 sm:top-0 bottom-0 z-20 w-full sm:w-auto`}>
        <NodePanel
          node={selected}
          concepts={concepts}
          people={people}
          episodes={episodes}
          courses={courses}
          onClose={() => setSelected(null)}
          onOpenConversation={(id) => router.push(`/conversation/${id}`)}
        />
      </div>
    </div>
  );
}
