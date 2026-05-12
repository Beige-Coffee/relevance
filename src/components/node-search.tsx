"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Concept, Person, GraphNode } from "@/lib/types";

interface Props {
  concepts: Concept[];
  people: Person[];
  mode: "concepts" | "persons";
  onSelect: (node: GraphNode) => void;
}

interface Hit {
  kind: "concept" | "person";
  id: string;
  label: string;
  sub?: string;
  flagship?: boolean;
  color?: string;
}

const CLUSTER_COLORS: Record<string, string> = {
  "cognitive-science": "#1f3a8a",
  historical: "#5b3e89",
  normative: "#1f6f6c",
  practical: "#a85c1a",
  methodological: "#1f3a8a",
};

export function NodeSearch({ concepts, people, mode, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Reset query whenever the mode toggles so a stale concept query
  // doesn't sit in the box after switching to Thinkers (and vice versa).
  useEffect(() => {
    setQ("");
    setOpen(false);
    setActiveIdx(0);
  }, [mode]);

  const matches = useMemo((): Hit[] => {
    const lower = q.trim().toLowerCase();
    if (!lower) return [];
    if (mode === "concepts") {
      return concepts
        .filter((c) => {
          if (c.canonicalName.toLowerCase().includes(lower)) return true;
          if (c.id.includes(lower)) return true;
          return (c.aliases ?? []).some((a) => a.toLowerCase().includes(lower));
        })
        .slice(0, 8)
        .map((c) => ({
          kind: "concept",
          id: c.id,
          label: c.canonicalName,
          sub: c.cluster,
          flagship: c.isFlagship,
          color: CLUSTER_COLORS[c.cluster],
        }));
    }
    return people
      .filter((p) => {
        if (p.canonicalName.toLowerCase().includes(lower)) return true;
        if (p.id.includes(lower)) return true;
        return (p.aliases ?? []).some((a) => a.toLowerCase().includes(lower));
      })
      .slice(0, 8)
      .map((p) => ({
        kind: "person",
        id: p.id,
        label: p.canonicalName,
        sub: p.shortBio.split(/[.,;]/)[0],
      }));
  }, [q, concepts, people, mode]);

  function pick(hit: Hit) {
    const node: GraphNode = hit.kind === "concept"
      ? {
          id: `concept:${hit.id}`,
          kind: "concept",
          label: hit.label,
          flagship: hit.flagship,
          cluster: hit.sub,
        }
      : {
          id: `person:${hit.id}`,
          kind: "person",
          label: hit.label,
        };
    onSelect(node);
    setQ("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(matches[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[360px]">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActiveIdx(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={mode === "concepts" ? "Search concepts..." : "Search thinkers..."}
          className="w-full pl-8 pr-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] text-[13px] focus:outline-none focus:border-[var(--accent)]"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-30 rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-lg overflow-hidden">
          {matches.map((m, i) => (
            <button
              key={`${m.kind}-${m.id}`}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                i === activeIdx ? "bg-[var(--accent-tint)]" : "hover:bg-[var(--elev)]"
              }`}
            >
              {m.kind === "concept" ? (
                <span
                  className="shrink-0 w-2.5 h-2.5 rounded-full border-[1.5px]"
                  style={{
                    background: m.flagship ? (m.color ?? "var(--accent)") : "transparent",
                    borderColor: m.color ?? "var(--accent)",
                  }}
                  aria-hidden
                />
              ) : (
                <span className="shrink-0 w-2.5 h-2.5 rounded-full border-[1.5px] border-[#3257d6] bg-[#e6edff]" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="text-[13px] text-[var(--ink)] block truncate">{m.label}</span>
                {m.sub && <span className="text-[11px] text-[var(--muted)] block truncate">{m.sub}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
