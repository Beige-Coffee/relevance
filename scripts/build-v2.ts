// Build all derived data artifacts from the canonical registry + per-episode
// metadata + courses. This is the v2 build aligned with the registry-based data
// model produced by the 5-pass rebuild.
//
// Inputs:
//   data/registry/concepts.json — canonical concepts with full enrichment
//   data/registry/people.json   — canonical people
//   data/metadata/ep-NN.json    — per-episode metadata (uses canonical IDs)
//   data/courses/<id>.json      — pre-curated mini-courses for flagship concepts
//   data/transcripts/ep-NN-*.md — raw transcripts (frontmatter + body)
//
// Outputs to public/data/ (browser-accessible) and src/data/ (server-importable):
//   episodes.json   — episode index + essence + key claims
//   concepts.json   — full canonical concepts (pass-through, includes enrichment)
//   people.json     — full canonical people (pass-through)
//   graph.json      — nodes + links for force-graph
//   passages.json   — paragraph chunks for BM25 search (in public/ only)
//   quotes.json     — verbatim quotable moments
//   courses.json    — index of all courses (summary)
//   graph.cypher    — Neo4j dump

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const OUT_PUBLIC = path.join(ROOT, "public", "data");
const OUT_SRC = path.join(ROOT, "src", "data");

interface Concept {
  id: string;
  canonicalName: string;
  aliases?: string[];
  definition: string;
  sourcePassage: { episode: number; quote: string };
  depth: number;
  cluster: string;
  introducedIn: number;
  developedIn: number[];
  appliedIn: number[];
  prerequisites: string[];
  relatedConcepts: string[];
  contrastedWith?: string[];
  associatedPeople: string[];
  isFlagship: boolean;
  notes?: string | null;
  subConcepts?: SubConcept[];
  commonConfusions?: string[];
  keyPassages?: KeyPassage[];
}
interface SubConcept {
  id: string;
  name: string;
  summary: string;
  passages: { episode: number; phrase: string }[];
}
interface KeyPassage { episode: number; phrase: string; role: string; }
interface Person {
  id: string;
  canonicalName: string;
  aliases?: string[];
  shortBio: string;
  roleInArgument: string;
  introducedIn: number;
  discussedIn: number[];
  associatedConcepts: string[];
  keyClaimsAbout: string[];
  notes?: string | null;
}
interface EpisodeMeta {
  num: number;
  slug: string;
  title: string;
  essence: string;
  keyClaims: string[];
  concepts: { id: string; treatment: string; summary: string }[];
  people: { id: string; role: string; summary: string }[];
  crossRefs: { episode: number | null; context: string }[];
  quotableMoments: { quote: string; context: string }[];
}
interface Transcript { num: number; slug: string; title: string; url: string; words: number; body: string; }
interface Course {
  id: string; title: string; conceptId: string;
  abstract: string; prerequisites: string[];
  modules: Module[];
}
interface Module {
  id: string; title: string; subConceptId: string | null;
  learningObjective: string;
  expositionPassages: { episode: number; phrase: string; note?: string }[];
  socraticSeeds: { prompt: string; expectedThemes: string[] }[];
  misconceptionBranches: { misconception: string; correction: string }[];
  checkForUnderstanding: { prompt: string; expectedThemes: string[] };
}

async function loadAll() {
  const concepts: Concept[] = JSON.parse(await readFile(path.join(ROOT, "data/registry/concepts.json"), "utf8"));
  const people: Person[] = JSON.parse(await readFile(path.join(ROOT, "data/registry/people.json"), "utf8"));

  const transDir = path.join(ROOT, "data", "transcripts");
  const transcripts: Transcript[] = [];
  for (const f of (await readdir(transDir)).filter((f) => f.endsWith(".md")).sort()) {
    const fm = matter(await readFile(path.join(transDir, f), "utf8"));
    transcripts.push({
      num: Number(fm.data.num),
      slug: String(fm.data.slug),
      title: String(fm.data.title),
      url: String(fm.data.url),
      words: Number(fm.data.words),
      body: fm.content.trim(),
    });
  }

  const metaDir = path.join(ROOT, "data", "metadata");
  const metadata: EpisodeMeta[] = [];
  for (const f of (await readdir(metaDir)).filter((f) => f.endsWith(".json")).sort()) {
    metadata.push(JSON.parse(await readFile(path.join(metaDir, f), "utf8")));
  }

  const courseDir = path.join(ROOT, "data", "courses");
  const courses: Course[] = [];
  try {
    for (const f of (await readdir(courseDir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
      courses.push(JSON.parse(await readFile(path.join(courseDir, f), "utf8")));
    }
  } catch {
    // courses/ may not exist if Pass 5 hasn't run yet
  }

  return { concepts, people, transcripts, metadata, courses };
}

interface Passage {
  id: string; episode: number; episodeTitle: string; episodeSlug: string;
  seq: number; text: string; words: number; wordStart: number; wordEnd: number;
}
function chunkTranscript(t: Transcript, target = 450, max = 700): Passage[] {
  const paragraphs = t.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const passages: Passage[] = [];
  let buf: string[] = []; let bufWords = 0; let seq = 0;
  let runningWord = 0; let startWord = 0;
  const flush = () => {
    if (!buf.length) return;
    const text = buf.join("\n\n");
    passages.push({
      id: `ep-${String(t.num).padStart(2, "0")}-p${String(seq).padStart(3, "0")}`,
      episode: t.num, episodeTitle: t.title, episodeSlug: t.slug,
      seq, text, words: bufWords, wordStart: startWord, wordEnd: startWord + bufWords,
    });
    seq += 1; startWord = runningWord; buf = []; bufWords = 0;
  };
  for (const p of paragraphs) {
    const w = p.split(/\s+/).filter(Boolean).length;
    if (bufWords + w > max && bufWords >= target * 0.5) flush();
    buf.push(p); bufWords += w; runningWord += w;
    if (bufWords >= target) flush();
  }
  flush();
  return passages;
}

function buildGraph(concepts: Concept[], people: Person[], metadata: EpisodeMeta[]) {
  type Node = { id: string; kind: "episode" | "concept" | "person"; label: string; num?: number; flagship?: boolean; cluster?: string; count?: number };
  type Link = { source: string; target: string; kind: string; weight?: number };
  const nodes: Node[] = [];
  const links: Link[] = [];

  const episodeMap = new Map<number, EpisodeMeta>(metadata.map((m) => [m.num, m]));

  for (const m of metadata) {
    nodes.push({ id: `ep:${m.num}`, kind: "episode", label: `${m.num}. ${m.title}`, num: m.num });
  }
  for (const c of concepts) {
    const count =
      (c.introducedIn ? 1 : 0) +
      (c.developedIn?.length ?? 0) +
      (c.appliedIn?.length ?? 0);
    nodes.push({
      id: `concept:${c.id}`, kind: "concept", label: c.canonicalName,
      flagship: c.isFlagship, cluster: c.cluster, count,
    });
  }
  for (const p of people) {
    nodes.push({
      id: `person:${p.id}`, kind: "person", label: p.canonicalName,
      count: p.discussedIn?.length ?? 0,
    });
  }

  // Episode → concept (introduced/developed/applied), via the concept's own fields
  for (const c of concepts) {
    if (c.introducedIn != null) links.push({ source: `ep:${c.introducedIn}`, target: `concept:${c.id}`, kind: "introduced" });
    for (const e of c.developedIn ?? []) links.push({ source: `ep:${e}`, target: `concept:${c.id}`, kind: "developed" });
    for (const e of c.appliedIn ?? []) links.push({ source: `ep:${e}`, target: `concept:${c.id}`, kind: "applied" });
    for (const p of c.associatedPeople ?? []) {
      links.push({ source: `concept:${c.id}`, target: `person:${p}`, kind: "associated" });
    }
    for (const r of c.relatedConcepts ?? []) {
      if (r !== c.id) links.push({ source: `concept:${c.id}`, target: `concept:${r}`, kind: "related" });
    }
    for (const r of c.prerequisites ?? []) {
      if (r !== c.id) links.push({ source: `concept:${c.id}`, target: `concept:${r}`, kind: "prereq" });
    }
  }
  // Episode → person (from per-episode metadata)
  for (const m of metadata) {
    for (const p of m.people) {
      links.push({ source: `ep:${m.num}`, target: `person:${p.id}`, kind: p.role });
    }
    for (const x of m.crossRefs) {
      if (typeof x.episode === "number" && x.episode !== m.num && episodeMap.has(x.episode)) {
        links.push({ source: `ep:${m.num}`, target: `ep:${x.episode}`, kind: "references" });
      }
    }
  }

  // Derive person ↔ person edges from shared concepts and shared episodes.
  // Two thinkers are connected if Vervaeke discusses them in relation to the same
  // ideas. Weight is the overlap count; we only keep edges with weight >= 1.
  const personConcepts: Record<string, Set<string>> = {};
  for (const c of concepts) {
    for (const pid of c.associatedPeople ?? []) {
      (personConcepts[pid] ??= new Set()).add(c.id);
    }
  }
  const personEpisodes: Record<string, Set<number>> = {};
  for (const p of people) {
    personEpisodes[p.id] = new Set(p.discussedIn);
  }
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i].id;
      const b = people[j].id;
      const sharedConcepts = intersect(personConcepts[a] ?? new Set(), personConcepts[b] ?? new Set()).size;
      const sharedEpisodes = intersect(personEpisodes[a] ?? new Set(), personEpisodes[b] ?? new Set()).size;
      const weight = sharedConcepts * 2 + sharedEpisodes;
      if (weight >= 4) {
        links.push({ source: `person:${a}`, target: `person:${b}`, kind: "co-discussed", weight } as GraphLink & { weight: number });
      }
    }
  }

  // Derive concept ↔ concept edges from shared associated people and shared episodes
  // (in addition to the explicit relatedConcepts already added). This makes the
  // graph richer for cluster discovery.
  // (Skipped for now: relatedConcepts alone is already 533 concept-concept edges.)

  return { nodes, links };
}

function intersect<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const x of a) if (b.has(x)) out.add(x);
  return out;
}

function buildCypher(concepts: Concept[], people: Person[], metadata: EpisodeMeta[]): string {
  const esc = (s: string) => s.replace(/'/g, "\\'");
  const lines: string[] = [
    "// Neo4j import for Awakening Atlas",
    "// cat graph.cypher | cypher-shell\n",
  ];
  for (const m of metadata) {
    lines.push(`CREATE (:Episode {num: ${m.num}, slug: '${esc(m.slug)}', title: '${esc(m.title)}'});`);
  }
  for (const c of concepts) {
    lines.push(`CREATE (:Concept {id: '${esc(c.id)}', name: '${esc(c.canonicalName)}', cluster: '${esc(c.cluster)}', depth: ${c.depth}, flagship: ${c.isFlagship}});`);
  }
  for (const p of people) {
    lines.push(`CREATE (:Person {id: '${esc(p.id)}', name: '${esc(p.canonicalName)}'});`);
  }
  for (const c of concepts) {
    if (c.introducedIn != null)
      lines.push(`MATCH (e:Episode {num:${c.introducedIn}}),(c:Concept {id:'${esc(c.id)}'}) CREATE (e)-[:INTRODUCED]->(c);`);
    for (const e of c.developedIn ?? [])
      lines.push(`MATCH (e:Episode {num:${e}}),(c:Concept {id:'${esc(c.id)}'}) CREATE (e)-[:DEVELOPED]->(c);`);
    for (const e of c.appliedIn ?? [])
      lines.push(`MATCH (e:Episode {num:${e}}),(c:Concept {id:'${esc(c.id)}'}) CREATE (e)-[:APPLIED]->(c);`);
    for (const r of c.prerequisites ?? [])
      lines.push(`MATCH (a:Concept {id:'${esc(c.id)}'}),(b:Concept {id:'${esc(r)}'}) CREATE (a)-[:PREREQ]->(b);`);
    for (const r of c.relatedConcepts ?? [])
      lines.push(`MATCH (a:Concept {id:'${esc(c.id)}'}),(b:Concept {id:'${esc(r)}'}) CREATE (a)-[:RELATED]->(b);`);
  }
  for (const m of metadata) {
    for (const x of m.crossRefs) {
      if (typeof x.episode === "number") {
        lines.push(`MATCH (a:Episode {num:${m.num}}),(b:Episode {num:${x.episode}}) CREATE (a)-[:REFERENCES]->(b);`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

async function main() {
  await mkdir(OUT_PUBLIC, { recursive: true });
  await mkdir(OUT_SRC, { recursive: true });

  console.log("Loading...");
  const { concepts, people, transcripts, metadata, courses } = await loadAll();
  console.log(`  ${concepts.length} concepts (${concepts.filter((c) => c.isFlagship).length} flagship)`);
  console.log(`  ${people.length} people, ${transcripts.length} transcripts, ${metadata.length} metadata files`);
  console.log(`  ${courses.length} courses`);

  // Episode index
  const epIndex = metadata.map((m) => {
    const t = transcripts.find((x) => x.num === m.num);
    return {
      num: m.num,
      slug: m.slug,
      title: m.title,
      url: t?.url ?? "",
      words: t?.words ?? 0,
      essence: m.essence,
      keyClaims: m.keyClaims,
      conceptCount: m.concepts.length,
      peopleCount: m.people.length,
    };
  });

  // Courses index (per-course summary; full courses live at /data/courses/<id>.json individually)
  const courseIndex = courses.map((c) => ({
    id: c.id, title: c.title, conceptId: c.conceptId,
    abstract: c.abstract,
    moduleCount: c.modules.length,
    prerequisites: c.prerequisites,
  }));

  // Passages for BM25
  const passages: Passage[] = [];
  for (const t of transcripts) passages.push(...chunkTranscript(t));

  // Quotes (use only verified ones from metadata)
  const quotes = metadata.flatMap((m) =>
    m.quotableMoments.map((q, i) => ({
      id: `ep-${String(m.num).padStart(2, "0")}-q${i}`,
      episode: m.num, episodeTitle: m.title, episodeSlug: m.slug,
      quote: q.quote, context: q.context,
    }))
  );

  console.log("Building graph...");
  const graph = buildGraph(concepts, people, metadata);
  console.log(`  ${graph.nodes.length} nodes, ${graph.links.length} links`);

  console.log("Writing outputs...");
  await writeFile(path.join(OUT_PUBLIC, "episodes.json"), JSON.stringify(epIndex, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "concepts.json"), JSON.stringify(concepts, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "people.json"), JSON.stringify(people, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "graph.json"), JSON.stringify(graph, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "passages.json"), JSON.stringify(passages));
  await writeFile(path.join(OUT_PUBLIC, "quotes.json"), JSON.stringify(quotes, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "courses.json"), JSON.stringify(courseIndex, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "graph.cypher"), buildCypher(concepts, people, metadata));

  // Also copy individual course JSONs to public for direct fetch
  await mkdir(path.join(OUT_PUBLIC, "courses"), { recursive: true });
  for (const c of courses) {
    await writeFile(path.join(OUT_PUBLIC, "courses", `${c.id}.json`), JSON.stringify(c, null, 2));
  }

  // Server-importable copies
  await writeFile(path.join(OUT_SRC, "episodes.json"), JSON.stringify(epIndex));
  await writeFile(path.join(OUT_SRC, "concepts.json"), JSON.stringify(concepts));
  await writeFile(path.join(OUT_SRC, "people.json"), JSON.stringify(people));

  console.log(`  episodes: ${epIndex.length}`);
  console.log(`  concepts: ${concepts.length}`);
  console.log(`  people: ${people.length}`);
  console.log(`  passages: ${passages.length}`);
  console.log(`  quotes: ${quotes.length}`);
  console.log(`  courses: ${courses.length}`);
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
