"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Graph, GraphNode, GraphLink } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export type GraphMode = "concepts" | "persons";

interface Props {
  graph: Graph;
  mode: GraphMode;
  onSelect: (node: GraphNode | null) => void;
  selectedId?: string | null;
  minDegree?: number;
}

interface RenderNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

const CLUSTER_COLORS_LIGHT: Record<string, string> = {
  "cognitive-science": "#1f3a8a",
  historical: "#5b3e89",
  normative: "#1f6f6c",
  practical: "#a85c1a",
  methodological: "#1f3a8a",
};
const CLUSTER_COLORS_DARK: Record<string, string> = {
  "cognitive-science": "#7daaff",
  historical: "#a78bfa",
  normative: "#5cd2cc",
  practical: "#f0a667",
  methodological: "#7daaff",
};

export function GraphCanvas({ graph, mode, onSelect, selectedId, minDegree = 1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dark, setDark] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    setDark(window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const palette = useMemo(
    () => ({
      bg: dark ? "#0c1019" : "#ffffff",
      stroke: dark ? "#6b8cf2" : "#1f3a8a",
      fill: dark ? "#0c1019" : "#ffffff",
      fillPerson: dark ? "#1d2747" : "#e6edff",
      strokePerson: dark ? "#6b8cf2" : "#3257d6",
      selected: dark ? "#d4b25c" : "#c08a2c",
      ink: dark ? "#e8ecf5" : "#0f1623",
      muted: dark ? "#7b8499" : "#6b7488",
      link: dark ? "#2a3548" : "#b8c3d6",
      linkActive: dark ? "#8aa1e3" : "#1f3a8a",
      cluster: dark ? CLUSTER_COLORS_DARK : CLUSTER_COLORS_LIGHT,
    }),
    [dark]
  );

  // Filter the graph to the selected mode. Episodes are never shown.
  const filteredGraph = useMemo(() => {
    const kindKeep = mode === "concepts" ? "concept" : "person";
    const visible = new Set<string>();
    for (const n of graph.nodes) {
      if (n.kind !== kindKeep) continue;
      if ((n.count ?? 1) < minDegree) continue;
      visible.add(n.id);
    }
    const nodes = graph.nodes.filter((n) => visible.has(n.id));
    const links = graph.links.filter((l) => {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      return visible.has(s) && visible.has(t);
    });
    return { nodes, links };
  }, [graph, mode, minDegree]);

  const neighbors = useMemo(() => {
    const n: Record<string, Set<string>> = {};
    for (const l of filteredGraph.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      (n[s] ??= new Set()).add(t);
      (n[t] ??= new Set()).add(s);
    }
    return n;
  }, [filteredGraph]);

  const activeId = selectedId ?? hoverId ?? null;
  const activeNeighbors = activeId ? neighbors[activeId] ?? new Set() : new Set();
  const hasFocus = Boolean(activeId);

  // Configure d3 forces once we have a ref. Tuning depends on which mode we're in.
  useEffect(() => {
    type FG = {
      d3Force: (n: string, force?: unknown) => unknown;
      d3ReheatSimulation?: () => void;
      zoomToFit?: (ms: number, padding: number) => void;
    };
    type Force = { strength?: (v: number | ((d: unknown) => number)) => unknown; distance?: (v: number) => unknown; radius?: (v: number | ((d: unknown) => number)) => unknown };
    const fg = fgRef.current as FG | null;
    if (!fg) return;
    const isConceptsMode = mode === "concepts";
    const charge = fg.d3Force("charge") as Force | null;
    charge?.strength?.(isConceptsMode ? -110 : -70);
    const link = fg.d3Force("link") as Force | null;
    link?.distance?.(isConceptsMode ? 60 : 50);
    import("d3-force").then((d3) => {
      const collide = d3.forceCollide().radius((node: unknown) => {
        const n = node as RenderNode;
        const r = (n.kind === "person" ? 5 : 6) + Math.min(5, (n.count ?? 1) * 0.6);
        return r + 3;
      }).strength(0.8);
      (fg.d3Force as unknown as (n: string, f: unknown) => unknown)("collide", collide);
      fg.d3ReheatSimulation?.();
      // Refit camera once the simulation has had a moment to settle
      setTimeout(() => fg.zoomToFit?.(600, 80), 1200);
    }).catch(() => {});
  }, [filteredGraph, mode]);

  // No perpetual reheat. The simulation settles and stays still so the click
  // target is stable. Users can still drag a node to rearrange, and the
  // spring-back animation lasts a couple of seconds before resting.

  function nodeRadius(node: GraphNode): number {
    return (node.kind === "person" ? 5 : 6) + Math.min(5, (node.count ?? 1) * 0.6);
  }

  function isLinkActive(l: GraphLink): boolean {
    const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
    const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
    return s === activeId || t === activeId;
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <ForceGraph2D
        ref={fgRef as never}
        width={size.w}
        height={size.h}
        graphData={filteredGraph as unknown as { nodes: GraphNode[]; links: GraphLink[] }}
        backgroundColor={palette.bg}
        nodeId="id"
        nodeRelSize={4}
        nodeVal={(n) => {
          const node = n as GraphNode;
          const base = node.kind === "person" ? 1.4 : 1.6;
          return base + Math.min(8, (node.count ?? 1) * 0.6);
        }}
        nodeLabel={() => ""}
        nodeCanvasObject={(rawNode, ctx, globalScale) => {
          const node = rawNode as RenderNode;
          if (node.x == null || node.y == null) return;
          const r = nodeRadius(node);
          const selected = node.id === selectedId;
          const isActive = activeId === node.id;
          const isNeighbor = activeId ? activeNeighbors.has(node.id) : false;
          const isDimmed = hasFocus && !isActive && !isNeighbor;

          ctx.globalAlpha = isDimmed ? 0.12 : 1;

          // Cluster color for fill (concepts) or stroke ring (persons)
          const cluster = node.cluster as string | undefined;
          const clusterColor = cluster ? palette.cluster[cluster] : palette.stroke;

          // Draw fill
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          if (node.kind === "concept") {
            ctx.fillStyle = node.flagship ? (clusterColor ?? palette.stroke) : palette.fill;
          } else {
            ctx.fillStyle = palette.fillPerson;
          }
          ctx.fill();

          // Selection ring (outer)
          if (selected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI);
            ctx.lineWidth = 2;
            ctx.strokeStyle = palette.selected;
            ctx.stroke();
          }

          // Inner stroke
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.lineWidth = isActive ? 2.2 : 1.4;
          ctx.strokeStyle = node.kind === "concept"
            ? (clusterColor ?? palette.stroke)
            : palette.strokePerson;
          ctx.stroke();

          // Labels: always show selected/active/neighbor; otherwise only at higher zoom levels.
          const showLabel = isActive || selected || isNeighbor || globalScale > 1.8;
          if (showLabel) {
            ctx.font = `${Math.max(9, 11 / globalScale).toFixed(0)}px ui-sans-serif, system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = palette.ink;
            ctx.globalAlpha = isDimmed ? 0.2 : (isActive || selected ? 1 : 0.75);
            ctx.fillText(node.label, node.x, node.y + r + 3);
          }
          ctx.globalAlpha = 1;
        }}
        // Bigger hit area than visual circle, so clicks are forgiving.
        nodePointerAreaPaint={(rawNode, color, ctx) => {
          const node = rawNode as RenderNode;
          if (node.x == null || node.y == null) return;
          const r = nodeRadius(node);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 6, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={(l) => {
          const link = l as GraphLink;
          if (!hasFocus) return palette.link;
          return isLinkActive(link) ? palette.linkActive : palette.link;
        }}
        linkWidth={(l) => {
          const link = l as GraphLink;
          // Weighted link width: thicker for stronger co-discussion edges.
          const baseW = link.weight ? Math.min(2.4, 0.5 + link.weight * 0.15) : 0.8;
          if (!hasFocus) return baseW;
          return isLinkActive(link) ? Math.max(2.2, baseW + 1.4) : 0.4;
        }}
        linkVisibility={(l) => {
          const link = l as GraphLink;
          // When focused, hide non-relevant links entirely (cleaner than dimming).
          if (!hasFocus) return true;
          return isLinkActive(link) || activeNeighbors.size === 0;
        }}
        onNodeHover={(n) => {
          setHoverId(n ? ((n as GraphNode).id) : null);
          if (containerRef.current) containerRef.current.style.cursor = n ? "pointer" : "default";
        }}
        onNodeClick={(node) => onSelect(node as unknown as GraphNode)}
        onBackgroundClick={() => onSelect(null)}
        enableNodeDrag={true}
        cooldownTicks={400}
        d3AlphaDecay={0.025}
        d3VelocityDecay={0.5}
        d3AlphaMin={0.01}
        warmupTicks={140}
      />
    </div>
  );
}
