"use client";

import {
  type ModelDetails,
  COMPARISON_BASELINE_ID,
  estimateCostPerTurn,
  OPENROUTER_MODEL_DETAILS,
} from "@/lib/anthropic";

interface Props {
  model: ModelDetails;
  active: boolean;
  onSelect: () => void;
}

export function ModelCard({ model, active, onSelect }: Props) {
  const baseline = OPENROUTER_MODEL_DETAILS.find((m) => m.id === COMPARISON_BASELINE_ID);
  const ratio = baseline ? compareCost(model, baseline) : null;
  const costPerTurn = estimateCostPerTurn(model);
  return (
    <button
      onClick={onSelect}
      className={`text-left w-full rounded-xl border p-5 transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-tint)] shadow-sm"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--elev)] hover:border-[var(--accent)]/40"
      }`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-medium text-[var(--ink)] leading-tight">{model.name}</h3>
          <div className="text-xs text-[var(--muted)] mt-0.5">{model.vendor}</div>
        </div>
        {active ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--accent)] text-white font-medium">
            Active
          </span>
        ) : model.recommendedFor ? (
          <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--accent)]/50 text-[var(--accent)]">
            {model.recommendedFor}
          </span>
        ) : null}
      </header>

      <div className="inline-flex items-center px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg-tinted)] mono text-xs mb-4">
        <span className="text-[var(--ink)] font-medium">${costPerTurn.toFixed(3)}</span>
        <span className="text-[var(--muted)] ml-1">/ turn (est.)</span>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
        <Stat label="Input" value={`$${model.inputPerM.toFixed(2)}/M`} />
        <Stat label="Output" value={`$${model.outputPerM.toFixed(2)}/M`} />
        <Stat label="Context" value={model.contextLabel} />
        <Stat label="Speed" value={model.speedLabel} />
        <Stat label="Code" value={<Dots filled={model.capabilities.code} />} />
        <Stat label="Tool calls" value={<Dots filled={model.capabilities.toolCalls} />} />
        <Stat label="Reasoning" value={<Dots filled={model.capabilities.reasoning} />} />
        {ratio && (
          <Stat label="vs Sonnet 4.6" value={ratio} />
        )}
      </div>

      <p className="text-[13px] text-[var(--ink-soft)] leading-relaxed mt-4 italic">
        {model.description}
      </p>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] mb-0.5">{label}</div>
      <div className="text-[13px] text-[var(--ink)] font-medium">{value}</div>
    </div>
  );
}

function Dots({ filled, total = 5 }: { filled: number; total?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${filled} out of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i < filled ? "bg-[var(--ink)]" : "border border-[var(--ink)]/30"
          }`}
        />
      ))}
    </span>
  );
}

function compareCost(model: ModelDetails, baseline: ModelDetails): string {
  const mCost = estimateCostPerTurn(model);
  const bCost = estimateCostPerTurn(baseline);
  if (Math.abs(mCost - bCost) < 0.0001) return "Same";
  if (mCost < bCost) {
    const ratio = bCost / mCost;
    return `${ratio.toFixed(1)}× cheaper`;
  }
  const ratio = mCost / bCost;
  return `${ratio.toFixed(1)}× pricier`;
}
