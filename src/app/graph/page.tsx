"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
      setGraph(g); setEpisodes(e); setConcepts(c); setPeople(p);
    });
  }, []);

  const detail = useMemo(() => {
    if (!selected) return null;
    if (selected.kind === "episode" && episodes) {
      const ep = episodes.find((e) => e.num === selected.num);
      if (!ep) return null;
      return {
        kind: "episode" as const,
        title: `Episode ${ep.num} · ${ep.title}`,
        body: ep.essence,
        href: `/episodes#ep-${ep.num}`,
        bullets: ep.keyClaims,
      };
    }
    if (selected.kind === "concept" && concepts) {
      const id = selected.id.replace(/^concept:/, "");
      const c = concepts.find((x) => x.id === id);
      if (!c) return null;
      return {
        kind: "concept" as const,
        title: c.canonicalName,
        body: c.definition,
        href: `/concept/${c.id}`,
        meta: c,
      };
    }
    if (selected.kind === "person" && people) {
      const id = selected.id.replace(/^person:/, "");
      const p = people.find((x) => x.id === id);
      if (!p) return null;
      return {
        kind: "person" as const,
        title: p.canonicalName,
        body: p.shortBio,
        href: `/person/${p.id}`,
        meta: p,
      };
    }
    return null;
  }, [selected, episodes, concepts, people]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-6 pt-6 pb-2 max-w-6xl mx-auto w-full">
        <h1 className="serif text-3xl text-[var(--ink)]">Graph</h1>
        <p className="text-[var(--ink-soft)] mt-1 text-sm">
          Episodes (red), concepts (gold), thinkers (blue). Click a node to inspect; click the title to open the full deep-dive.
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
                <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b8893c] mr-2 align-middle" />Concept — an idea Vervaeke develops (★ = flagship, has a mini-course)</li>
                <li><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#3c4a8b] mr-2 align-middle" />Person — a thinker referenced or discussed</li>
              </ul>
              <p className="mt-4">Use the filters above the canvas to slim things down. Cross-episode references show up as episode→episode links.</p>
            </div>
          )}
          {detail && (
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">{selected?.kind}{selected?.flagship ? " · ★ flagship" : ""}</div>
              <h2 className="serif text-2xl text-[var(--ink)] leading-tight">
                <Link href={detail.href} className="hover:text-[var(--accent)] transition-colors">
                  {detail.title} →
                </Link>
              </h2>
              <p className="prose-reader text-sm mt-3">{detail.body}</p>

              {detail.kind === "concept" && (
                <>
                  <div className="mt-4 text-xs text-[var(--muted)] flex gap-3">
                    <span className="text-[var(--accent)]">{detail.meta.cluster}</span>
                    <span>depth {detail.meta.depth}</span>
                    <span>intro ep {detail.meta.introducedIn}</span>
                  </div>
                  {detail.meta.subConcepts && detail.meta.subConcepts.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Sub-concepts</h3>
                      <ul className="space-y-1.5 text-sm text-[var(--ink-soft)]">
                        {detail.meta.subConcepts.map((sc) => (
                          <li key={sc.id}>— {sc.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {detail.kind === "person" && detail.meta.roleInArgument && (
                <p className="prose-reader text-sm mt-3 italic text-[var(--ink-soft)]">{detail.meta.roleInArgument}</p>
              )}
              {detail.kind === "episode" && detail.bullets && detail.bullets.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Key claims</h3>
                  <ul className="space-y-1.5 text-sm text-[var(--ink-soft)]">
                    {detail.bullets.map((c, i) => (
                      <li key={i} className="leading-relaxed">— {c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Link
                href={detail.href}
                className="mt-6 inline-flex items-center px-3 py-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-xs font-medium hover:bg-[var(--accent)] transition-colors"
              >
                Open full page →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
