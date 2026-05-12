// Build all derived data artifacts from data/transcripts/*.md + data/metadata/*.json.
// Outputs:
//   public/data/episodes.json        — episode list with title, slug, num, url, words, essence, keyClaims
//   public/data/concepts.json        — concepts with frequency + episode appearances
//   public/data/people.json          — people with frequency + episode appearances
//   public/data/graph.json           — nodes + links for force-graph viz
//   public/data/passages.json        — paragraph chunks for in-browser BM25 search
//   public/data/quotes.json          — quotable moments index
//   public/data/graph.cypher         — Neo4j Cypher import (bonus)
//   src/data/episodes.ts             — typed re-export for server code

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { canonicalConcept, canonicalPerson } from "./aliases.ts";

const ROOT = process.cwd();
const TRANS_DIR = path.join(ROOT, "data", "transcripts");
const META_DIR = path.join(ROOT, "data", "metadata");
const OUT_PUBLIC = path.join(ROOT, "public", "data");
const OUT_SRC = path.join(ROOT, "src", "data");

interface ConceptRef {
  name: string;
  treatment: "introduced" | "developed" | "applied" | "referenced";
  summary: string;
}
interface PersonRef {
  name: string;
  role: "subject" | "introduced" | "discussed" | "referenced";
  summary: string;
}
interface CrossRef {
  episode: number | null;
  context: string;
}
interface QuoteRef {
  quote: string;
  context: string;
}
interface EpisodeMeta {
  num: number;
  slug: string;
  title: string;
  essence: string;
  keyClaims: string[];
  concepts: ConceptRef[];
  people: PersonRef[];
  crossRefs: CrossRef[];
  quotableMoments: QuoteRef[];
}
interface TranscriptDoc {
  num: number;
  slug: string;
  title: string;
  url: string;
  words: number;
  body: string;
}

async function loadAll(): Promise<{ transcripts: TranscriptDoc[]; metadata: EpisodeMeta[] }> {
  const transcriptFiles = (await readdir(TRANS_DIR)).filter((f) => f.endsWith(".md")).sort();
  const transcripts: TranscriptDoc[] = [];
  for (const f of transcriptFiles) {
    const raw = await readFile(path.join(TRANS_DIR, f), "utf8");
    const fm = matter(raw);
    transcripts.push({
      num: Number(fm.data.num),
      slug: String(fm.data.slug),
      title: String(fm.data.title),
      url: String(fm.data.url),
      words: Number(fm.data.words),
      body: fm.content.trim(),
    });
  }

  const metaFiles = (await readdir(META_DIR)).filter((f) => f.endsWith(".json")).sort();
  const metadata: EpisodeMeta[] = [];
  for (const f of metaFiles) {
    const raw = await readFile(path.join(META_DIR, f), "utf8");
    metadata.push(JSON.parse(raw));
  }
  return { transcripts, metadata };
}

// Chunk a transcript into ~400-600 word passages, splitting on paragraph boundaries.
// Each passage carries the episode num, sequence index, and word range for citation.
interface Passage {
  id: string;
  episode: number;
  episodeTitle: string;
  episodeSlug: string;
  seq: number;
  text: string;
  words: number;
  wordStart: number;
  wordEnd: number;
}

function chunkTranscript(t: TranscriptDoc, target = 450, max = 700): Passage[] {
  const paragraphs = t.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const passages: Passage[] = [];
  let buf: string[] = [];
  let bufWords = 0;
  let seq = 0;
  let runningWord = 0;
  let startWord = 0;

  const flush = () => {
    if (!buf.length) return;
    const text = buf.join("\n\n");
    const words = bufWords;
    passages.push({
      id: `ep-${String(t.num).padStart(2, "0")}-p${String(seq).padStart(3, "0")}`,
      episode: t.num,
      episodeTitle: t.title,
      episodeSlug: t.slug,
      seq,
      text,
      words,
      wordStart: startWord,
      wordEnd: startWord + words,
    });
    seq += 1;
    startWord = runningWord;
    buf = [];
    bufWords = 0;
  };

  for (const p of paragraphs) {
    const w = p.split(/\s+/).filter(Boolean).length;
    if (bufWords + w > max && bufWords >= target * 0.5) {
      flush();
    }
    buf.push(p);
    bufWords += w;
    runningWord += w;
    if (bufWords >= target) flush();
  }
  flush();
  return passages;
}

function buildIndices(metadata: EpisodeMeta[]) {
  const conceptMap = new Map<string, { name: string; episodes: number[]; treatments: Record<string, number>; summaries: { ep: number; text: string }[] }>();
  const personMap = new Map<string, { name: string; episodes: number[]; roles: Record<string, number>; summaries: { ep: number; text: string }[] }>();

  for (const ep of metadata) {
    for (const c of ep.concepts) {
      const canonical = canonicalConcept(c.name);
      if (!conceptMap.has(canonical)) {
        conceptMap.set(canonical, { name: canonical, episodes: [], treatments: {}, summaries: [] });
      }
      const entry = conceptMap.get(canonical)!;
      entry.episodes.push(ep.num);
      entry.treatments[c.treatment] = (entry.treatments[c.treatment] ?? 0) + 1;
      entry.summaries.push({ ep: ep.num, text: c.summary });
    }
    for (const p of ep.people) {
      const canonical = canonicalPerson(p.name);
      if (!personMap.has(canonical)) {
        personMap.set(canonical, { name: canonical, episodes: [], roles: {}, summaries: [] });
      }
      const entry = personMap.get(canonical)!;
      entry.episodes.push(ep.num);
      entry.roles[p.role] = (entry.roles[p.role] ?? 0) + 1;
      entry.summaries.push({ ep: ep.num, text: p.summary });
    }
  }

  const concepts = Array.from(conceptMap.values())
    .map((c) => ({ ...c, count: c.episodes.length, episodes: Array.from(new Set(c.episodes)).sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const people = Array.from(personMap.values())
    .map((p) => ({ ...p, count: p.episodes.length, episodes: Array.from(new Set(p.episodes)).sort((a, b) => a - b) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { concepts, people };
}

function buildGraph(metadata: EpisodeMeta[], concepts: ReturnType<typeof buildIndices>["concepts"], people: ReturnType<typeof buildIndices>["people"]) {
  type Node = { id: string; kind: "episode" | "concept" | "person"; label: string; num?: number; count?: number };
  type Link = { source: string; target: string; kind: string; label?: string };

  const nodes: Node[] = [];
  const links: Link[] = [];

  for (const ep of metadata) {
    nodes.push({ id: `ep:${ep.num}`, kind: "episode", label: `${ep.num}. ${ep.title}`, num: ep.num });
  }
  for (const c of concepts) {
    nodes.push({ id: `concept:${c.name}`, kind: "concept", label: c.name, count: c.count });
  }
  for (const p of people) {
    nodes.push({ id: `person:${p.name}`, kind: "person", label: p.name, count: p.count });
  }

  for (const ep of metadata) {
    for (const c of ep.concepts) {
      const canonical = canonicalConcept(c.name);
      links.push({ source: `ep:${ep.num}`, target: `concept:${canonical}`, kind: c.treatment });
    }
    for (const p of ep.people) {
      const canonical = canonicalPerson(p.name);
      links.push({ source: `ep:${ep.num}`, target: `person:${canonical}`, kind: p.role });
    }
    for (const x of ep.crossRefs) {
      if (typeof x.episode === "number" && x.episode !== ep.num) {
        links.push({ source: `ep:${ep.num}`, target: `ep:${x.episode}`, kind: "references", label: x.context });
      }
    }
  }

  return { nodes, links };
}

function buildCypher(metadata: EpisodeMeta[], concepts: ReturnType<typeof buildIndices>["concepts"], people: ReturnType<typeof buildIndices>["people"]): string {
  const lines: string[] = [];
  lines.push("// Neo4j import for Awakening from the Meaning Crisis graph");
  lines.push("// Run: cat graph.cypher | cypher-shell\n");
  for (const ep of metadata) {
    lines.push(
      `CREATE (:Episode {num: ${ep.num}, slug: '${ep.slug.replace(/'/g, "\\'")}', title: '${ep.title.replace(/'/g, "\\'")}', essence: '${ep.essence.replace(/'/g, "\\'").slice(0, 1000)}'});`
    );
  }
  for (const c of concepts) {
    lines.push(`CREATE (:Concept {name: '${c.name.replace(/'/g, "\\'")}', count: ${c.count}});`);
  }
  for (const p of people) {
    lines.push(`CREATE (:Person {name: '${p.name.replace(/'/g, "\\'")}', count: ${p.count}});`);
  }
  for (const ep of metadata) {
    for (const c of ep.concepts) {
      const canonical = canonicalConcept(c.name);
      lines.push(
        `MATCH (e:Episode {num: ${ep.num}}), (c:Concept {name: '${canonical.replace(/'/g, "\\'")}'}) CREATE (e)-[:${c.treatment.toUpperCase()}]->(c);`
      );
    }
    for (const p of ep.people) {
      const canonical = canonicalPerson(p.name);
      lines.push(
        `MATCH (e:Episode {num: ${ep.num}}), (p:Person {name: '${canonical.replace(/'/g, "\\'")}'}) CREATE (e)-[:${p.role.toUpperCase()}]->(p);`
      );
    }
    for (const x of ep.crossRefs) {
      if (typeof x.episode === "number" && x.episode !== ep.num) {
        lines.push(`MATCH (a:Episode {num: ${ep.num}}), (b:Episode {num: ${x.episode}}) CREATE (a)-[:REFERENCES]->(b);`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

async function main() {
  await mkdir(OUT_PUBLIC, { recursive: true });
  await mkdir(OUT_SRC, { recursive: true });

  console.log("Loading transcripts + metadata...");
  const { transcripts, metadata } = await loadAll();
  console.log(`  ${transcripts.length} transcripts, ${metadata.length} metadata files`);

  console.log("Building concept and people indices...");
  const { concepts, people } = buildIndices(metadata);
  console.log(`  ${concepts.length} unique concepts, ${people.length} unique people`);

  console.log("Building graph...");
  const graph = buildGraph(metadata, concepts, people);
  console.log(`  ${graph.nodes.length} nodes, ${graph.links.length} links`);

  console.log("Chunking transcripts into passages...");
  let totalPassages = 0;
  const passages: Passage[] = [];
  for (const t of transcripts) {
    const ps = chunkTranscript(t);
    totalPassages += ps.length;
    passages.push(...ps);
  }
  console.log(`  ${totalPassages} passages across ${transcripts.length} episodes`);

  console.log("Collecting quotable moments...");
  const quotes = metadata.flatMap((ep) =>
    ep.quotableMoments.map((q, i) => ({
      id: `ep-${String(ep.num).padStart(2, "0")}-q${i}`,
      episode: ep.num,
      episodeTitle: ep.title,
      episodeSlug: ep.slug,
      quote: q.quote,
      context: q.context,
    }))
  );
  console.log(`  ${quotes.length} quotes`);

  console.log("Building episode index...");
  const episodeIndex = metadata.map((ep) => {
    const t = transcripts.find((x) => x.num === ep.num);
    return {
      num: ep.num,
      slug: ep.slug,
      title: ep.title,
      url: t?.url ?? "",
      words: t?.words ?? 0,
      essence: ep.essence,
      keyClaims: ep.keyClaims,
      conceptCount: ep.concepts.length,
      peopleCount: ep.people.length,
    };
  });

  console.log("Writing outputs...");
  await writeFile(path.join(OUT_PUBLIC, "episodes.json"), JSON.stringify(episodeIndex, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "concepts.json"), JSON.stringify(concepts, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "people.json"), JSON.stringify(people, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "graph.json"), JSON.stringify(graph, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "passages.json"), JSON.stringify(passages));
  await writeFile(path.join(OUT_PUBLIC, "quotes.json"), JSON.stringify(quotes, null, 2));
  await writeFile(path.join(OUT_PUBLIC, "graph.cypher"), buildCypher(metadata, concepts, people));

  // Server-side typed JSON imports
  await writeFile(path.join(OUT_SRC, "episodes.json"), JSON.stringify(episodeIndex));
  await writeFile(path.join(OUT_SRC, "concepts.json"), JSON.stringify(concepts));
  await writeFile(path.join(OUT_SRC, "people.json"), JSON.stringify(people));

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
