import type { Passage } from "@/lib/types";

export function PassageCard({ passage, score }: { passage: Passage; score?: number }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--accent)]/40 transition-colors">
      <header className="flex items-center justify-between mb-2 text-xs">
        <span className="mono text-[var(--accent)]">
          Episode {passage.episode} <span className="text-[var(--muted)]">· {passage.episodeTitle}</span>
        </span>
        {score !== undefined && (
          <span className="mono text-[var(--muted)]">score {score.toFixed(2)}</span>
        )}
      </header>
      <p className="serif text-[15px] leading-relaxed text-[var(--ink)]">{passage.text}</p>
    </article>
  );
}
