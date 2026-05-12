// Parse "(Episode N)" / "(Eps 5, 28)" / "Episode 12" style citations out of model output.

export interface ParsedCitation {
  start: number;
  end: number;
  episodes: number[];
  raw: string;
}

const PATTERNS: RegExp[] = [
  /\(Eps?\.?\s*([\d,\s&and]+)\)/gi,
  /\(Episodes?\s+([\d,\s&and]+)\)/gi,
  /\bEpisode\s+(\d{1,2})\b/g,
  /\bEp\.?\s*(\d{1,2})\b/g,
];

export function parseCitations(text: string): ParsedCitation[] {
  const hits: ParsedCitation[] = [];
  for (const re of PATTERNS) {
    const r = new RegExp(re.source, re.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text)) !== null) {
      const inner = m[1];
      const nums = Array.from(inner.matchAll(/\d+/g))
        .map((x) => Number(x[0]))
        .filter((n) => n >= 0 && n <= 50);
      if (!nums.length) continue;
      hits.push({ start: m.index, end: m.index + m[0].length, episodes: nums, raw: m[0] });
    }
  }
  // Deduplicate overlapping matches — prefer longer / earlier.
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const kept: ParsedCitation[] = [];
  for (const h of hits) {
    if (kept.some((k) => k.start < h.end && k.end > h.start)) continue;
    kept.push(h);
  }
  return kept.sort((a, b) => a.start - b.start);
}

// Split a string into [text|citation|text|...] chunks for rendering.
export type Chunk = { kind: "text"; text: string } | { kind: "citation"; episodes: number[]; raw: string };
export function chunkText(text: string): Chunk[] {
  const cites = parseCitations(text);
  if (!cites.length) return [{ kind: "text", text }];
  const out: Chunk[] = [];
  let cursor = 0;
  for (const c of cites) {
    if (c.start > cursor) out.push({ kind: "text", text: text.slice(cursor, c.start) });
    out.push({ kind: "citation", episodes: c.episodes, raw: c.raw });
    cursor = c.end;
  }
  if (cursor < text.length) out.push({ kind: "text", text: text.slice(cursor) });
  return out;
}
