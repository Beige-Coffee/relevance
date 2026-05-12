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
      strokeSoft: dark ? "#3a4670" : "#a8b8e3",
      fill: dark ? "#0c1019" : "#ffffff",
      fillFlagship: dark ? "#3257d6" : "#1f3a8a",
      fillPerson: dark ? "#1d2747" : "#e6edff",
      strokePerson: dark ? "#6b8cf2" : "#3257d6",
      selected: dark ? "#d4b25c" : "#c08a2c",
      ink: dark ? "#e8ecf5" : "#0f1623",
      muted: dark ? "#7b8499" : "#6b7488",
      link: dark ? "#2a3548" : "#b8c3d6",
      linkActive: dark ? "#8aa1e3" : "#1f3a8a",
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

  // Build neighbor index for highlighting on hover.
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

  const activeId = hoverId ?? selectedId ?? null;
  const activeNeighbors = activeId ? neighbors[activeId] ?? new Set() : new Set();

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
          const base = node.kind === "person" ? 1 : 1.2;
          return base + Math.min(6, (node.count ?? 1) * 0.45);
        }}
        nodeLabel={(n) => (n as GraphNode).label}
        nodeCanvasObject={(rawNode, ctx, globalScale) => {
          const node = rawNode as RenderNode;
          if (node.x == null || node.y == null) return;
          const r = (node.kind === "person" ? 4.5 : 5.5) + Math.min(5, (node.count ?? 1) * 0.6);
          const selected = node.id === selectedId;
          const isActive = activeId === node.id;
          const isDimmed = activeId && !isActive && !activeNeighbors.has(node.id);

          ctx.globalAlpha = isDimmed ? 0.25 : 1;

          // Draw fill
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
          if (node.kind === "concept") {
            ctx.fillStyle = node.flagship ? palette.fillFlagship : palette.fill;
          } else {
            ctx.fillStyle = palette.fillPerson;
          }
          ctx.fill();

          // Draw stroke
          ctx.lineWidth = selected ? 2.4 : isActive ? 2 : 1.4;
          ctx.strokeStyle = selected
            ? palette.selected
            : node.kind === "concept"
              ? palette.stroke
              : palette.strokePerson;
          ctx.stroke();

          // Label visible when hovered/selected or zoomed in
          const showLabel = isActive || selected || globalScale > 1.4;
          if (showLabel) {
            ctx.font = `${Math.max(9, 11 / globalScale).toFixed(0)}px ui-sans-serif, system-ui`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = palette.ink;
            ctx.fillText(node.label, node.x, node.y + r + 2);
          }
          ctx.globalAlpha = 1;
        }}
        linkColor={(l) => {
          const link = l as GraphLink;
          if (!activeId) return palette.link;
          const s = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
          const t = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;
          if (s === activeId || t === activeId) return palette.linkActive;
          return palette.link;
        }}
        linkWidth={(l) => {
          const link = l as GraphLink;
          if (!activeId) return 0.8;
          const s = typeof link.source === "string" ? link.source : (link.source as GraphNode).id;
          const t = typeof link.target === "string" ? link.target : (link.target as GraphNode).id;
          return s === activeId || t === activeId ? 1.6 : 0.5;
        }}
        onNodeHover={(n) => setHoverId(n ? ((n as GraphNode).id) : null)}
        onNodeClick={(node) => onSelect(node as unknown as GraphNode)}
        onBackgroundClick={() => onSelect(null)}
        enableNodeDrag={true}
        cooldownTicks={500}
        d3AlphaDecay={0.018}
        d3VelocityDecay={0.55}
        d3AlphaMin={0.0015}
        warmupTicks={140}
      />
    </div>
  );
}
