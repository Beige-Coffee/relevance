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
  // When set, the graph re-renders as a focused "concept neighborhood" view:
  // the anchor in the center, every transitive prereq stacked in columns on
  // the left, contrasted ideas on the right, related ideas below.
  isolatedId?: string | null;
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

export function GraphCanvas({ graph, mode, onSelect, selectedId, minDegree = 1, onHoverLabel, isolatedId = null }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<unknown>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dark, setDark] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Per-mode cache of settled node positions. After the simulation stops we
  // record where each node ended up; the next time the user returns to that
  // mode we hydrate the nodes from this cache so the layout looks identical
  // (including any manual drags they made).
  const positionCacheRef = useRef<Record<GraphMode, Record<string, { x: number; y: number }>>>({
    concepts: {},
    persons: {},
  });

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

  // Isolate-view layout: when isolatedId is set, build a focused sub-graph
  // around that concept with a hand-rolled Sugiyama-style layout instead of
  // the force-directed exploration view.
  const isolatedGraph = useMemo(() => {
    if (!isolatedId) return null;
    // We only support isolate for concepts.
    const anchor = graph.nodes.find((n) => n.id === isolatedId);
    if (!anchor || anchor.kind !== "concept") return null;

    // Build directed prereq adjacency (incoming, i.e. target -> [sources])
    // because in the data source=prereq, target=dependent.
    const prereqInbound: Record<string, string[]> = {};
    const contrastNeighbors: Record<string, Set<string>> = {};
    const relatedNeighbors: Record<string, Set<string>> = {};
    for (const l of graph.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      if (!s.startsWith("concept:") || !t.startsWith("concept:")) continue;
      if (l.kind === "prereq") {
        (prereqInbound[t] ??= []).push(s);
      } else if (l.kind === "contrasted") {
        (contrastNeighbors[s] ??= new Set()).add(t);
        (contrastNeighbors[t] ??= new Set()).add(s);
      } else if (l.kind === "related") {
        (relatedNeighbors[s] ??= new Set()).add(t);
        (relatedNeighbors[t] ??= new Set()).add(s);
      }
    }

    // BFS the prereq graph backwards from anchor to collect every transitive
    // prereq, recording the *longest* path to anchor as each node's column.
    const layer: Record<string, number> = { [anchor.id]: 0 };
    const queue: string[] = [anchor.id];
    while (queue.length) {
      const node = queue.shift()!;
      for (const p of prereqInbound[node] ?? []) {
        const candidate = layer[node] + 1;
        if (layer[p] === undefined || layer[p] < candidate) {
          layer[p] = candidate;
          queue.push(p);
        }
      }
    }
    const prereqIds = Object.keys(layer).filter((id) => id !== anchor.id);
    const maxLayer = prereqIds.reduce((m, id) => Math.max(m, layer[id]), 0);

    // 1-hop contrast and related neighbors (exclude anything already in prereq tree).
    const inPrereqs = new Set(prereqIds);
    inPrereqs.add(anchor.id);
    const contrastIds = [...(contrastNeighbors[anchor.id] ?? new Set<string>())].filter(
      (id) => !inPrereqs.has(id),
    );
    const relatedIds = [...(relatedNeighbors[anchor.id] ?? new Set<string>())].filter(
      (id) => !inPrereqs.has(id) && !contrastIds.includes(id),
    );

    // Group prereqs by layer, then minimize edge crossings via a couple of
    // barycenter sweeps from inner (closer to anchor) outward.
    const layers: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
    for (const id of prereqIds) layers[layer[id]].push(id);
    // Stable initial order (alphabetical) so reruns are deterministic.
    for (const lg of layers) lg.sort();
    // Compute order index per id for barycenter sort.
    const orderOf: Record<string, number> = { [anchor.id]: 0 };
    for (let li = 0; li <= maxLayer; li++) {
      layers[li].forEach((id, i) => (orderOf[id] = i));
    }
    // Two sweeps: outer -> inner, then inner -> outer.
    for (let sweep = 0; sweep < 4; sweep++) {
      for (let li = 1; li <= maxLayer; li++) {
        const lg = layers[li];
        // Each node in this layer points to nodes one layer DOWN (closer to anchor).
        // Its target neighbors are nodes that depend on it (i.e. nodes where prereqInbound[target] contains this).
        // Easier: for each src in this layer, find targets t such that prereqInbound[t] includes src AND t is in layer (li-1) (or anchor).
        const sortKey: Record<string, number> = {};
        for (const id of lg) {
          // find downstream layer-li-1 neighbors
          const downstream: string[] = [];
          for (const [t, sources] of Object.entries(prereqInbound)) {
            if (layer[t] === li - 1 && sources.includes(id)) downstream.push(t);
          }
          if (downstream.length === 0) sortKey[id] = orderOf[id] ?? 0;
          else sortKey[id] = downstream.reduce((s, d) => s + (orderOf[d] ?? 0), 0) / downstream.length;
        }
        lg.sort((a, b) => sortKey[a] - sortKey[b] || a.localeCompare(b));
        lg.forEach((id, i) => (orderOf[id] = i));
      }
    }

    // Geometry constants.
    const COL_W = 200; // horizontal column spacing
    const ROW_H = 70; // vertical row spacing
    const CONTRAST_OFFSET_X = 220;
    const RELATED_OFFSET_Y = 230;
    const RELATED_COL_W = 130;

    const positions: Record<string, { x: number; y: number }> = {};
    positions[anchor.id] = { x: 0, y: 0 };

    // Place prereq layers to the left.
    for (let li = 1; li <= maxLayer; li++) {
      const lg = layers[li];
      const n = lg.length;
      const totalH = (n - 1) * ROW_H;
      lg.forEach((id, i) => {
        positions[id] = { x: -li * COL_W, y: i * ROW_H - totalH / 2 };
      });
    }

    // Contrasts: single column to the right of anchor.
    const cn = contrastIds.length;
    const cTotalH = (cn - 1) * ROW_H;
    contrastIds.sort();
    contrastIds.forEach((id, i) => {
      positions[id] = { x: CONTRAST_OFFSET_X, y: i * ROW_H - cTotalH / 2 };
    });

    // Related: arrange below the anchor in a row. If too many, wrap to
    // multiple rows.
    relatedIds.sort();
    const perRow = Math.max(4, Math.ceil(Math.sqrt(relatedIds.length)));
    relatedIds.forEach((id, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const rowCount = Math.min(perRow, relatedIds.length - row * perRow);
      const xOff = (col - (rowCount - 1) / 2) * RELATED_COL_W;
      positions[id] = { x: xOff, y: RELATED_OFFSET_Y + row * (ROW_H + 10) };
    });

    // Build node list with pinned positions.
    const visibleIds = new Set<string>([anchor.id, ...prereqIds, ...contrastIds, ...relatedIds]);
    const nodes = graph.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => {
        const p = positions[n.id] ?? { x: 0, y: 0 };
        return { ...n, x: p.x, y: p.y, vx: 0, vy: 0, fx: p.x, fy: p.y };
      });

    // Filter links to those between visible nodes; reset source/target to ids.
    const links = graph.links
      .filter((l) => {
        const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
        const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
        if (!visibleIds.has(s) || !visibleIds.has(t)) return false;
        // Only show the three semantic edges in isolate view (drop noise like
        // co-discussed etc, which is for person mode anyway).
        return l.kind === "prereq" || l.kind === "contrasted" || l.kind === "related";
      })
      .map((l) => ({
        ...l,
        source: typeof l.source === "string" ? l.source : (l.source as GraphNode).id,
        target: typeof l.target === "string" ? l.target : (l.target as GraphNode).id,
      }));

    return { nodes, links };
  }, [graph, isolatedId]);

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
    const cache = positionCacheRef.current[mode] ?? {};
    const nodes = graph.nodes
      .filter((n) => keep.has(n.id))
      // Spread to a new object so the simulation can mutate (vx, vy) without
      // touching the source data. Hydrate from the per-mode cache when we
      // have it (so returning to this mode gives the same layout); fall back
      // to a deterministic hash-seeded position for first-time nodes.
      // When cached, also set fx/fy so d3 pins the node and the sim can't
      // drift the whole layout when it reheats on data change. The
      // ForceGraph drag handler still works because it overrides fx/fy
      // during the drag.
      .map((n) => {
        const cached = cache[n.id];
        const pos = cached ?? seedPosition(n.id);
        const pinned = !!cached;
        return {
          ...n,
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
          ...(pinned ? { fx: pos.x, fy: pos.y } : {}),
        };
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

  // The active graph: in isolate mode this is the focused sub-graph with the
  // semantic Sugiyama layout; otherwise it's the normal force-directed view.
  const activeGraph = isolatedGraph ?? filteredGraph;

  const neighbors = useMemo(() => {
    const n: Record<string, Set<string>> = {};
    for (const l of activeGraph.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as GraphNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GraphNode).id;
      (n[s] ??= new Set()).add(t);
      (n[t] ??= new Set()).add(s);
    }
    return n;
  }, [activeGraph]);

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
    // In isolate view every node has fx/fy, so we want forces silent (the
    // pinned positions are the layout). Outside isolate, use the usual
    // exploration forces.
    charge?.strength?.(isolatedId ? 0 : isConceptsMode ? -180 : -110);
    const link = fg.d3Force("link") as Force | null;
    link?.distance?.(isolatedId ? 0 : isConceptsMode ? 75 : 60);

    const collide = forceCollide<RenderNode>()
      .radius((node) => {
        const r = (node.kind === "person" ? 5 : 6) + Math.min(5, (node.count ?? 1) * 0.6);
        return r + 5;
      })
      .strength(isolatedId ? 0 : 0.95)
      .iterations(2);
    (fg.d3Force as unknown as (n: string, f: unknown) => unknown)("collide", collide);

    fg.d3ReheatSimulation?.();

    // In isolate mode the simulation never "stops" via cooling (forces are
    // zero, alpha doesn't decay much), so onEngineStop won't trigger
    // zoomToFit. Schedule a one-shot frame-fit after the layout commits.
    if (isolatedId) {
      const t = setTimeout(() => {
        (fg as { zoomToFit?: (ms: number, padding: number) => void }).zoomToFit?.(500, 60);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [activeGraph, mode, isolatedId]);

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
        graphData={activeGraph as unknown as { nodes: GraphNode[]; links: GraphLink[] }}
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
          // Skip snapshotting in isolate mode — those positions are computed
          // deterministically and we don't want to confuse the force-mode cache.
          if (!isolatedId) {
            const snapshot: Record<string, { x: number; y: number }> = {};
            for (const raw of filteredGraph.nodes) {
              const n = raw as RenderNode;
              if (n.x != null && n.y != null) snapshot[n.id] = { x: n.x, y: n.y };
            }
            positionCacheRef.current[mode] = snapshot;
          }

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
