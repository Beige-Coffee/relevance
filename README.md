# Awakening Atlas

A study companion for John Vervaeke's lecture series **Awakening from the Meaning Crisis** (50 episodes, ~395k words).

This is an unaffiliated educational tool. Lectures and ideas are the work of John Vervaeke; transcripts are sourced from [meaningcrisis.co](https://www.meaningcrisis.co/all-transcripts/). The dialogue agent in this app is an AI assistant — it is **not** John Vervaeke, does not speak as him, and does not represent his views.

## What it does

Four surfaces, all backed by the same indexed corpus:

- **Dialogue** — a Socratic interlocutor that asks you questions back, retrieves relevant passages from the lectures on each turn, and cites them by episode. Strictly not an impersonation.
- **Ask** — search the corpus, get ranked passages, plus a synthesized answer with episode citations.
- **Graph** — interactive force-graph of episodes, concepts, and thinkers, with cross-episode references as edges. Click a node to see its connections.
- **Episodes** — browse the 50 lectures with an essence summary and link to the original transcript.

The graph and search work fully offline in the browser. Dialogue and Ask require an Anthropic API key (you bring your own — it lives in your browser's localStorage only and is never sent to this site's server).

## Architecture

- **Next.js 16** App Router, TypeScript, Tailwind 4, React 19.
- **All inference is client-side, BYOK.** The Anthropic SDK runs in the browser with `dangerouslyAllowBrowser: true`. There are no server-side LLM calls and no API routes that touch keys.
- **Retrieval is in-browser BM25** via [MiniSearch](https://lucaong.github.io/minisearch/), over ~780 paragraph-sized passages chunked from the transcripts.
- **Graph rendering** uses [`react-force-graph-2d`](https://github.com/vasturiano/react-force-graph). All graph data is static JSON.
- **Static data** lives in `public/data/` (fetched at runtime in the browser) and `src/data/` (importable in server code).

### Pipeline

```
meaningcrisis.co
       │
       │  npm run scrape       (Node + Cheerio + Turndown)
       ▼
data/transcripts/*.md          (51 hand-edited transcripts, with frontmatter)
       │
       │  per-episode metadata extraction
       │  (Haiku agents during build, structured JSON schema)
       ▼
data/metadata/*.json
       │
       │  npm run build:data
       ▼
public/data/
├── episodes.json        — episode index + essence summaries
├── concepts.json        — concept frequencies + episode appearances
├── people.json          — thinker frequencies + episode appearances
├── graph.json           — nodes + links for force-graph
├── passages.json        — 780 paragraph chunks for BM25 search
├── quotes.json          — verbatim quotable moments
└── graph.cypher         — Neo4j Cypher dump (bonus, for offline graph DB use)
```

The data layer is fully reproducible: re-run `npm run scrape && npm run build:data` to refresh.

## Setup

```bash
npm install
npm run dev
# open http://localhost:3000
```

To use Dialogue or Ask, get an Anthropic API key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys), then paste it in **Settings** in the app.

## Deploying to Vercel

```bash
npx vercel --prod
```

Or via the [Vercel dashboard](https://vercel.com/new) — point at this repo, accept defaults. No environment variables required (the LLM is BYOK on the client). All data is served as static files.

## Re-scraping / re-indexing

```bash
npm run scrape         # refetch transcripts (skips files that already exist)
RESCRAPE=1 npm run scrape  # force re-fetch all
npm run build:data     # rebuild indices, graph, passages
```

Metadata files in `data/metadata/*.json` are produced manually (or via Haiku agents during the initial build). If you regenerate transcripts and want fresh metadata, see `scripts/manifest.ts` for the canonical episode list and produce one JSON per episode matching the schema in `scripts/build.ts`.

## Optional: Neo4j

The build outputs a `public/data/graph.cypher` file. To explore the graph in Neo4j:

```bash
cat public/data/graph.cypher | cypher-shell -u neo4j -p <password>
```

Then run queries like:

```cypher
// All concepts that bridge episodes about wisdom and episodes about Plato
MATCH (e1:Episode)-[:DEVELOPED|APPLIED]->(c:Concept)<-[:DEVELOPED|APPLIED]-(e2:Episode)
WHERE e1.title CONTAINS 'Wisdom' AND e2.title CONTAINS 'Plato'
RETURN c.name, count(*) AS bridges
ORDER BY bridges DESC;
```

## Project layout

```
data/transcripts/        — 51 hand-edited transcripts (.md with frontmatter)
data/metadata/           — 51 metadata JSON files (one per episode)
scripts/                 — scrape.ts, build.ts, manifest.ts, aliases.ts
src/app/                 — Next.js App Router pages
  /                      — landing
  /dialogue              — Socratic chat (BYOK)
  /ask                   — search + synthesis (BYOK)
  /graph                 — force-graph viz
  /episodes              — browse summaries
  /settings              — API key + model
src/components/          — Nav, Footer, PassageCard, GraphCanvas, etc.
src/lib/                 — types, store (zustand), retrieve (MiniSearch),
                           prompts, anthropic client, citation parser
public/data/             — generated indices, served as static
```

## Credits

- Transcripts: [meaningcrisis.co](https://www.meaningcrisis.co/) — meticulously transcribed and sectioned community resource.
- Lectures and the ideas they contain: John Vervaeke. See [johnvervaeke.com](https://johnvervaeke.com/).
- This app is unaffiliated with John Vervaeke or meaningcrisis.co.

## Caveat on metadata quality

Episode metadata (essence, key claims, concepts, people, cross-references) was extracted by AI from the transcripts. It's pretty good but not perfect — some concept names may be inconsistent across episodes, and a few entities are imperfect (occasional misattribution between people with similar names). The canonical alias maps in `scripts/aliases.ts` normalize the most common cases. If you spot something off, the per-episode JSON files in `data/metadata/` are hand-editable; re-run `npm run build:data` after edits.
