"use client";

import { useState } from "react";

const CLUSTERS: { id: string; label: string; color: string }[] = [
  { id: "cognitive-science", label: "Cognitive science", color: "#1f3a8a" },
  { id: "historical", label: "Historical", color: "#5b3e89" },
  { id: "normative", label: "Normative", color: "#1f6f6c" },
  { id: "practical", label: "Practical", color: "#a85c1a" },
  { id: "methodological", label: "Methodological", color: "#1f3a8a" },
];

export function LegendBar({ mode }: { mode: "concepts" | "persons" }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="flex items-center gap-3 text-[11px] text-[var(--ink-soft)] relative">
      {mode === "concepts" ? (
        <>
          <div className="hidden lg:flex items-center gap-3">
            {CLUSTERS.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} aria-hidden />
                <span>{c.label}</span>
              </span>
            ))}
          </div>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--elev)]"
            title="Legend details"
          >
            <span className="text-[12px]">?</span>
            <span className="hidden md:inline">legend</span>
          </button>
        </>
      ) : (
        <>
          <span className="hidden md:inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-[#3257d6] bg-[#e6edff]" />
            Thinker
          </span>
          <span className="hidden md:inline text-[var(--muted)]">
            edges connect thinkers Vervaeke discusses together
          </span>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--elev)]"
          >
            <span className="text-[12px]">?</span>
            <span className="hidden md:inline">legend</span>
          </button>
        </>
      )}

      {moreOpen && (
        <div className="absolute top-full right-0 mt-2 z-30 w-[320px] rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg p-4 text-xs text-[var(--ink-soft)] space-y-3">
          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">Nodes</h3>
            {mode === "concepts" ? (
              <div className="space-y-1.5">
                <Row color="#1f3a8a" filled={false} label="Concept" />
                <Row color="#1f3a8a" filled={true} label="Flagship concept" sub="has a Conversation" />
              </div>
            ) : (
              <Row color="#3257d6" filled={false} ringFill="#e6edff" label="Thinker" />
            )}
          </div>

          {mode === "concepts" && (
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">Clusters</h3>
              <div className="space-y-1">
                {CLUSTERS.map((c) => (
                  <Row key={c.id} color={c.color} filled={true} label={c.label} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1.5">Edges</h3>
            {mode === "concepts" ? (
              <div className="space-y-1.5">
                <EdgeRow style="solid" label="Related" sub="adjacent in Vervaeke's framework" />
                <EdgeRow style="arrow" label="Prerequisite" sub="this concept depends on that one" />
                <EdgeRow style="dashed" label="Contrasted" sub="explicitly positioned against" />
                <p className="text-[11px] leading-snug text-[var(--muted)] mt-2">
                  Edges come from the canonical registry. Opus tagged each concept with its prerequisites, related concepts, and contrasted concepts after reading all 51 transcripts.
                </p>
              </div>
            ) : (
              <p className="text-[11px] leading-snug">
                A line connects two thinkers when Vervaeke discusses them in relation to shared concepts or in the same episodes. Line thickness scales with overlap.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  color,
  filled,
  ringFill,
  label,
  sub,
}: {
  color: string;
  filled: boolean;
  ringFill?: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="shrink-0 inline-block w-3 h-3 rounded-full border-[1.5px]"
        style={{ background: filled ? color : ringFill ?? "transparent", borderColor: color }}
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
