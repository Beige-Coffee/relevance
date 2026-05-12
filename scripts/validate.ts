// Pass 4: Programmatic validation of the registry + metadata + course content.
// Checks every quote against the transcripts, every cross-reference, and every
// dependency relationship. Emits a single HTML report at
// data/registry/_validation-report.html that the user can open and triage.

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();

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
interface KeyPassage {
  episode: number;
  phrase: string;
  role: string;
}
interface Person {
  id: string;
  canonicalName: string;
  shortBio: string;
  roleInArgument: string;
  introducedIn: number;
  discussedIn: number[];
  associatedConcepts: string[];
  keyClaimsAbout: string[];
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

type IssueSeverity = "error" | "warning" | "info";
interface Issue {
  severity: IssueSeverity;
  category: string;
  where: string;
  message: string;
  detail?: string;
}

function fuzzyContains(haystack: string, needle: string): boolean {
  // Exact substring check first (fast path)
  if (haystack.includes(needle)) return true;
  // Normalize whitespace and try again
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const h = norm(haystack);
  const n = norm(needle);
  if (h.includes(n)) return true;
  // Try with normalized punctuation (smart quotes etc.) + backslash-escapes
  const punctNorm = (s: string) =>
    norm(s)
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/\\(\[|\]|\(|\)|"|')/g, "$1"); // remove markdown backslash-escapes
  if (punctNorm(h).includes(punctNorm(n))) return true;
  // Last-resort fallback: alphanumeric-only comparison. Catches quotes where the
  // only divergence is punctuation/whitespace/escapes we haven't enumerated.
  const alphaOnly = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (n.length < 24) return false; // too short to be reliable
  return alphaOnly(h).includes(alphaOnly(n));
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

async function loadAll() {
  const concepts: Concept[] = JSON.parse(
    await readFile(path.join(ROOT, "data/registry/concepts.json"), "utf8")
  );
  const people: Person[] = JSON.parse(
    await readFile(path.join(ROOT, "data/registry/people.json"), "utf8")
  );
  const transcripts = await loadTranscripts();
  const metaDir = path.join(ROOT, "data", "metadata");
  const metaFiles = (await readdir(metaDir)).filter((f) => f.endsWith(".json")).sort();
  const metadata: EpisodeMeta[] = [];
  for (const f of metaFiles) {
    metadata.push(JSON.parse(await readFile(path.join(metaDir, f), "utf8")));
  }
  return { concepts, people, transcripts, metadata };
}

function detectCycles(concepts: Concept[]): string[][] {
  const ids = new Set(concepts.map((c) => c.id));
  const graph: Record<string, string[]> = {};
  for (const c of concepts) {
    graph[c.id] = (c.prerequisites || []).filter((p) => ids.has(p));
  }
  const cycles: string[][] = [];
  const color: Record<string, 0 | 1 | 2> = {};
  const stack: string[] = [];

  function dfs(node: string): boolean {
    if (color[node] === 1) {
      const i = stack.indexOf(node);
      cycles.push(stack.slice(i).concat(node));
      return true;
    }
    if (color[node] === 2) return false;
    color[node] = 1;
    stack.push(node);
    for (const next of graph[node] || []) {
      dfs(next);
    }
    stack.pop();
    color[node] = 2;
    return false;
  }
  for (const id of Object.keys(graph)) {
    if (color[id] !== 2) dfs(id);
  }
  return cycles;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pluralize(n: number, w: string): string {
  return `${n} ${w}${n === 1 ? "" : "s"}`;
}

async function main() {
  console.log("Loading...");
  const { concepts, people, transcripts, metadata } = await loadAll();
  const conceptIds = new Set(concepts.map((c) => c.id));
  const personIds = new Set(people.map((p) => p.id));
  const issues: Issue[] = [];

  console.log("Validating concept source quotes...");
  for (const c of concepts) {
    const t = transcripts.get(c.sourcePassage.episode);
    if (!t) {
      issues.push({
        severity: "error",
        category: "Missing episode",
        where: `concept ${c.id}.sourcePassage`,
        message: `sourcePassage refers to ep ${c.sourcePassage.episode} but no transcript loaded`,
      });
    } else if (!fuzzyContains(t, c.sourcePassage.quote)) {
      issues.push({
        severity: "error",
        category: "Quote not verbatim",
        where: `concept ${c.id}.sourcePassage`,
        message: `quote not found in ep ${c.sourcePassage.episode}`,
        detail: c.sourcePassage.quote.slice(0, 200),
      });
    }
  }

  console.log("Validating concept cross-references...");
  for (const c of concepts) {
    for (const [field, refs] of [
      ["prerequisites", c.prerequisites],
      ["relatedConcepts", c.relatedConcepts],
      ["contrastedWith", c.contrastedWith ?? []],
    ] as const) {
      for (const r of refs) {
        if (!conceptIds.has(r)) {
          issues.push({
            severity: "warning",
            category: "Broken concept ref",
            where: `concept ${c.id}.${field}`,
            message: `references unknown concept '${r}'`,
          });
        }
        if (r === c.id) {
          issues.push({
            severity: "error",
            category: "Self-reference",
            where: `concept ${c.id}.${field}`,
            message: `concept references itself`,
          });
        }
      }
    }
    for (const p of c.associatedPeople) {
      if (!personIds.has(p)) {
        issues.push({
          severity: "warning",
          category: "Broken person ref",
          where: `concept ${c.id}.associatedPeople`,
          message: `references unknown person '${p}'`,
        });
      }
    }
  }

  console.log("Validating person associatedConcepts...");
  for (const p of people) {
    for (const c of p.associatedConcepts) {
      if (!conceptIds.has(c)) {
        issues.push({
          severity: "warning",
          category: "Broken concept ref",
          where: `person ${p.id}.associatedConcepts`,
          message: `references unknown concept '${c}'`,
        });
      }
    }
  }

  console.log("Validating metadata IDs...");
  for (const m of metadata) {
    for (const c of m.concepts) {
      if (!conceptIds.has(c.id)) {
        issues.push({
          severity: "error",
          category: "Broken metadata ref",
          where: `ep-${String(m.num).padStart(2, "0")} concepts`,
          message: `unknown concept id '${c.id}'`,
        });
      }
    }
    for (const p of m.people) {
      if (!personIds.has(p.id)) {
        issues.push({
          severity: "error",
          category: "Broken metadata ref",
          where: `ep-${String(m.num).padStart(2, "0")} people`,
          message: `unknown person id '${p.id}'`,
        });
      }
    }
    for (const x of m.crossRefs) {
      if (x.episode != null && (x.episode < 0 || x.episode > 50)) {
        issues.push({
          severity: "warning",
          category: "Invalid episode",
          where: `ep-${String(m.num).padStart(2, "0")} crossRefs`,
          message: `references nonexistent episode ${x.episode}`,
        });
      }
    }
  }

  console.log("Validating metadata quotes...");
  for (const m of metadata) {
    const t = transcripts.get(m.num);
    if (!t) continue;
    for (let i = 0; i < m.quotableMoments.length; i++) {
      const q = m.quotableMoments[i];
      if (!fuzzyContains(t, q.quote)) {
        issues.push({
          severity: "warning",
          category: "Quote not verbatim",
          where: `ep-${String(m.num).padStart(2, "0")} quotableMoments[${i}]`,
          message: `quote not found in transcript`,
          detail: q.quote.slice(0, 200),
        });
      }
    }
  }

  console.log("Validating enrichment passages...");
  for (const c of concepts) {
    for (const sc of c.subConcepts ?? []) {
      for (const pp of sc.passages ?? []) {
        const t = transcripts.get(pp.episode);
        if (!t) {
          issues.push({
            severity: "error",
            category: "Missing episode",
            where: `concept ${c.id}.subConcepts[${sc.id}]`,
            message: `references ep ${pp.episode} not in transcripts`,
          });
        } else if (!fuzzyContains(t, pp.phrase)) {
          issues.push({
            severity: "warning",
            category: "Quote not verbatim",
            where: `concept ${c.id}.subConcepts[${sc.id}]`,
            message: `phrase not found in ep ${pp.episode}`,
            detail: pp.phrase.slice(0, 200),
          });
        }
      }
    }
    for (let i = 0; i < (c.keyPassages ?? []).length; i++) {
      const kp = c.keyPassages![i];
      const t = transcripts.get(kp.episode);
      if (!t) {
        issues.push({
          severity: "error",
          category: "Missing episode",
          where: `concept ${c.id}.keyPassages[${i}]`,
          message: `references ep ${kp.episode} not in transcripts`,
        });
      } else if (!fuzzyContains(t, kp.phrase)) {
        issues.push({
          severity: "warning",
          category: "Quote not verbatim",
          where: `concept ${c.id}.keyPassages[${i}]`,
          message: `phrase not found in ep ${kp.episode}`,
          detail: kp.phrase.slice(0, 200),
        });
      }
    }
  }

  console.log("Validating course content...");
  try {
    const courseDir = path.join(ROOT, "data/courses");
    const courseFiles = (await readdir(courseDir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
    for (const f of courseFiles) {
      const c = JSON.parse(await readFile(path.join(courseDir, f), "utf8"));
      const courseId = c.id;
      if (!conceptIds.has(c.conceptId)) {
        issues.push({
          severity: "error", category: "Broken concept ref",
          where: `course ${courseId}`, message: `conceptId '${c.conceptId}' not in registry`,
        });
      }
      for (const p of c.prerequisites ?? []) {
        if (!conceptIds.has(p)) {
          issues.push({
            severity: "warning", category: "Broken concept ref",
            where: `course ${courseId}.prerequisites`, message: `unknown concept '${p}'`,
          });
        }
      }
      for (let mi = 0; mi < (c.modules ?? []).length; mi++) {
        const m = c.modules[mi];
        for (let pi = 0; pi < (m.expositionPassages ?? []).length; pi++) {
          const ep = m.expositionPassages[pi];
          const t = transcripts.get(ep.episode);
          if (!t) {
            issues.push({
              severity: "error", category: "Missing episode",
              where: `course ${courseId}.modules[${mi}].expositionPassages[${pi}]`,
              message: `ep ${ep.episode} not in transcripts`,
            });
          } else if (!fuzzyContains(t, ep.phrase)) {
            issues.push({
              severity: "warning", category: "Quote not verbatim",
              where: `course ${courseId}.modules[${mi}].expositionPassages[${pi}]`,
              message: `phrase not found in ep ${ep.episode}`,
              detail: ep.phrase.slice(0, 200),
            });
          }
        }
      }
    }
  } catch (e) {
    console.log("  (no courses dir or error: " + (e instanceof Error ? e.message : String(e)) + ")");
  }

  console.log("Detecting dependency cycles...");
  const cycles = detectCycles(concepts);
  for (const cyc of cycles) {
    issues.push({
      severity: "error",
      category: "Dependency cycle",
      where: `prerequisites graph`,
      message: `cycle: ${cyc.join(" → ")}`,
    });
  }

  // Summary
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  console.log(`\n${pluralize(errors, "error")}, ${pluralize(warnings, "warning")}, ${pluralize(infos, "info")}`);

  // Group by category for the report
  const byCategory: Record<string, Issue[]> = {};
  for (const i of issues) {
    (byCategory[i.category] ??= []).push(i);
  }

  // Build HTML report
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Awakening Atlas — Validation Report</title>
<style>
  :root {
    --bg: #faf7f1; --surface: #ffffff; --elev: #f2ede0;
    --ink: #1c1a17; --ink-soft: #3a3530; --muted: #6b6660;
    --border: #e0d9c8; --accent: #8b3a3a; --gold: #b8893c;
    --green: #4a7c3f; --red: #b13838; --amber: #c08a2c;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14120e; --surface:#1c1916; --elev:#25211c;
      --ink:#ece6d6; --ink-soft:#b8b1a1; --muted:#8a8378;
      --border:#2e2922; --accent:#d28a7e; --gold:#d4a85a; }
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    background: var(--bg); color: var(--ink); margin: 0; line-height: 1.55; }
  .serif { font-family: "EB Garamond", Georgia, serif; }
  header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--border); }
  h1 { font-family: "EB Garamond", Georgia, serif; font-size: 1.7rem; margin: 0; }
  .totals { display: flex; gap: 1.5rem; margin-top: 0.6rem; }
  .totals .stat { font-size: 0.9rem; color: var(--muted); }
  .totals .stat strong { font-size: 1.4rem; color: var(--ink); display: block; }
  .totals .stat.error strong { color: var(--red); }
  .totals .stat.warning strong { color: var(--amber); }
  .totals .stat.ok strong { color: var(--green); }
  main { padding: 1.5rem 2rem 4rem; max-width: 1200px; margin: 0 auto; }
  .category { margin: 2rem 0; }
  .category h2 {
    font-family: "EB Garamond", Georgia, serif; font-size: 1.3rem;
    border-bottom: 1px solid var(--border); padding-bottom: 0.4rem;
    margin: 0 0 0.6rem; display: flex; align-items: baseline; gap: 0.6rem;
  }
  .category h2 .count {
    font-family: ui-monospace, monospace; font-size: 0.75rem;
    background: var(--elev); padding: 0.1rem 0.5rem; border-radius: 99px;
    color: var(--muted); font-weight: normal;
  }
  .issue {
    padding: 0.6rem 0.8rem; border-left: 3px solid var(--border);
    margin: 0.4rem 0; background: var(--surface); border-radius: 4px;
  }
  .issue.error { border-left-color: var(--red); }
  .issue.warning { border-left-color: var(--amber); }
  .issue .where { font-family: ui-monospace, monospace; font-size: 0.78rem; color: var(--muted); }
  .issue .msg { color: var(--ink); margin: 0.2rem 0; font-size: 0.92rem; }
  .issue .detail {
    font-family: "EB Garamond", Georgia, serif; font-style: italic;
    color: var(--ink-soft); font-size: 0.9rem; padding: 0.3rem 0.6rem;
    border-left: 2px solid var(--gold); background: var(--elev);
    margin-top: 0.3rem; border-radius: 2px;
  }
  .all-clear {
    padding: 3rem 2rem; text-align: center; background: var(--surface);
    border: 1px solid var(--green); border-radius: 8px; margin-top: 2rem;
  }
  .all-clear h2 { font-family: "EB Garamond", Georgia, serif; color: var(--green); margin: 0; }
  details summary {
    cursor: pointer; color: var(--muted); font-size: 0.85rem; margin: 0.3rem 0;
  }
  details summary:hover { color: var(--ink); }
  .timestamp { font-size: 0.78rem; color: var(--muted); margin-top: 0.3rem; }
</style></head>
<body>
<header>
  <h1>Validation Report</h1>
  <div class="totals">
    <div class="stat ${errors === 0 ? "ok" : "error"}"><strong>${errors}</strong>errors</div>
    <div class="stat ${warnings === 0 ? "ok" : "warning"}"><strong>${warnings}</strong>warnings</div>
    <div class="stat"><strong>${concepts.length}</strong>concepts checked</div>
    <div class="stat"><strong>${people.length}</strong>people checked</div>
    <div class="stat"><strong>${metadata.length}</strong>episodes checked</div>
  </div>
  <div class="timestamp">Generated ${new Date().toISOString()}</div>
</header>
<main>
${issues.length === 0
  ? `<div class="all-clear"><h2>★ All checks passed</h2><p>No errors or warnings.</p></div>`
  : Object.entries(byCategory)
      .sort((a, b) => {
        const sev = (cat: string) => byCategory[cat].some((i) => i.severity === "error") ? 0 : 1;
        return sev(a[0]) - sev(b[0]) || b[1].length - a[1].length;
      })
      .map(([cat, items]) => `
        <section class="category">
          <h2>${escapeHtml(cat)} <span class="count">${items.length}</span></h2>
          ${items.length > 20
            ? `<details><summary>Show all ${items.length}</summary>${items.map((i) => issueHtml(i)).join("")}</details>`
            : items.map((i) => issueHtml(i)).join("")}
        </section>
      `).join("")
}
</main>
</body></html>`;

  function issueHtml(i: Issue): string {
    return `
      <div class="issue ${i.severity}">
        <div class="where">${escapeHtml(i.where)}</div>
        <div class="msg">${escapeHtml(i.message)}</div>
        ${i.detail ? `<div class="detail">"${escapeHtml(i.detail)}…"</div>` : ""}
      </div>
    `;
  }

  await mkdir(path.join(ROOT, "data/registry"), { recursive: true });
  const out = path.join(ROOT, "data/registry/_validation-report.html");
  await writeFile(out, html);
  // Also copy to public for dev preview
  await mkdir(path.join(ROOT, "public"), { recursive: true });
  await writeFile(path.join(ROOT, "public/_atlas-validation.html"), html);

  // Also write machine-readable
  await writeFile(
    path.join(ROOT, "data/registry/_validation-report.json"),
    JSON.stringify({ summary: { errors, warnings, infos, concepts: concepts.length, people: people.length, metadata: metadata.length }, issues }, null, 2)
  );

  console.log(`\nReport written:`);
  console.log(`  ${out}`);
  console.log(`  public/_atlas-validation.html (dev-preview accessible at /_atlas-validation.html)`);
  if (errors > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
