"use client";

import { useEffect, useMemo, useState } from "react";
import { getGraph, getEpisodes, getConcepts, getPeople } from "@/lib/data";
import type { Graph, GraphNode, Episode, Concept, Person } from "@/lib/types";
import { GraphCanvas } from "@/components/graph-canvas";

export default function GraphPage() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    Promise.all([getGraph(), getEpisodes(), getConcepts(), getPeople()]).then(([g, e, c, p]) => {
      setGraph(g);
      setEpisodes(e);
      setConcepts(c);
      setPeople(p);
    });
  }, []);

  const detail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "episode" && episodes) {
      const ep = episodes.find((e) => e.num === selected.num);
      if (!ep) return null;
      return { title: `Episode ${ep.num} · ${ep.title}`, body: ep.essence, meta: ep };
    }
    if (selected.kind === "concept" && concepts) {
      const c = concepts.find((x) => x.name === selected.label);
      if (!c) return null;
      return {
        title: c.name,
        body: `Appears across ${c.count} episode${c.count === 1 ? "" : "s"} (${c.episodes.join(", ")}).`,
        bullets: c.summaries.slice(0, 6).map((s) => `Ep ${s.ep}: ${s.text}`),
      };
    }
    if (selected.kind === "person" && people) {
      const p = people.find((x) => x.name === selected.label);
      if (!p) return null;
      return {
        title: p.name,
        body: `Discussed in ${p.count} episode${p.count === 1 ? "" : "s"} (${p.episodes.join(", ")}).`,
        bullets: p.summaries.slice(0, 6).map((s) => `Ep ${s.ep}: ${s.text}`),
      };
    }
    return null;
  }, [selected, episodes, concepts, people]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-2 max-w-6xl mx-auto w-full">
        <h1 className="serif text-3xl text-[var(--ink)]">Graph</h1>
        <p className="text-[var(--ink-soft)] mt-1 text-sm">
          Episodes (red), concepts (gold), and thinkers (blue). Click a node to see its connections.
        </p>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-[600px]">
        <div className="flex-1 flex flex-col border-t border-[var(--border)]">
          {graph ? (
            <GraphCanvas graph={graph} onSelect={setSelected} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--muted)]">Loading graph…</div>
          )}
        </div>
        <aside className="w-full md:w-96 border-t md:border-t-0 md:border-l border-[var(--border)] bg-[var(--surface)] p-6 overflow-y-auto max-h-[600px] md:max-h-none">
          {!selected && (
            <div className="text-sm text-[var(--muted)] leading-relaxed">
              <p className="mb-3">Click a node to inspect it.</p>
              <ul className="space-y-2 text-xs">
                <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#8b3a3a] mr-2 align-middle" />Episode — one of the 50 lectures</li>
                <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b8893c] mr-2 align-middle" />Concept — an idea Vervaeke develops</li>
                <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3c4a8b] mr-2 align-middle" />Person — a thinker referenced or discussed</li>
              </ul>
              <p className="mt-4">Use the filters above the canvas to slim things down. Cross-episode references show up as episode→episode links.</p>
            </div>
          )}
          {detail && (
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">{selected?.kind}</div>
              <h2 className="serif text-2xl text-[var(--ink)] leading-tight">{detail.title}</h2>
              <p className="prose-reader text-sm mt-3">{detail.body}</p>
              {detail.bullets && detail.bullets.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-[var(--ink-soft)]">
                  {detail.bullets.map((b, i) => (
                    <li key={i} className="leading-relaxed">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {selected?.kind === "episode" && (detail.meta as Episode)?.keyClaims && (
                <div className="mt-5">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Key claims</h3>
                  <ul className="space-y-1.5 text-sm text-[var(--ink-soft)]">
                    {(detail.meta as Episode).keyClaims.map((c, i) => (
                      <li key={i} className="leading-relaxed">— {c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
