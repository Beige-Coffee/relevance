"use client";

import { type ModelDetails, estimateCostPerTurn } from "@/lib/anthropic";

interface Props {
  model: ModelDetails;
  active: boolean;
  onSelect: () => void;
}

export function ModelCard({ model, active, onSelect }: Props) {
  const costPerTurn = estimateCostPerTurn(model);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border px-4 py-2.5 transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-tint)]"
          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40 hover:bg-[var(--elev)]"
      }`}
    >
      <div className="flex items-center gap-4">
        {/* Name + vendor: fixed minimum width so it can't be squeezed */}
        <div className="min-w-[180px] max-w-[220px] flex-shrink-0">
          <div className="text-sm font-medium text-[var(--ink)] truncate leading-tight">{model.name}</div>
          <div className="text-[11px] text-[var(--muted)] truncate">{model.vendor}</div>
        </div>

        {/* Stats strip: just the headline numbers. I/O prices live in the
            description row below where there's more room. */}
        <div className="flex items-center gap-3 text-[11px] mono flex-1 min-w-0 overflow-hidden whitespace-nowrap text-[var(--ink-soft)]">
          <span><span className="text-[var(--ink)] font-medium">${costPerTurn.toFixed(3)}</span><span className="text-[var(--muted)]">/turn</span></span>
          <span className="text-[var(--muted)]">·</span>
          <span>{model.contextLabel}</span>
          <span className="text-[var(--muted)]">·</span>
          <span>{model.speedLabel}</span>
        </div>

        {/* Capability dots: fixed width, never wraps */}
        <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
          <Cap label="code" filled={model.capabilities.code} />
          <Cap label="tools" filled={model.capabilities.toolCalls} />
          <Cap label="reason" filled={model.capabilities.reasoning} />
        </div>

        {/* Badge slot: reserved width so all rows align */}
        <div className="w-[88px] flex-shrink-0 flex justify-end">
          {active ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent)] text-white font-medium">
              Active
            </span>
          ) : model.recommendedFor ? (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--accent)]/50 text-[var(--accent)] whitespace-nowrap">
              {model.recommendedFor}
            </span>
          ) : null}
        </div>
      </div>

      {/* Description row: include the I/O prices as a mono prefix so they're
          available without dominating the headline. */}
      <div className="flex items-baseline gap-3 mt-1.5 ml-[196px]">
        <span className="text-[11px] mono text-[var(--muted)] whitespace-nowrap shrink-0">
          ${formatPrice(model.inputPerM)} <span className="opacity-70">in</span> · ${formatPrice(model.outputPerM)} <span className="opacity-70">out</span> /M
        </span>
        <p className="text-[12px] text-[var(--ink-soft)] italic leading-snug">
          {model.description}
        </p>
      </div>
    </button>
  );
}

function formatPrice(n: number): string {
  return n >= 10 ? n.toFixed(0) : n < 1 ? n.toFixed(2).replace(/\.?0+$/, "") || "0" : n.toFixed(1).replace(/\.0$/, "");
}

function Cap({ label, filled, total = 5 }: { label: string; filled: number; total?: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <span className="inline-flex items-center gap-[2px]" aria-label={`${filled} out of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`inline-block w-[5px] h-[5px] rounded-full ${
              i < filled ? "bg-[var(--ink)]" : "border border-[var(--ink)]/30"
            }`}
          />
        ))}
      </span>
    </span>
  );
}
