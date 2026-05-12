// Merge Pass 3 enrichment files into concepts.json, then apply known-alias
// normalization to broken cross-references, then write back.
//
// Inputs:
//   data/registry/concepts.json
//   data/registry/_enrichment_<cluster>.json (one per cluster)
//
// Output:
//   data/registry/concepts.json (updated in place; old version backed up to concepts.pre-enrichment.json)

import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

interface SubConcept {
  id: string;
  name: string;
  summary: string;
  passages: { episode: number; phrase: string }[];
}
interface KeyPassage { episode: number; phrase: string; role: string; }
interface Enrichment {
  id: string;
  subConcepts?: SubConcept[];
  commonConfusions?: string[];
  keyPassages?: KeyPassage[];
}

// Canonical-alias map for broken cross-refs we already know about. Keys are the
// (incorrect/legacy) referenced id, values are the canonical id in the registry.
const CONCEPT_ID_ALIASES: Record<string, string> = {
  "axial-revolution": "the-axial-revolution",
  "having-mode": "having-mode-being-mode",
  "being-mode": "having-mode-being-mode",
  "sati": "mindfulness",
  "idos": "eidos",
  "perennial-problems": "the-perennial-problems",
  "wisdom-wiki": "wisdom",
  "the-solomon-effect": "view-from-above",
  "philia-nikia": "philia",
  "the-four-noble-truths": "dukkha",
  "right-concentration": "the-eightfold-path",
  "stoicism": "the-stoics",
  "psychedelics": "altered-states-of-consciousness",
  "depth-landscape": "salience-landscape",
  "presence-landscape": "salience-landscape",
  "having-mode-being-mode": "having-mode-being-mode", // keep as is
};

const PERSON_ID_ALIASES: Record<string, string> = {
  "dennett": "daniel-dennett",
  "mole": "christopher-mole",
  "harry-frankfurt": "harry-frankfurt", // would need adding
};

async function main() {
  const conceptsPath = path.join(ROOT, "data/registry/concepts.json");
  const concepts = JSON.parse(await readFile(conceptsPath, "utf8"));

  // Back up the pre-enrichment version
  await writeFile(
    path.join(ROOT, "data/registry/concepts.pre-enrichment.json"),
    JSON.stringify(concepts, null, 2)
  );

  // Load all enrichment files
  const regDir = path.join(ROOT, "data/registry");
  const files = (await readdir(regDir)).filter((f) => f.startsWith("_enrichment_") && f.endsWith(".json"));
  const enrichments: Record<string, Enrichment> = {};
  let totalLoaded = 0;
  for (const f of files) {
    const arr: Enrichment[] = JSON.parse(await readFile(path.join(regDir, f), "utf8"));
    for (const e of arr) {
      enrichments[e.id] = e;
      totalLoaded += 1;
    }
    console.log(`  loaded ${f}: ${arr.length} enrichments`);
  }
  console.log(`Total enrichments: ${totalLoaded}`);

  // Merge into concepts
  let merged = 0;
  let missing = 0;
  for (const c of concepts) {
    const e = enrichments[c.id];
    if (e) {
      if (e.subConcepts !== undefined) c.subConcepts = e.subConcepts;
      if (e.commonConfusions !== undefined) c.commonConfusions = e.commonConfusions;
      if (e.keyPassages !== undefined) c.keyPassages = e.keyPassages;
      merged += 1;
    } else {
      missing += 1;
    }
  }
  console.log(`Merged ${merged} concepts; ${missing} concepts have no enrichment yet`);

  // Apply canonical-alias normalization to all cross-references
  const conceptIds = new Set(concepts.map((c: { id: string }) => c.id));
  let normalized = 0;
  function normConcept(id: string): string | null {
    if (conceptIds.has(id)) return id;
    const a = CONCEPT_ID_ALIASES[id];
    if (a && conceptIds.has(a)) { normalized += 1; return a; }
    return null; // drop
  }
  for (const c of concepts) {
    for (const fld of ["prerequisites", "relatedConcepts", "contrastedWith"] as const) {
      if (!c[fld]) continue;
      c[fld] = (c[fld] as string[]).map(normConcept).filter((x): x is string => x !== null);
    }
    // De-dup
    for (const fld of ["prerequisites", "relatedConcepts", "contrastedWith"] as const) {
      if (c[fld]) c[fld] = Array.from(new Set(c[fld] as string[]));
    }
  }
  console.log(`Normalized ${normalized} concept references via alias map`);

  // Break dependency cycles (pick smaller side of each cycle to drop)
  const cycles = detectCycles(concepts);
  if (cycles.length) {
    console.log(`Breaking ${cycles.length} dependency cycle(s):`);
    for (const cyc of cycles) {
      // Drop the prerequisite edge from the last node back into the first
      const last = cyc[cyc.length - 2];
      const first = cyc[cyc.length - 1];
      const lastConcept = concepts.find((x: { id: string }) => x.id === last);
      if (lastConcept) {
        lastConcept.prerequisites = lastConcept.prerequisites.filter((p: string) => p !== first);
        console.log(`  dropped: ${last}.prerequisites -= ${first}`);
      }
    }
  }

  await writeFile(conceptsPath, JSON.stringify(concepts, null, 2));
  console.log(`Wrote ${conceptsPath}`);
}

function detectCycles(concepts: { id: string; prerequisites?: string[] }[]): string[][] {
  const ids = new Set(concepts.map((c) => c.id));
  const graph: Record<string, string[]> = {};
  for (const c of concepts) graph[c.id] = (c.prerequisites || []).filter((p) => ids.has(p));
  const cycles: string[][] = [];
  const color: Record<string, 0 | 1 | 2> = {};
  const stack: string[] = [];
  function dfs(node: string): void {
    if (color[node] === 1) {
      const i = stack.indexOf(node);
      cycles.push(stack.slice(i).concat(node));
      return;
    }
    if (color[node] === 2) return;
    color[node] = 1; stack.push(node);
    for (const n of graph[node] || []) dfs(n);
    stack.pop(); color[node] = 2;
  }
  for (const id of Object.keys(graph)) if (color[id] !== 2) dfs(id);
  return cycles;
}

main().catch((e) => { console.error(e); process.exit(1); });
