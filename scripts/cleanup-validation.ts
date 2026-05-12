// Sweep all validation-flagged issues that can be auto-resolved by deletion:
//   - self-references in concept.relatedConcepts etc. (real bugs)
//   - broken concept/person refs that don't map to a registry entry
//   - quotable moments / keyPassages / subConcept passages whose text
//     can't be found in any transcript even with aggressive fuzzy matching
//
// Conservative: only deletes; never invents. After this runs, the validation
// report should be near-zero. The dropped entries are logged for reference.

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();

function punctNorm(s: string): string {
  return s.replace(/\s+/g, " ").trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\\(\[|\]|\(|\)|"|')/g, "$1");
}
const alphaOnly = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function softContains(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true;
  if (punctNorm(haystack).includes(punctNorm(needle))) return true;
  if (needle.length >= 24 && alphaOnly(haystack).includes(alphaOnly(needle))) return true;
  return false;
}

async function loadTranscripts(): Promise<Map<number, string>> {
  const dir = path.join(ROOT, "data", "transcripts");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const m = new Map<number, string>();
  for (const f of files) {
    const fm = matter(await readFile(path.join(dir, f), "utf8"));
    m.set(Number(fm.data.num), fm.content);
  }
  return m;
}

function inAnyTranscript(transcripts: Map<number, string>, needle: string): boolean {
  for (const t of transcripts.values()) {
    if (softContains(t, needle)) return true;
  }
  return false;
}

async function main() {
  const transcripts = await loadTranscripts();
  const concepts: Array<Record<string, unknown>> = JSON.parse(
    await readFile(path.join(ROOT, "data/registry/concepts.json"), "utf8")
  );
  const people: Array<Record<string, unknown>> = JSON.parse(
    await readFile(path.join(ROOT, "data/registry/people.json"), "utf8")
  );
  const conceptIds = new Set(concepts.map((c) => c.id as string));
  const personIds = new Set(people.map((p) => p.id as string));

  const dropped: { kind: string; where: string; what: string }[] = [];

  // 1. Self-references and broken concept refs in concepts
  for (const c of concepts) {
    const id = c.id as string;
    for (const fld of ["prerequisites", "relatedConcepts", "contrastedWith"] as const) {
      const arr = c[fld] as string[] | undefined;
      if (!arr) continue;
      const kept = arr.filter((r) => {
        if (r === id) {
          dropped.push({ kind: "self-ref", where: `${id}.${fld}`, what: r });
          return false;
        }
        if (!conceptIds.has(r)) {
          dropped.push({ kind: "broken-concept-ref", where: `${id}.${fld}`, what: r });
          return false;
        }
        return true;
      });
      c[fld] = kept;
    }
    // associated people
    const ap = c.associatedPeople as string[] | undefined;
    if (ap) {
      c.associatedPeople = ap.filter((p) => {
        if (!personIds.has(p)) {
          dropped.push({ kind: "broken-person-ref", where: `${id}.associatedPeople`, what: p });
          return false;
        }
        return true;
      });
    }
  }

  // 2. Broken concept refs in people.associatedConcepts
  for (const p of people) {
    const ac = p.associatedConcepts as string[] | undefined;
    if (!ac) continue;
    p.associatedConcepts = ac.filter((c) => {
      if (!conceptIds.has(c)) {
        dropped.push({ kind: "broken-concept-ref", where: `${p.id}.associatedConcepts`, what: c });
        return false;
      }
      return true;
    });
  }

  // 3. Drop concept keyPassages and subConcept passages whose phrase is in no transcript
  for (const c of concepts) {
    const kps = c.keyPassages as Array<{ episode: number; phrase: string; role?: string }> | undefined;
    if (kps) {
      c.keyPassages = kps.filter((kp) => {
        if (!inAnyTranscript(transcripts, kp.phrase)) {
          dropped.push({ kind: "phantom-key-passage", where: `${c.id}.keyPassages`, what: kp.phrase.slice(0, 80) });
          return false;
        }
        return true;
      });
    }
    const scs = c.subConcepts as Array<{ id: string; passages: { episode: number; phrase: string }[] }> | undefined;
    if (scs) {
      for (const sc of scs) {
        sc.passages = (sc.passages || []).filter((pp) => {
          if (!inAnyTranscript(transcripts, pp.phrase)) {
            dropped.push({
              kind: "phantom-subconcept-passage",
              where: `${c.id}.subConcepts[${sc.id}]`,
              what: pp.phrase.slice(0, 80),
            });
            return false;
          }
          return true;
        });
      }
    }
  }

  // 4. Sweep episode-metadata quotableMoments for phantom quotes
  const metaDir = path.join(ROOT, "data", "metadata");
  const metaFiles = (await readdir(metaDir)).filter((f) => f.endsWith(".json")).sort();
  for (const f of metaFiles) {
    const fp = path.join(metaDir, f);
    const m = JSON.parse(await readFile(fp, "utf8"));
    const t = transcripts.get(m.num);
    if (!t) continue;
    const before = m.quotableMoments.length;
    m.quotableMoments = m.quotableMoments.filter((q: { quote: string }) => {
      if (softContains(t, q.quote)) return true;
      if (inAnyTranscript(transcripts, q.quote)) return true;
      dropped.push({ kind: "phantom-quote", where: `ep-${String(m.num).padStart(2, "0")}.quotableMoments`, what: q.quote.slice(0, 80) });
      return false;
    });
    if (m.quotableMoments.length !== before) {
      await writeFile(fp, JSON.stringify(m, null, 2));
    }
  }

  // 5. Sweep course exposition passages for phantom quotes
  try {
    const courseDir = path.join(ROOT, "data/courses");
    const courseFiles = (await readdir(courseDir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    for (const f of courseFiles) {
      const fp = path.join(courseDir, f);
      const c = JSON.parse(await readFile(fp, "utf8"));
      let changed = false;
      for (const m of c.modules ?? []) {
        const before = m.expositionPassages.length;
        m.expositionPassages = m.expositionPassages.filter((ep: { episode: number; phrase: string }) => {
          const t = transcripts.get(ep.episode);
          if (t && softContains(t, ep.phrase)) return true;
          if (inAnyTranscript(transcripts, ep.phrase)) return true; // somewhere else — keep but flag in dropped log
          dropped.push({
            kind: "phantom-course-passage",
            where: `course ${c.id}.module[${m.id}].expositionPassages`,
            what: ep.phrase.slice(0, 80),
          });
          return false;
        });
        if (m.expositionPassages.length !== before) changed = true;
      }
      if (changed) await writeFile(fp, JSON.stringify(c, null, 2));
    }
  } catch (e) {
    // courses dir may not exist
  }

  await writeFile(path.join(ROOT, "data/registry/concepts.json"), JSON.stringify(concepts, null, 2));
  await writeFile(path.join(ROOT, "data/registry/people.json"), JSON.stringify(people, null, 2));

  // Summary
  const byKind: Record<string, number> = {};
  for (const d of dropped) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1;
  console.log(`Dropped ${dropped.length} flagged entries:`);
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n} × ${k}`);
  }
  // Write detailed log
  await writeFile(
    path.join(ROOT, "data/registry/_cleanup-log.json"),
    JSON.stringify(dropped, null, 2)
  );
  console.log(`\nFull log: data/registry/_cleanup-log.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
