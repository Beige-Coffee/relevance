"use client";

import { useEffect, useRef, useState } from "react";

interface Cluster {
  id: string;
  label: string;
  color: string;
  definition: string;
}

const CLUSTERS: Cluster[] = [
  {
    id: "cognitive-science",
    label: "Cognitive science",
    color: "#1f3a8a",
    definition:
      "Concepts from cognitive science, AI, and the mechanics of mind: relevance realization, working memory, attention, insight, the frame problem. The technical backbone of Vervaeke's argument.",
  },
  {
    id: "historical",
    label: "Historical",
    color: "#5b3e89",
    definition:
      "Movements, eras, and intellectual lineages: the Axial Age, Gnosticism, the Reformation, the rise of secularism. The story of how the meaning crisis came to be.",
  },
  {
    id: "normative",
    label: "Normative",
    color: "#1f6f6c",
    definition:
      "Ethical and existential ideas: wisdom, virtue, agape, the four kinds of knowing, what a good life looks like. Concepts about what should be, not just what is.",
  },
  {
    id: "practical",
    label: "Practical",
    color: "#a85c1a",
    definition:
      "Psychotechnologies, the practices and techniques people use to cultivate wisdom and address the crisis: meditation, contemplation, dialogos, ritual.",
  },
  {
    id: "methodological",
    label: "Methodological",
    color: "#1f3a8a",
    definition:
      "Tools for analyzing the territory: phenomenology, comparative analysis, the careful distinctions Vervaeke draws between things people often run together.",
  },
];

export function LegendBar({ mode }: { mode: "concepts" | "persons" }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click or Escape.
  useEffect(() => {
    if (!moreOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <div ref={containerRef} className="flex items-center gap-3 text-[11px] text-[var(--ink-soft)] relative">
      {mode === "concepts" ? (
        <>
          <div className="hidden lg:flex items-center gap-3">
            {CLUSTERS.map((c) => (
              <ClusterPill key={c.id} cluster={c} />
            ))}
          </div>
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-tint)] transition-colors"
            title="Open the full legend"
          >
            <InfoIcon />
            <span className="hidden md:inline">Legend</span>
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[var(--border)] text-[var(--ink-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-tint)] transition-colors"
            title="Open the full legend"
          >
            <InfoIcon />
            <span className="hidden md:inline">Legend</span>
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
              <h3 className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">Clusters</h3>
              <div className="space-y-2.5">
                {CLUSTERS.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <span
                      className="shrink-0 mt-[3px] inline-block w-3 h-3 rounded-full border-[1.5px]"
                      style={{ background: c.color, borderColor: c.color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] text-[var(--ink)] font-medium">{c.label}</div>
                      <div className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">
                        {c.definition}
                      </div>
                    </div>
                  </div>
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

function InfoIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" />
    </svg>
  );
}

function ClusterPill({ cluster }: { cluster: Cluster }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex items-center gap-1 whitespace-nowrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: cluster.color }} aria-hidden />
      <span className="cursor-help underline decoration-dotted decoration-[var(--border)] underline-offset-4">
        {cluster.label}
      </span>
      {open && (
        <div
          role="tooltip"
          className="absolute top-full left-0 mt-2 z-40 w-[280px] rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg p-3 text-[11px] text-[var(--ink-soft)] leading-snug normal-case tracking-normal"
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: cluster.color }}
              aria-hidden
            />
            <span className="text-[12px] text-[var(--ink)] font-medium">{cluster.label}</span>
          </div>
          <p>{cluster.definition}</p>
        </div>
      )}
    </span>
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
