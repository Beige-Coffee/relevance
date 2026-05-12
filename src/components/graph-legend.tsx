"use client";

import { useState } from "react";
import type { GraphMode } from "./graph-canvas";

const CLUSTERS: { id: string; label: string; color: string }[] = [
  { id: "cognitive-science", label: "Cognitive science", color: "#1f3a8a" },
  { id: "historical", label: "Historical", color: "#5b3e89" },
  { id: "normative", label: "Normative", color: "#1f6f6c" },
  { id: "practical", label: "Practical", color: "#a85c1a" },
  { id: "methodological", label: "Methodological", color: "#1f3a8a" },
];

export function GraphLegend({ mode }: { mode: GraphMode }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute bottom-5 right-5 z-10">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur shadow-sm max-w-[300px]">
        <button
          onClick={() => setOpen(!open)}
          className="w-full px-3 py-1.5 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]"
        >
          <span>Legend</span>
          <span className="text-[var(--ink-soft)]">{open ? "−" : "+"}</span>
        </button>

        {open && (
          <div className="px-3 pb-3 space-y-1.5 text-xs text-[var(--ink-soft)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mt-1">Nodes</div>
            {mode === "concepts" ? (
              <>
                <Row color="#1f3a8a" outline label="Concept" />
                <Row color="#1f3a8a" filled label="Flagship concept" sub="has a Conversation" />
              </>
            ) : (
              <Row color="#3257d6" outline ringFill="#e6edff" label="Thinker" />
            )}

            {mode === "concepts" && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mt-2">Clusters</div>
                {CLUSTERS.map((c) => (
                  <Row key={c.id} color={c.color} filled label={c.label} />
                ))}
              </>
            )}

            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mt-2">Edges</div>
            {mode === "concepts" ? (
              <div className="space-y-1.5">
                <EdgeRow style="solid" label="Related" sub="adjacent in Vervaeke's framework" />
                <EdgeRow style="arrow" label="Prerequisite" sub="this concept depends on that one" />
                <EdgeRow style="dashed" label="Contrasted" sub="explicitly positioned against" />
                <p className="text-[11px] leading-snug text-[var(--muted)] mt-2">
                  Edges come from the canonical registry. An Opus reading of all 51 transcripts tagged each concept with its prerequisites, related concepts, and contrasted concepts. The graph renders those tags.
                </p>
              </div>
            ) : (
              <p className="text-[11px] leading-snug">
                A line connects two thinkers when Vervaeke discusses them in relation to shared concepts or in the same episodes. Line thickness scales with the strength of overlap (more shared concepts and episodes means a heavier line).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  color,
  filled,
  outline,
  ringFill,
  label,
  sub,
}: {
  color: string;
  filled?: boolean;
  outline?: boolean;
  ringFill?: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 inline-block w-3 h-3 rounded-full border-[1.5px]"
        style={{
          background: filled ? color : ringFill ?? "transparent",
          borderColor: color,
        }}
        aria-hidden
      />
      <span>
        {label}
        {sub && <span className="text-[10px] text-[var(--muted)] ml-1.5">({sub})</span>}
      </span>
    </div>
  );
}

function EdgeRow({ style, label, sub }: { style: "solid" | "dashed" | "arrow"; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="32" height="10" className="shrink-0" aria-hidden>
        {style === "dashed" ? (
          <line x1="2" y1="5" x2="30" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        ) : style === "arrow" ? (
          <>
            <line x1="2" y1="5" x2="26" y2="5" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="26,2 30,5 26,8" fill="currentColor" />
          </>
        ) : (
          <line x1="2" y1="5" x2="30" y2="5" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      <span className="text-[12px]">
        {label}
        {sub && <span className="text-[10px] text-[var(--muted)] ml-1.5">{sub}</span>}
      </span>
    </div>
  );
}
