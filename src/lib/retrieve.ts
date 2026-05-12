"use client";

import MiniSearch from "minisearch";
import type { Passage } from "./types";
import { getPassages } from "./data";

let index: MiniSearch<Passage> | null = null;
let indexedPassages: Passage[] = [];
let indexPromise: Promise<{ index: MiniSearch<Passage>; passages: Passage[] }> | null = null;

async function getIndex() {
  if (index) return { index, passages: indexedPassages };
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const passages = await getPassages();
    indexedPassages = passages;
    const ms = new MiniSearch<Passage>({
      fields: ["text", "episodeTitle"],
      storeFields: ["episode", "episodeTitle", "seq", "text", "wordStart", "id"],
      idField: "id",
      searchOptions: {
        boost: { episodeTitle: 2 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: "AND",
      },
    });
    ms.addAll(passages);
    index = ms;
    return { index: ms, passages };
  })();
  return indexPromise;
}

export interface RetrievalResult {
  passage: Passage;
  score: number;
}

export async function retrieve(query: string, k = 8): Promise<RetrievalResult[]> {
  const { index: idx, passages } = await getIndex();
  let results = idx.search(query);
  if (results.length < k) {
    // Fall back to OR if AND returned too few hits.
    results = idx.search(query, { combineWith: "OR" });
  }
  const byId = new Map(passages.map((p) => [p.id, p]));
  return results.slice(0, k).flatMap((r) => {
    const p = byId.get(r.id);
    return p ? [{ passage: p, score: r.score }] : [];
  });
}

export function passageExcerpt(text: string, max = 280): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
