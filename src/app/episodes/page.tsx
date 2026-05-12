"use client";

import { useEffect, useState } from "react";
import { getEpisodes } from "@/lib/data";
import type { Episode } from "@/lib/types";

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getEpisodes().then(setEpisodes);
  }, []);

  const matches = (episodes ?? []).filter((e) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return e.title.toLowerCase().includes(q) || e.essence.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 w-full">
      <h1 className="serif text-4xl text-[var(--ink)]">Episodes</h1>
      <p className="text-[var(--ink-soft)] mt-2 text-sm">
        Each of the 50 lectures, with an essence summary. Click a title to open the original transcript.
      </p>

      <input
        type="text"
        placeholder="Filter episodes by title or content…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-6 w-full px-4 py-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] text-sm"
      />

      <ul className="mt-8 space-y-6">
        {!episodes && <li className="text-[var(--muted)]">Loading…</li>}
        {episodes && matches.length === 0 && (
          <li className="text-[var(--muted)] text-sm">No episodes match &ldquo;{filter}&rdquo;.</li>
        )}
        {matches.map((e) => (
          <li key={e.num} id={`ep-${e.num}`} className="border-b border-[var(--border)] pb-6 scroll-mt-20">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="ep-num text-xs">EP {String(e.num).padStart(2, "0")}</span>
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="serif text-2xl text-[var(--ink)] hover:text-[var(--accent)] leading-tight"
              >
                {e.title}
              </a>
            </div>
            <p className="prose-reader text-[15px]">{e.essence}</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted)]">
              <span>{e.words.toLocaleString()} words</span>
              <span>·</span>
              <span>{e.conceptCount} concepts</span>
              <span>·</span>
              <span>{e.peopleCount} people</span>
              <span>·</span>
              <a className="lnk" href={e.url} target="_blank" rel="noreferrer">
                Open at meaningcrisis.co ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
