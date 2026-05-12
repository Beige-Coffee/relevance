// Generate one self-contained HTML review page per mini-course, plus an index
// page listing all courses. Open these locally to audit course content before
// shipping — the human-review checkpoint described in the HTML-effectiveness
// article.
//
// Outputs:
//   data/courses/_reviews/<course-id>.html  — per-course review page
//   data/courses/_reviews/index.html         — listing of all courses
//   public/_atlas-courses/<course-id>.html   — copy served by dev server
//   public/_atlas-courses/index.html

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();

interface Module {
  id: string; title: string; subConceptId: string | null;
  learningObjective: string;
  expositionPassages: { episode: number; phrase: string; note?: string }[];
  socraticSeeds: { prompt: string; expectedThemes: string[] }[];
  misconceptionBranches: { misconception: string; correction: string }[];
  checkForUnderstanding: { prompt: string; expectedThemes: string[] };
}
interface Course {
  id: string; title: string; conceptId: string;
  abstract: string; prerequisites: string[]; modules: Module[];
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const CSS = `<style>
  :root {
    --bg: #faf7f1; --surface: #ffffff; --elev: #f2ede0;
    --ink: #1c1a17; --ink-soft: #3a3530; --muted: #6b6660;
    --border: #e0d9c8; --accent: #8b3a3a; --gold: #b8893c;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14120e; --surface:#1c1916; --elev:#25211c;
      --ink:#ece6d6; --ink-soft:#b8b1a1; --muted:#8a8378;
      --border:#2e2922; --accent:#d28a7e; --gold:#d4a85a; }
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    background: var(--bg); color: var(--ink); margin: 0; line-height: 1.6;
    -webkit-font-smoothing: antialiased; }
  .serif { font-family: "EB Garamond", Georgia, serif; }
  header { padding: 2rem 2.5rem 1rem; border-bottom: 1px solid var(--border); }
  .back-link { color: var(--muted); font-size: 0.8rem; text-decoration: none; }
  .back-link:hover { color: var(--accent); }
  .meta { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); margin: 0.6rem 0 0.3rem; }
  h1 { font-family: "EB Garamond", Georgia, serif; font-size: 2.6rem; margin: 0; letter-spacing: -0.01em; font-weight: 500; }
  .abstract {
    font-family: "EB Garamond", Georgia, serif; font-size: 1.1rem; line-height: 1.65;
    color: var(--ink-soft); margin: 1rem 0; max-width: 60rem;
  }
  .prereqs { font-size: 0.85rem; color: var(--muted); margin-top: 0.6rem; }
  .prereqs a { color: var(--accent); text-decoration: none; }
  .prereqs a:hover { text-decoration: underline; }
  main { max-width: 60rem; margin: 0 auto; padding: 2rem 2.5rem 5rem; }
  .module {
    border-top: 1px solid var(--border); padding-top: 2rem; margin-top: 3rem;
  }
  .module:first-child { border-top: none; padding-top: 0; margin-top: 0; }
  .module .num {
    font-family: ui-monospace, monospace; font-size: 0.78rem;
    background: var(--gold); color: var(--bg); padding: 0.2rem 0.6rem;
    border-radius: 99px; display: inline-block; margin-bottom: 0.6rem;
  }
  .module h2 {
    font-family: "EB Garamond", Georgia, serif; font-size: 1.9rem; margin: 0;
    letter-spacing: -0.01em; font-weight: 500; line-height: 1.15;
  }
  .module .objective {
    font-family: "EB Garamond", Georgia, serif; font-size: 1.05rem; font-style: italic;
    color: var(--ink-soft); margin: 0.5rem 0 1rem;
  }
  section { margin: 1.6rem 0; }
  section h3 {
    font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--muted); margin: 0 0 0.6rem;
  }
  .passage {
    background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--gold);
    padding: 0.8rem 1rem; margin: 0.5rem 0; border-radius: 4px;
  }
  .passage .src {
    font-family: ui-monospace, monospace; font-size: 0.72rem;
    color: var(--accent); margin-bottom: 0.3rem;
  }
  .passage .quote {
    font-family: "EB Garamond", Georgia, serif; font-style: italic;
    color: var(--ink); font-size: 1rem; line-height: 1.55;
  }
  .passage .note { font-size: 0.78rem; color: var(--muted); margin-top: 0.4rem; }
  .seed {
    padding: 0.5rem 0; border-left: 2px solid var(--gold); padding-left: 1rem; margin: 0.5rem 0;
  }
  .seed .prompt {
    font-family: "EB Garamond", Georgia, serif; font-size: 1.05rem; font-style: italic; color: var(--ink);
  }
  .seed .themes {
    font-size: 0.78rem; color: var(--muted); margin-top: 0.3rem;
    display: flex; gap: 0.4rem; flex-wrap: wrap;
  }
  .theme-pill {
    background: var(--elev); padding: 0.15rem 0.55rem; border-radius: 99px;
  }
  .misc {
    background: var(--elev); padding: 0.7rem 1rem; margin: 0.5rem 0; border-radius: 6px;
    font-size: 0.9rem;
  }
  .misc .label { font-weight: 500; }
  .misc .label.if { color: var(--ink); }
  .misc .label.then { color: var(--accent); }
  .check {
    background: var(--elev); border: 2px solid var(--gold); padding: 1rem 1.2rem;
    border-radius: 8px; margin-top: 0.6rem;
  }
  .check .prompt {
    font-family: "EB Garamond", Georgia, serif; font-style: italic; font-size: 1.1rem; color: var(--ink);
  }
  .check .themes {
    font-size: 0.78rem; color: var(--muted); margin-top: 0.5rem;
    display: flex; gap: 0.4rem; flex-wrap: wrap;
  }
  .toc {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 1rem 1.4rem; margin: 1.5rem 0;
  }
  .toc h3 { margin: 0 0 0.4rem; }
  .toc ol { margin: 0; padding-left: 1.4rem; }
  .toc li { margin: 0.2rem 0; font-size: 0.92rem; }
  .toc li a { color: var(--ink); text-decoration: none; }
  .toc li a:hover { color: var(--accent); }
  .approve-bar {
    position: sticky; bottom: 0;
    background: var(--bg); border-top: 1px solid var(--border);
    padding: 0.8rem 2.5rem;
    display: flex; gap: 0.6rem; justify-content: flex-end;
  }
  .btn {
    padding: 0.55rem 1.2rem; border-radius: 6px; font-size: 0.9rem;
    border: 1px solid var(--border); background: var(--surface); color: var(--ink-soft);
    cursor: pointer; font-family: inherit;
  }
  .btn.primary { background: var(--accent); color: var(--bg); border-color: var(--accent); }
  .btn:hover { transform: translateY(-1px); }
</style>`;

function moduleHtml(m: Module, i: number, epTitles: Record<number, string>): string {
  return `
    <article class="module" id="m-${esc(m.id)}">
      <span class="num">Module ${i + 1}</span>
      <h2>${esc(m.title)}</h2>
      <p class="objective">${esc(m.learningObjective)}</p>
      <section>
        <h3>Exposition</h3>
        ${m.expositionPassages.map((p) => `
          <div class="passage">
            <div class="src">Episode ${p.episode} · ${esc(epTitles[p.episode] ?? "")}</div>
            <div class="quote">&ldquo;${esc(p.phrase)}&rdquo;</div>
            ${p.note ? `<div class="note">${esc(p.note)}</div>` : ""}
          </div>
        `).join("")}
      </section>
      <section>
        <h3>Socratic seeds</h3>
        ${m.socraticSeeds.map((s) => `
          <div class="seed">
            <div class="prompt">${esc(s.prompt)}</div>
            <div class="themes">${s.expectedThemes.map((t) => `<span class="theme-pill">${esc(t)}</span>`).join("")}</div>
          </div>
        `).join("")}
      </section>
      ${m.misconceptionBranches.length ? `
        <section>
          <h3>Misconception branches</h3>
          ${m.misconceptionBranches.map((b) => `
            <div class="misc">
              <div><span class="label if">If:</span> ${esc(b.misconception)}</div>
              <div><span class="label then">Then:</span> ${esc(b.correction)}</div>
            </div>
          `).join("")}
        </section>
      ` : ""}
      <section>
        <h3>Check for understanding</h3>
        <div class="check">
          <div class="prompt">${esc(m.checkForUnderstanding.prompt)}</div>
          <div class="themes">${(m.checkForUnderstanding.expectedThemes ?? []).map((t) => `<span class="theme-pill">${esc(t)}</span>`).join("")}</div>
        </div>
      </section>
    </article>
  `;
}

async function loadEpisodeTitles(): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  const dir = path.join(ROOT, "data/transcripts");
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".md")).sort()) {
    const fm = matter(await readFile(path.join(dir, f), "utf8"));
    map[Number(fm.data.num)] = String(fm.data.title);
  }
  return map;
}

async function loadCourses(): Promise<Course[]> {
  const dir = path.join(ROOT, "data/courses");
  const courses: Course[] = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".json") && !f.startsWith("_"))) {
    courses.push(JSON.parse(await readFile(path.join(dir, f), "utf8")));
  }
  courses.sort((a, b) => a.title.localeCompare(b.title));
  return courses;
}

function coursePage(c: Course, epTitles: Record<number, string>, allCourses: Course[]): string {
  const prereqMap = new Map(allCourses.map((x) => [x.conceptId, x]));
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)} — Mini-course Review</title>
${CSS}
</head><body>
<header>
  <a class="back-link" href="index.html">← All course reviews</a>
  <div class="meta">Mini-course · ${c.modules.length} modules</div>
  <h1>${esc(c.title)}</h1>
  <p class="abstract">${esc(c.abstract)}</p>
  ${c.prerequisites.length ? `
    <div class="prereqs">
      Prerequisites:
      ${c.prerequisites.map((p) => {
        const target = prereqMap.get(p);
        return target ? `<a href="${target.id}.html">${esc(target.title)}</a>` : `<span>${esc(p)}</span>`;
      }).join(", ")}
    </div>` : ""}
</header>
<main>
  <div class="toc">
    <h3>Modules</h3>
    <ol>
      ${c.modules.map((m) => `<li><a href="#m-${esc(m.id)}">${esc(m.title)}</a></li>`).join("")}
    </ol>
  </div>
  ${c.modules.map((m, i) => moduleHtml(m, i, epTitles)).join("")}
</main>
<div class="approve-bar">
  <button class="btn">Request changes</button>
  <button class="btn primary">Approve for shipping</button>
</div>
</body></html>`;
}

function indexPage(courses: Course[]): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Course reviews — Awakening Atlas</title>
${CSS}
</head><body>
<header>
  <div class="meta">Pass 5 output — human review</div>
  <h1>Course Reviews</h1>
  <p class="abstract">${courses.length} pre-curated Socratic mini-courses on the flagship concepts of Vervaeke&rsquo;s argument. Click each course to audit modules, exposition passages, Socratic seeds, and misconception branches.</p>
</header>
<main>
  <table style="width:100%;border-collapse:collapse;font-size:0.95rem">
    <thead>
      <tr style="border-bottom:1px solid var(--border);text-align:left">
        <th style="padding:0.6rem 0.4rem">Course</th>
        <th style="padding:0.6rem 0.4rem">Modules</th>
        <th style="padding:0.6rem 0.4rem">Abstract</th>
      </tr>
    </thead>
    <tbody>
      ${courses.map((c) => `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:0.75rem 0.4rem;vertical-align:top">
            <a href="${esc(c.id)}.html" style="font-family:'EB Garamond',Georgia,serif;font-size:1.2rem;color:var(--ink);text-decoration:none">${esc(c.title)}</a>
          </td>
          <td style="padding:0.75rem 0.4rem;vertical-align:top;color:var(--muted)">${c.modules.length}</td>
          <td style="padding:0.75rem 0.4rem;vertical-align:top;color:var(--ink-soft);max-width:36rem">${esc(c.abstract.slice(0, 240))}…</td>
        </tr>
      `).join("")}
    </tbody>
  </table>
</main>
</body></html>`;
}

async function main() {
  const epTitles = await loadEpisodeTitles();
  const courses = await loadCourses();
  console.log(`Loaded ${courses.length} courses, ${Object.keys(epTitles).length} episode titles`);

  const outDirs = [
    path.join(ROOT, "data/courses/_reviews"),
    path.join(ROOT, "public/_atlas-courses"),
  ];
  for (const d of outDirs) await mkdir(d, { recursive: true });

  for (const c of courses) {
    const html = coursePage(c, epTitles, courses);
    for (const d of outDirs) await writeFile(path.join(d, `${c.id}.html`), html);
  }
  const idx = indexPage(courses);
  for (const d of outDirs) await writeFile(path.join(d, "index.html"), idx);

  console.log(`Wrote ${courses.length + 1} HTML files to:`);
  for (const d of outDirs) console.log(`  ${d}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
