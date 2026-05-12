// For every concept's sourcePassage whose quote doesn't grep-match its claimed episode,
// search all transcripts to find where the quote actually lives, and auto-correct the
// episode number. Same for keyPassages and subConcept passages.

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();

interface KeyPassage { episode: number; phrase: string; role: string; }
interface SubConcept { id: string; name: string; summary: string; passages: { episode: number; phrase: string }[]; }
interface Concept {
  id: string;
  sourcePassage: { episode: number; quote: string };
  keyPassages?: KeyPassage[];
  subConcepts?: SubConcept[];
  [key: string]: unknown;
}

function punctNorm(s: string): string {
  return s.replace(/\s+/g, " ").trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\\(\[|\]|\(|\)|"|')/g, "$1");
}

function alphaOnly(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function softContains(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true;
  if (punctNorm(haystack).includes(punctNorm(needle))) return true;
  if (needle.length >= 24 && alphaOnly(haystack).includes(alphaOnly(needle))) return true;
  return false;
}

async function loadTranscripts(): Promise<Map<number, string>> {
  const dir = path.join(ROOT, "data", "transcripts");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const map = new Map<number, string>();
  for (const f of files) {
    const raw = await readFile(path.join(dir, f), "utf8");
    const fm = matter(raw);
    map.set(Number(fm.data.num), fm.content);
  }
  return map;
}

function findEpisode(transcripts: Map<number, string>, needle: string, claimedEp: number): number | null {
  // Try exact substring in claimed episode first (might already match)
  const claimedText = transcripts.get(claimedEp);
  if (claimedText && (claimedText.includes(needle) || punctNorm(claimedText).includes(punctNorm(needle)))) {
    return claimedEp;
  }
  // Search all transcripts
  const matches: number[] = [];
  for (const [ep, text] of transcripts) {
    if (softContains(text, needle)) {
      matches.push(ep);
    }
  }
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) return null;
  // Multiple matches — pick the one closest to claimed
  matches.sort((a, b) => Math.abs(a - claimedEp) - Math.abs(b - claimedEp));
  return matches[0];
}

async function main() {
  const transcripts = await loadTranscripts();
  const concepts: Concept[] = JSON.parse(await readFile(path.join(ROOT, "data/registry/concepts.json"), "utf8"));

  let corrected = 0;
  let unresolved = 0;
  const unresolvedList: { id: string; field: string; ep: number; phrase: string }[] = [];

  for (const c of concepts) {
    // sourcePassage
    const claim = c.sourcePassage.episode;
    const text = transcripts.get(claim);
    const inClaimed = text && (text.includes(c.sourcePassage.quote) || punctNorm(text).includes(punctNorm(c.sourcePassage.quote)));
    if (!inClaimed) {
      const found = findEpisode(transcripts, c.sourcePassage.quote, claim);
      if (found !== null && found !== claim) {
        console.log(`  ${c.id}.sourcePassage  ep ${claim} → ep ${found}`);
        c.sourcePassage.episode = found;
        corrected += 1;
      } else if (found === null) {
        unresolved += 1;
        unresolvedList.push({ id: c.id, field: "sourcePassage", ep: claim, phrase: c.sourcePassage.quote });
      }
    }

    // keyPassages
    for (const kp of c.keyPassages ?? []) {
      const t = transcripts.get(kp.episode);
      const ok = t && softContains(t, kp.phrase);
      if (!ok) {
        const found = findEpisode(transcripts, kp.phrase, kp.episode);
        if (found !== null && found !== kp.episode) {
          console.log(`  ${c.id}.keyPassages   ep ${kp.episode} → ep ${found}`);
          kp.episode = found;
          corrected += 1;
        } else if (found === null) {
          unresolved += 1;
          unresolvedList.push({ id: c.id, field: "keyPassages", ep: kp.episode, phrase: kp.phrase });
        }
      }
    }

    // subConcept passages
    for (const sc of c.subConcepts ?? []) {
      for (const pp of sc.passages ?? []) {
        const t = transcripts.get(pp.episode);
        const ok = t && softContains(t, pp.phrase);
        if (!ok) {
          const found = findEpisode(transcripts, pp.phrase, pp.episode);
          if (found !== null && found !== pp.episode) {
            console.log(`  ${c.id}.subConcepts[${sc.id}]  ep ${pp.episode} → ep ${found}`);
            pp.episode = found;
            corrected += 1;
          } else if (found === null) {
            unresolved += 1;
            unresolvedList.push({ id: c.id, field: `subConcepts[${sc.id}]`, ep: pp.episode, phrase: pp.phrase });
          }
        }
      }
    }
  }

  console.log(`\nCorrected ${corrected} episode attributions`);
  console.log(`Unresolved (quote not in any transcript): ${unresolved}`);
  if (unresolvedList.length) {
    console.log("\nUnresolved (need manual cleanup):");
    for (const u of unresolvedList) {
      console.log(`  [${u.id}].${u.field}  ep ${u.ep}: "${u.phrase.slice(0, 80)}..."`);
    }
  }

  await writeFile(path.join(ROOT, "data/registry/concepts.json"), JSON.stringify(concepts, null, 2));
  console.log(`\nWrote concepts.json with ${corrected} corrections`);
}

main().catch((e) => { console.error(e); process.exit(1); });
