"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Graph, GraphNode, GraphLink } from "@/lib/types";

// react-force-graph only runs in the browser; load with no SSR.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Filter = "all" | "episode" | "concept" | "person";

const COLOR_LIGHT: Record<string, string> = {
  episode: "#8b3a3a",
  concept: "#b8893c",
  person: "#3c4a8b",
};
const COLOR_DARK: Record<string, string> = {
  episode: "#d28a7e",
  concept: "#d4a85a",
  person: "#8aa1e3",
};

interface Props {
  graph: Graph;
  onSelect: (node: GraphNode | null) => void;
}

export function GraphCanvas({ graph, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [filter, setFilter] = useState<Filter>("all");
  const [minCount, setMinCount] = useState(2);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        setSize({
          w: containerRef.current.clientWidth,
          h: containerRef.current.clientHeight,
        });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const palette = dark ? COLOR_DARK : COLOR_LIGHT;

  const filteredGraph = useMemo(() => {
    const visible = new Set<string>();
    for (const n of graph.nodes) {
      if (filter !== "all" && n.kind !== filter && n.kind !== "episode") continue;
      // Hide low-degree concept/person nodes when minCount > 1
      if (n.kind !== "episode" && (n.count ?? 1) < minCount) continue;
      visible.add(n.id);
    }
    const nodes = graph.nodes.filter((n) => visible.has(n.id));
    const links = graph.links.filter((l) => {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      return visible.has(s) && visible.has(t);
    });
    return { nodes, links };
  }, [graph, filter, minCount]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[var(--border)] text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--muted)] text-xs uppercase tracking-wider">Show</span>
          {(["all", "episode", "concept", "person"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                filter === f
                  ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]"
                  : "border-[var(--border)] text-[var(--ink-soft)] hover:border-[var(--accent)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[var(--muted)] text-xs uppercase tracking-wider">Min episodes</span>
          <input
            type="range"
            min={1}
            max={6}
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value))}
            className="accent-[var(--accent)]"
          />
          <span className="mono text-xs text-[var(--ink-soft)] w-4 text-center">{minCount}</span>
        </div>
        <div className="ml-auto text-xs text-[var(--muted)]">
          {filteredGraph.nodes.length} nodes · {filteredGraph.links.length} links
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative">
        <ForceGraph2D
          ref={fgRef as never}
          width={size.w}
          height={size.h}
          graphData={filteredGraph as unknown as { nodes: GraphNode[]; links: GraphLink[] }}
          backgroundColor={dark ? "#14120e" : "#faf7f1"}
          nodeId="id"
          nodeLabel={(n) => (n as GraphNode).label}
          nodeColor={(n) => palette[(n as GraphNode).kind] ?? "#999"}
          nodeRelSize={4}
          nodeVal={(n) => {
            const node = n as GraphNode;
            if (node.kind === "episode") return 4;
            return Math.min(8, 1 + (node.count ?? 1) * 0.8);
          }}
          linkColor={() => (dark ? "#2e2922" : "#e0d9c8")}
          linkWidth={0.5}
          linkDirectionalParticles={0}
          onNodeClick={(node) => onSelect(node as unknown as GraphNode)}
          onBackgroundClick={() => onSelect(null)}
          cooldownTicks={120}
          enableNodeDrag={false}
        />
      </div>
    </div>
  );
}
