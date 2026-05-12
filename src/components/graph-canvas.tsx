"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { forceCollide } from "d3-force";
import type { Graph, GraphNode, GraphLink } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export type GraphMode = "concepts" | "persons";

interface Props {
  graph: Graph;
  mode: GraphMode;
  onSelect: (node: GraphNode | null) => void;
  selectedId?: string | null;
  minDegree?: number;
  onHoverLabel?: (label: string | null) => void;
}

interface RenderNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
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

export function GraphCanvas({ graph, mode, onSelect, selectedId, minDegree = 1, onHoverLabel }: Props) {
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

  // Deterministic seeding so the same node set always lands in the same
  // visual layout. Without this, d3-force picks random initial positions
  // and switching modes (Concepts ↔ Thinkers) produces a different graph
  // each time. We hash each node id into an (x, y) inside a disk so the
  // simulation converges to a stable arrangement.
  const hashId = (id: string, salt: string) => {
    let h = 5381;
    const s = id + salt;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    // Normalize to [0, 1) regardless of sign
    return ((h >>> 0) % 100000) / 100000;
  };
  const seedPosition = (id: string) => {
    const angle = hashId(id, "a") * Math.PI * 2;
    const radius = Math.sqrt(hashId(id, "r")) * 320;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  };

  // Filter the graph to the selected mode. Episodes are never shown.
  // After filtering by mode and minDegree, drop any node that isn't in the
  // largest connected component, so a small disconnected cluster doesn't drift
  // to the edge and stretch the layout.
  const filteredGraph = useMemo(() => {
    const kindKeep = mode === "concepts" ? "concept" : "person";
    const visible = new Set<string>();
    for (const n of graph.nodes) {
      if (n.kind !== kindKeep) continue;
      if ((n.count ?? 1) < minDegree) continue;
      visible.add(n.id);
    }
    // Build adjacency on the visible subgraph
    const adj: Record<string, Set<string>> = {};
    for (const l of graph.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      if (!visible.has(s) || !visible.has(t)) continue;
      (adj[s] ??= new Set()).add(t);
      (adj[t] ??= new Set()).add(s);
    }
    // BFS-extract connected components; keep only the largest.
    const visited = new Set<string>();
    const components: string[][] = [];
    for (const id of visible) {
      if (visited.has(id)) continue;
      const comp: string[] = [];
      const queue: string[] = [id];
      while (queue.length) {
        const n = queue.shift()!;
        if (visited.has(n)) continue;
        visited.add(n);
        comp.push(n);
        for (const next of adj[n] ?? []) if (visible.has(next) && !visited.has(next)) queue.push(next);
      }
      components.push(comp);
    }
    components.sort((a, b) => b.length - a.length);
    const keep = new Set<string>(components[0] ?? []);
    // Edge case: if the largest component is small, fall back to showing all
    // visible nodes (avoid hiding everything when filtering is harsh).
    if (keep.size < Math.max(8, visible.size * 0.25)) {
      for (const id of visible) keep.add(id);
    }
    const nodes = graph.nodes
      .filter((n) => keep.has(n.id))
      // Spread to a new object so the simulation can mutate (vx, vy) without
      // touching the source data, and assign deterministic initial positions.
      .map((n) => {
        const { x, y } = seedPosition(n.id);
        return { ...n, x, y, vx: 0, vy: 0 };
      });
    // Also clone links and reset source/target to string ids. d3-force may
    // have rewritten these to point at the *previous* node objects on an
    // earlier render; if we don't reset, none of the new cloned nodes match
    // the link endpoints and most of the graph appears edgeless.
    const links = graph.links
      .filter((l) => {
        const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
        const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
        return keep.has(s) && keep.has(t);
      })
      .map((l) => ({
        ...l,
        source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
        target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
      }));
    return { nodes, links };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Configure d3 forces synchronously so the simulation runs with the
  // correct forces from frame 1, not after an async import resolves.
  // Stronger charge + collide gives a consistently sparse layout.
  useEffect(() => {
    type FG = {
      d3Force: (n: string, force?: unknown) => unknown;
      d3ReheatSimulation?: () => void;
      zoomToFit?: (ms: number, padding: number) => void;
    };
    type Force = {
      strength?: (v: number | ((d: unknown) => number)) => unknown;
      distance?: (v: number) => unknown;
      radius?: (v: number | ((d: unknown) => number)) => unknown;
    };
    const fg = fgRef.current as FG | null;
    if (!fg) return;

    const isConceptsMode = mode === "concepts";
    const charge = fg.d3Force("charge") as Force | null;
    charge?.strength?.(isConceptsMode ? -180 : -110);
    const link = fg.d3Force("link") as Force | null;
    link?.distance?.(isConceptsMode ? 75 : 60);

    const collide = forceCollide<RenderNode>()
      .radius((node) => {
        const r = (node.kind === "person" ? 5 : 6) + Math.min(5, (node.count ?? 1) * 0.6);
        return r + 5;
      })
      .strength(0.95)
      .iterations(2);
    (fg.d3Force as unknown as (n: string, f: unknown) => unknown)("collide", collide);

    fg.d3ReheatSimulation?.();
  }, [filteredGraph, mode]);

  // No perpetual reheat. The simulation settles and stays still so the click
  // target is stable. Users can still drag a node to rearrange, and the
  // spring-back animation lasts a couple of seconds before resting.

  function nodeRadius(node: GraphNode): number {
    // Slightly bigger visual nodes so they're easy to aim at.
    return (node.kind === "person" ? 6 : 7) + Math.min(6, (node.count ?? 1) * 0.6);
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

          // Soft dim rather than near-invisible: keep dimmed nodes legible.
          ctx.globalAlpha = isDimmed ? 0.32 : 1;

          const cluster = node.cluster as string | undefined;
          const clusterColor = cluster ? palette.cluster[cluster] : palette.stroke;

          // Hover/selection halo (drawn first so node sits on top)
          if (isActive || selected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 7, 0, 2 * Math.PI);
            ctx.fillStyle = selected ? palette.selected + "33" : palette.linkActive + "33";
            ctx.fill();
          }

          // Fill
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          if (node.kind === "concept") {
            ctx.fillStyle = node.flagship ? (clusterColor ?? palette.stroke) : palette.fill;
          } else {
            ctx.fillStyle = palette.fillPerson;
          }
          ctx.fill();

          // Stroke
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          ctx.lineWidth = selected ? 2.8 : isActive ? 2.4 : 1.4;
          ctx.strokeStyle = selected
            ? palette.selected
            : node.kind === "concept"
              ? (clusterColor ?? palette.stroke)
              : palette.strokePerson;
          ctx.stroke();

          // Label: always show on hover/selection/neighbor; with a pill background for
          // legibility against the busy canvas.
          const showLabel = isActive || selected || isNeighbor || globalScale > 1.7;
          if (showLabel) {
            const fontSize = isActive || selected ? Math.max(12, 13 / globalScale) : Math.max(10, 11 / globalScale);
            ctx.font = `${(isActive || selected) ? "500 " : ""}${fontSize.toFixed(0)}px ui-sans-serif, system-ui, -apple-system, "Inter"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";

            const text = node.label;
            const textW = ctx.measureText(text).width;
            const padX = 5;
            const padY = 2.5;
            const lineH = fontSize + padY * 2;
            const labelY = node.y + r + 5;

            // Always paint a background for the active/selected label; lighter
            // background for neighbors so they stay readable but secondary.
            if (isActive || selected) {
              ctx.fillStyle = palette.bg;
              ctx.globalAlpha = 0.94;
              roundRect(ctx, node.x - textW / 2 - padX, labelY, textW + padX * 2, lineH, 4);
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = node.kind === "concept" ? (clusterColor ?? palette.stroke) : palette.strokePerson;
              ctx.stroke();
              ctx.globalAlpha = 1;
            }

            ctx.fillStyle = palette.ink;
            ctx.globalAlpha = isDimmed ? 0.45 : (isActive || selected ? 1 : 0.8);
            ctx.fillText(text, node.x, labelY + padY);
          }
          ctx.globalAlpha = 1;
        }}
        // Hit area is much larger than the visual circle so clicks and hovers
        // are forgiving. Tested 6px and bumped to 14px for confident aim.
        nodePointerAreaPaint={(rawNode, color, ctx) => {
          const node = rawNode as RenderNode;
          if (node.x == null || node.y == null) return;
          const r = nodeRadius(node);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 14, 0, 2 * Math.PI);
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
        // Keep all links visible; we dim them instead of hiding so the graph
        // doesn't appear to "shatter" on hover.
        onNodeHover={(n) => {
          const node = n as GraphNode | null;
          setHoverId(node ? node.id : null);
          if (containerRef.current) containerRef.current.style.cursor = node ? "pointer" : "default";
          onHoverLabel?.(node ? node.label : null);
        }}
        onNodeClick={(node) => onSelect(node as unknown as GraphNode)}
        onBackgroundClick={() => onSelect(null)}
        onEngineStop={() => {
          // Fit the camera only once the simulation has actually cooled,
          // so we always frame the settled layout (no more tight-vs-sparse
          // race condition).
          const fg = fgRef.current as { zoomToFit?: (ms: number, padding: number) => void } | null;
          fg?.zoomToFit?.(700, 80);
        }}
        enableNodeDrag={true}
        cooldownTicks={600}
        d3AlphaDecay={0.018}
        d3VelocityDecay={0.45}
        d3AlphaMin={0.005}
        warmupTicks={200}
        linkLineDash={(l) => {
          const link = l as GraphLink;
          if (link.kind === "contrasted") return [4, 4];
          return null;
        }}
        linkDirectionalArrowLength={(l) => {
          const link = l as GraphLink;
          return link.kind === "prereq" ? 4.5 : 0;
        }}
        linkDirectionalArrowRelPos={0.85}
        linkDirectionalArrowColor={() => palette.linkActive}
      />
    </div>
  );
}
