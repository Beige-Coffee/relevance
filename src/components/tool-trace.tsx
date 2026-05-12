"use client";

import type { ToolEventLog } from "@/lib/types";

interface Props {
  events: ToolEventLog[];
}

export function ToolTrace({ events }: Props) {
  if (!events?.length) return null;
  return (
    <div className="text-[11px] text-[var(--muted)] mb-2 space-y-0.5">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-center gap-1.5">
          <span className="opacity-70">›</span>
          <span className="mono">{ev.name}</span>
          <span className="opacity-70">{formatInput(ev.name, ev.input)}</span>
          {ev.done ? (
            <span className="opacity-70">→ {summarize(ev.name, ev.result)}{ev.cached ? " (cached)" : ""}</span>
          ) : (
            <span className="opacity-70">…</span>
          )}
        </div>
      ))}
    </div>
  );
}

function formatInput(name: string, input: Record<string, unknown>): string {
  if (name === "look_up") return `"${input.query as string}"`;
  if (name === "read_concept") return `${input.id as string}`;
  if (name === "verify_quote") {
    const q = String(input.quote ?? "");
    const trimmed = q.length > 40 ? q.slice(0, 38) + "…" : q;
    return `Ep ${input.episode}: "${trimmed}"`;
  }
  return "";
}

function summarize(name: string, result: unknown): string {
  if (!result || typeof result !== "object") return "done";
  const r = result as Record<string, unknown>;
  if (r.error) return String(r.error).slice(0, 80);
  if (name === "look_up") {
    const n = Array.isArray(r.passages) ? (r.passages as unknown[]).length : 0;
    return `${n} passage${n === 1 ? "" : "s"}`;
  }
  if (name === "read_concept") {
    return (r.canonicalName as string) ?? "ok";
  }
  if (name === "verify_quote") {
    if (r.found === true) return "verified";
    if (r.foundInOtherEpisode !== undefined) return `wrong episode (actually Ep ${r.foundInOtherEpisode})`;
    return "not found";
  }
  return "done";
}
