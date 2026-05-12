// Build a self-contained HTML browser for the concept + people registry.
// Output: data/registry/_browser.html
// Open this file directly in a browser — no server needed.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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
  contrastedWith: string[];
  associatedPeople: string[];
  isFlagship: boolean;
  notes?: string | null;
  subConcepts?: unknown[];
  commonConfusions?: string[];
  keyPassages?: unknown[];
}
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

async function loadEpisodeTitles(): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(path.join(ROOT, "data", "metadata")))
    .filter((f) => f.match(/^ep-\d{2}\.json$/))
    .sort();
  for (const f of files) {
    const d = JSON.parse(await readFile(path.join(ROOT, "data", "metadata", f), "utf8"));
    map[d.num] = d.title;
  }
  return map;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const concepts: Concept[] = JSON.parse(await readFile(path.join(ROOT, "data/registry/concepts.json"), "utf8"));
  const people: Person[] = JSON.parse(await readFile(path.join(ROOT, "data/registry/people.json"), "utf8"));
  const epTitles = await loadEpisodeTitles();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Awakening Atlas — Registry Browser</title>
<style>
  :root {
    --bg: #faf7f1;
    --surface: #ffffff;
    --elev: #f2ede0;
    --ink: #1c1a17;
    --ink-soft: #3a3530;
    --muted: #6b6660;
    --border: #e0d9c8;
    --accent: #8b3a3a;
    --gold: #b8893c;
    --blue: #3c4a8b;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #14120e;
      --surface: #1c1916;
      --elev: #25211c;
      --ink: #ece6d6;
      --ink-soft: #b8b1a1;
      --muted: #8a8378;
      --border: #2e2922;
      --accent: #d28a7e;
      --gold: #d4a85a;
      --blue: #8aa1e3;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    background: var(--bg); color: var(--ink); line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .serif { font-family: "EB Garamond", Georgia, serif; }
  header {
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem; background: var(--bg);
    position: sticky; top: 0; z-index: 10;
    backdrop-filter: blur(8px);
  }
  header h1 {
    font-family: "EB Garamond", Georgia, serif;
    font-size: 1.5rem; font-weight: 600; margin: 0;
    letter-spacing: -0.01em;
  }
  header h1 .gold { color: var(--gold); }
  header .totals {
    color: var(--muted); font-size: 0.85rem; margin-top: 0.2rem;
  }
  .tabs {
    display: flex; gap: 0; border-bottom: 1px solid var(--border);
    padding: 0 1.5rem; background: var(--bg);
    position: sticky; top: 68px; z-index: 9;
  }
  .tab {
    background: transparent; border: none; cursor: pointer;
    padding: 0.85rem 1.1rem; color: var(--muted);
    font-family: inherit; font-size: 0.9rem;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
  }
  .tab:hover { color: var(--ink); }
  .tab.active { color: var(--ink); border-bottom-color: var(--accent); }
  .controls {
    display: flex; flex-wrap: wrap; gap: 0.5rem;
    padding: 0.75rem 1.5rem; align-items: center;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    position: sticky; top: 117px; z-index: 8;
  }
  .controls input[type="text"] {
    flex: 1; min-width: 200px; padding: 0.45rem 0.7rem;
    border: 1px solid var(--border); border-radius: 6px;
    background: var(--surface); color: var(--ink);
    font-family: inherit; font-size: 0.9rem;
  }
  .controls input[type="text"]:focus { outline: none; border-color: var(--accent); }
  .pill {
    display: inline-block; padding: 0.2rem 0.55rem;
    border: 1px solid var(--border); border-radius: 999px;
    background: var(--surface); color: var(--ink-soft);
    font-size: 0.75rem; cursor: pointer;
    transition: all 0.15s;
  }
  .pill:hover { border-color: var(--accent); color: var(--ink); }
  .pill.active { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .pill.flagship { color: var(--gold); border-color: var(--gold); }
  .pill.flagship.active { background: var(--gold); color: var(--bg); }
  main {
    padding: 1rem 1.5rem 4rem; max-width: 1400px; margin: 0 auto;
  }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1rem;
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 10px; padding: 1rem; cursor: pointer;
    transition: border-color 0.15s, transform 0.1s;
  }
  .card:hover { border-color: var(--accent); }
  .card.flagship::before {
    content: "★"; color: var(--gold); margin-right: 0.4rem;
  }
  .card-title {
    font-family: "EB Garamond", Georgia, serif;
    font-size: 1.15rem; font-weight: 500; margin: 0 0 0.25rem;
    color: var(--ink); line-height: 1.2;
  }
  .card-meta {
    font-size: 0.75rem; color: var(--muted); margin-bottom: 0.4rem;
    display: flex; gap: 0.6rem; flex-wrap: wrap;
  }
  .card-meta .cluster-tag {
    color: var(--accent); font-variant: small-caps;
  }
  .card-def {
    font-family: "EB Garamond", Georgia, serif;
    font-size: 0.95rem; line-height: 1.5; color: var(--ink-soft);
    overflow: hidden; display: -webkit-box;
    -webkit-line-clamp: 3; -webkit-box-orient: vertical;
  }
  /* Detail modal */
  .overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: none; align-items: flex-start; justify-content: center;
    padding: 2rem; overflow-y: auto; z-index: 100;
  }
  .overlay.open { display: flex; }
  .modal {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.5rem 2rem;
    max-width: 760px; width: 100%;
  }
  .modal h2 {
    font-family: "EB Garamond", Georgia, serif;
    font-size: 1.9rem; margin: 0 0 0.3rem; color: var(--ink);
    letter-spacing: -0.01em;
  }
  .modal .id {
    font-family: ui-monospace, "Menlo", monospace; font-size: 0.7rem;
    color: var(--muted); margin-bottom: 1rem;
  }
  .modal section { margin: 1rem 0; }
  .modal h3 {
    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--muted); margin: 0 0 0.4rem;
  }
  .modal p { margin: 0.3rem 0; }
  .modal .def {
    font-family: "EB Garamond", Georgia, serif; font-size: 1.05rem;
    line-height: 1.6; color: var(--ink);
  }
  .modal .quote {
    border-left: 3px solid var(--gold); padding: 0.5rem 0.8rem;
    margin: 0.5rem 0; background: var(--elev);
    font-family: "EB Garamond", Georgia, serif; font-style: italic;
    color: var(--ink-soft); font-size: 0.95rem;
  }
  .modal .quote .ep {
    display: block; font-family: ui-monospace, monospace; font-style: normal;
    font-size: 0.7rem; color: var(--accent); margin-bottom: 0.3rem;
  }
  .ref-pill {
    display: inline-block; padding: 0.15rem 0.5rem; margin: 0.1rem 0.2rem 0.1rem 0;
    border: 1px solid var(--border); border-radius: 999px;
    background: var(--surface); color: var(--ink-soft);
    font-size: 0.78rem; cursor: pointer;
    text-decoration: none;
  }
  .ref-pill:hover { border-color: var(--accent); color: var(--ink); }
  .ref-pill.ep { color: var(--accent); }
  .ref-pill.person { color: var(--blue); }
  .ref-pill.concept { color: var(--gold); }
  .close {
    position: absolute; top: 0.75rem; right: 1rem;
    background: transparent; border: none; cursor: pointer;
    color: var(--muted); font-size: 1.5rem; line-height: 1;
  }
  .close:hover { color: var(--accent); }
  .stats {
    display: flex; gap: 2rem; flex-wrap: wrap;
    color: var(--muted); font-size: 0.85rem; padding: 0.75rem 0;
  }
  .stats strong { color: var(--ink); }
  .keyPassage {
    border-left: 2px solid var(--border); padding: 0.4rem 0.8rem;
    margin: 0.4rem 0;
  }
  .keyPassage .role {
    font-family: ui-monospace, monospace; font-size: 0.7rem;
    text-transform: uppercase; color: var(--muted); margin-bottom: 0.2rem;
  }
  .subConcept {
    padding: 0.6rem 0.8rem; margin: 0.4rem 0;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--elev);
  }
  .subConcept .sc-name {
    font-family: "EB Garamond", Georgia, serif; font-weight: 500;
    font-size: 1rem; color: var(--ink);
  }
  .subConcept .sc-summary { font-size: 0.9rem; color: var(--ink-soft); margin: 0.2rem 0 0.3rem; }
  details { margin: 0.5rem 0; }
  summary { cursor: pointer; color: var(--muted); font-size: 0.85rem; }
  summary:hover { color: var(--ink); }
  .empty {
    text-align: center; padding: 4rem 1rem;
    color: var(--muted);
  }
</style>
</head>
<body>
<header>
  <h1>Awakening <span class="gold">Atlas</span> — Registry Browser</h1>
  <div class="totals">
    ${concepts.length} concepts · ${concepts.filter((c) => c.isFlagship).length} flagship · ${people.length} thinkers · 51 episodes
  </div>
</header>

<div class="tabs">
  <button class="tab active" data-tab="concepts">Concepts</button>
  <button class="tab" data-tab="people">People</button>
  <button class="tab" data-tab="episodes">Episodes</button>
</div>

<div class="controls" id="controls">
  <input type="text" id="search" placeholder="Search by name, definition, or id…" />
  <span id="filter-bar"></span>
</div>

<main>
  <div class="stats" id="stats"></div>
  <div class="grid" id="grid"></div>
  <div class="empty" id="empty" style="display:none">No matches.</div>
</main>

<div class="overlay" id="overlay" onclick="if(event.target===this)closeModal()">
  <div class="modal" style="position:relative" id="modal">
    <button class="close" onclick="closeModal()">×</button>
    <div id="modalBody"></div>
  </div>
</div>

<script id="data" type="application/json">${JSON.stringify({
    concepts,
    people,
    epTitles,
  }).replace(/</g, "\\u003c")}</script>

<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const { concepts, people, epTitles } = DATA;
const conceptById = Object.fromEntries(concepts.map(c => [c.id, c]));
const personById = Object.fromEntries(people.map(p => [p.id, p]));

let state = { tab: 'concepts', filter: 'all', flagship: false, search: '' };

function render() {
  // tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  // filter bar
  const filterBar = document.getElementById('filter-bar');
  if (state.tab === 'concepts') {
    const clusters = ['all','cognitive-science','historical','normative','practical','methodological'];
    filterBar.innerHTML = clusters.map(c =>
      \`<button class="pill \${state.filter === c ? 'active' : ''}" onclick="setFilter('\${c}')">\${c}</button>\`
    ).join('') + \` <button class="pill flagship \${state.flagship ? 'active' : ''}" onclick="toggleFlagship()">★ flagship only</button>\`;
  } else if (state.tab === 'people') {
    filterBar.innerHTML = '';
  } else {
    filterBar.innerHTML = '';
  }

  let items = [];
  if (state.tab === 'concepts') {
    items = concepts.filter(c => {
      if (state.filter !== 'all' && c.cluster !== state.filter) return false;
      if (state.flagship && !c.isFlagship) return false;
      if (state.search) {
        const s = state.search.toLowerCase();
        if (!c.canonicalName.toLowerCase().includes(s)
          && !c.definition.toLowerCase().includes(s)
          && !c.id.toLowerCase().includes(s)
          && !(c.aliases || []).some(a => a.toLowerCase().includes(s))) return false;
      }
      return true;
    });
  } else if (state.tab === 'people') {
    items = people.filter(p => {
      if (state.search) {
        const s = state.search.toLowerCase();
        if (!p.canonicalName.toLowerCase().includes(s)
          && !p.shortBio.toLowerCase().includes(s)
          && !p.id.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  } else if (state.tab === 'episodes') {
    items = Object.entries(epTitles).map(([num, title]) => ({ num: +num, title })).sort((a,b) => a.num - b.num);
    if (state.search) {
      const s = state.search.toLowerCase();
      items = items.filter(e => e.title.toLowerCase().includes(s));
    }
  }

  document.getElementById('stats').innerHTML = \`Showing <strong>\${items.length}</strong> \${state.tab}\`;

  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  empty.style.display = items.length === 0 ? '' : 'none';

  if (state.tab === 'concepts') {
    grid.innerHTML = items.map(c => \`
      <div class="card \${c.isFlagship ? 'flagship' : ''}" onclick="showConcept('\${c.id}')">
        <h3 class="card-title">\${escape(c.canonicalName)}</h3>
        <div class="card-meta">
          <span class="cluster-tag">\${c.cluster}</span>
          <span>depth \${c.depth}</span>
          <span>intro ep \${c.introducedIn}</span>
        </div>
        <div class="card-def">\${escape(c.definition)}</div>
      </div>
    \`).join('');
  } else if (state.tab === 'people') {
    grid.innerHTML = items.map(p => \`
      <div class="card" onclick="showPerson('\${p.id}')">
        <h3 class="card-title">\${escape(p.canonicalName)}</h3>
        <div class="card-meta">
          <span>\${p.discussedIn.length} episode\${p.discussedIn.length === 1 ? '' : 's'}</span>
          <span>intro ep \${p.introducedIn}</span>
        </div>
        <div class="card-def">\${escape(p.shortBio)}</div>
      </div>
    \`).join('');
  } else if (state.tab === 'episodes') {
    grid.innerHTML = items.map(e => {
      const ec = concepts.filter(c => c.developedIn.includes(e.num) || c.introducedIn === e.num);
      const ep = people.filter(p => p.discussedIn.includes(e.num));
      return \`
      <div class="card" onclick="showEpisode(\${e.num})">
        <h3 class="card-title">\${e.num}. \${escape(e.title)}</h3>
        <div class="card-meta">
          <span>\${ec.length} concept\${ec.length === 1 ? '' : 's'}</span>
          <span>\${ep.length} thinker\${ep.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    \`;
    }).join('');
  }
}

function escape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showConcept(id) {
  const c = conceptById[id]; if (!c) return;
  const treatments = treatmentSummary(c);
  const body = \`
    <h2>\${c.isFlagship ? '★ ' : ''}\${escape(c.canonicalName)}</h2>
    <div class="id">\${c.id} · \${c.cluster} · depth \${c.depth}</div>
    <section>
      <p class="def">\${escape(c.definition)}</p>
    </section>
    <section>
      <h3>Source passage (Ep \${c.sourcePassage.episode})</h3>
      <div class="quote">
        <span class="ep">Episode \${c.sourcePassage.episode}\${epTitles[c.sourcePassage.episode] ? ' · ' + escape(epTitles[c.sourcePassage.episode]) : ''}</span>
        "\${escape(c.sourcePassage.quote)}"
      </div>
    </section>
    \${c.notes ? \`<section><h3>Notes</h3><p>\${escape(c.notes)}</p></section>\` : ''}
    <section>
      <h3>Where it appears</h3>
      <p><strong>Introduced:</strong> \${epRefPill(c.introducedIn)}</p>
      \${c.developedIn.length ? \`<p><strong>Developed:</strong> \${c.developedIn.map(epRefPill).join('')}</p>\` : ''}
      \${c.appliedIn.length ? \`<p><strong>Applied:</strong> \${c.appliedIn.map(epRefPill).join('')}</p>\` : ''}
    </section>
    \${c.prerequisites.length ? \`<section><h3>Prerequisites</h3><p>\${c.prerequisites.map(conceptRefPill).join('')}</p></section>\` : ''}
    \${c.relatedConcepts.length ? \`<section><h3>Related concepts</h3><p>\${c.relatedConcepts.map(conceptRefPill).join('')}</p></section>\` : ''}
    \${c.contrastedWith && c.contrastedWith.length ? \`<section><h3>Contrasted with</h3><p>\${c.contrastedWith.map(conceptRefPill).join('')}</p></section>\` : ''}
    \${c.associatedPeople.length ? \`<section><h3>Associated thinkers</h3><p>\${c.associatedPeople.map(personRefPill).join('')}</p></section>\` : ''}
    \${c.subConcepts && c.subConcepts.length ? \`
      <section>
        <h3>Sub-concepts (Pass 3 enrichment)</h3>
        \${c.subConcepts.map(sc => \`
          <div class="subConcept">
            <div class="sc-name">\${escape(sc.name)}</div>
            <div class="sc-summary">\${escape(sc.summary)}</div>
            \${(sc.passages || []).map(pp => \`<div class="quote"><span class="ep">Ep \${pp.episode}</span>"\${escape(pp.phrase)}"</div>\`).join('')}
          </div>
        \`).join('')}
      </section>
    \` : ''}
    \${c.commonConfusions && c.commonConfusions.length ? \`
      <section>
        <h3>Common confusions</h3>
        <ul>\${c.commonConfusions.map(x => \`<li>\${escape(x)}</li>\`).join('')}</ul>
      </section>
    \` : ''}
    \${c.keyPassages && c.keyPassages.length ? \`
      <section>
        <h3>Key passages</h3>
        \${c.keyPassages.map(kp => \`
          <div class="keyPassage">
            <div class="role">\${escape(kp.role || '')} · Ep \${kp.episode}</div>
            <div>"\${escape(kp.phrase)}"</div>
          </div>
        \`).join('')}
      </section>
    \` : ''}
  \`;
  openModal(body);
}

function showPerson(id) {
  const p = personById[id]; if (!p) return;
  const body = \`
    <h2>\${escape(p.canonicalName)}</h2>
    <div class="id">\${p.id}</div>
    <section>
      <p class="def">\${escape(p.shortBio)}</p>
    </section>
    <section>
      <h3>Role in Vervaeke's argument</h3>
      <p>\${escape(p.roleInArgument)}</p>
    </section>
    <section>
      <h3>Where they appear</h3>
      <p><strong>Introduced:</strong> \${epRefPill(p.introducedIn)}</p>
      <p><strong>Discussed:</strong> \${p.discussedIn.map(epRefPill).join('')}</p>
    </section>
    \${p.keyClaimsAbout.length ? \`
      <section>
        <h3>Key claims Vervaeke makes about them</h3>
        <ul>\${p.keyClaimsAbout.map(x => \`<li>\${escape(x)}</li>\`).join('')}</ul>
      </section>
    \` : ''}
    \${p.associatedConcepts.length ? \`<section><h3>Associated concepts</h3><p>\${p.associatedConcepts.map(conceptRefPill).join('')}</p></section>\` : ''}
    \${p.notes ? \`<section><h3>Notes</h3><p>\${escape(p.notes)}</p></section>\` : ''}
  \`;
  openModal(body);
}

function showEpisode(num) {
  const title = epTitles[num] || \`Episode \${num}\`;
  const inEp = concepts.filter(c => c.developedIn.includes(num) || c.introducedIn === num || c.appliedIn.includes(num));
  const peopleEp = people.filter(p => p.discussedIn.includes(num));
  const introd = inEp.filter(c => c.introducedIn === num);
  const developed = inEp.filter(c => c.developedIn.includes(num) && c.introducedIn !== num);
  const applied = inEp.filter(c => c.appliedIn.includes(num) && !developed.includes(c) && !introd.includes(c));
  const body = \`
    <h2>Episode \${num}: \${escape(title)}</h2>
    \${introd.length ? \`<section><h3>Concepts introduced</h3><p>\${introd.map(c => conceptRefPill(c.id)).join('')}</p></section>\` : ''}
    \${developed.length ? \`<section><h3>Concepts developed</h3><p>\${developed.map(c => conceptRefPill(c.id)).join('')}</p></section>\` : ''}
    \${applied.length ? \`<section><h3>Concepts applied</h3><p>\${applied.map(c => conceptRefPill(c.id)).join('')}</p></section>\` : ''}
    \${peopleEp.length ? \`<section><h3>Thinkers discussed</h3><p>\${peopleEp.map(p => personRefPill(p.id)).join('')}</p></section>\` : ''}
  \`;
  openModal(body);
}

function epRefPill(num) {
  const title = epTitles[num] || '';
  return \`<a class="ref-pill ep" onclick="showEpisode(\${num})" title="\${escape(title)}">Ep \${num}</a>\`;
}
function conceptRefPill(id) {
  const c = conceptById[id];
  if (!c) return \`<span class="ref-pill" style="color:var(--muted)" title="not in registry">\${id}</span>\`;
  return \`<a class="ref-pill concept" onclick="showConcept('\${id}')">\${escape(c.canonicalName)}</a>\`;
}
function personRefPill(id) {
  const p = personById[id];
  if (!p) return \`<span class="ref-pill" style="color:var(--muted)" title="not in registry">\${id}</span>\`;
  return \`<a class="ref-pill person" onclick="showPerson('\${id}')">\${escape(p.canonicalName)}</a>\`;
}

function treatmentSummary(c) {
  const total = c.developedIn.length + c.appliedIn.length + (c.introducedIn ? 1 : 0);
  return total;
}

function openModal(body) {
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('overlay').classList.add('open');
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.getElementById('modal').scrollTop = 0;
}
function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}

function setTab(t) { state.tab = t; state.search = ''; document.getElementById('search').value = ''; render(); }
function setFilter(f) { state.filter = f; render(); }
function toggleFlagship() { state.flagship = !state.flagship; render(); }

document.querySelectorAll('.tab').forEach(t => t.onclick = () => setTab(t.dataset.tab));
document.getElementById('search').addEventListener('input', e => { state.search = e.target.value; render(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

render();
</script>
</body>
</html>`;

  const out = path.join(ROOT, "data/registry/_browser.html");
  await writeFile(out, html);
  console.log(`Wrote ${out}`);
  console.log(`  ${concepts.length} concepts (${concepts.filter((c) => c.isFlagship).length} flagship)`);
  console.log(`  ${people.length} people`);
  console.log(`  ${Object.keys(epTitles).length} episodes`);
}

main().catch((e) => { console.error(e); process.exit(1); });
