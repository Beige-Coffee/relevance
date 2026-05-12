// Scrape all 51 transcripts from meaningcrisis.co into data/transcripts/*.md.
// Strategy: load each page, pick the longest <div class="ct-text-block">,
// convert its HTML to Markdown with Turndown, write with frontmatter.
//
// Re-runnable: skips files that already exist unless RESCRAPE=1.

import { load } from "cheerio";
import TurndownService from "turndown";
import { writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { EPISODES, filenameFor, type EpisodeRef } from "./manifest.ts";

const OUT_DIR = path.resolve(process.cwd(), "data", "transcripts");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) meaning-crisis-archive/0.1";
const CONCURRENCY = 2;
const PER_REQUEST_DELAY_MS = 600;
const RESCRAPE = process.env.RESCRAPE === "1";

const td = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
});
td.addRule("stripImages", { filter: ["img"], replacement: () => "" });
td.addRule("stripScripts", { filter: ["script", "style", "iframe"], replacement: () => "" });

async function fetchPage(url: string, attempt = 1): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) {
    if (attempt < 6) {
      // Exponential backoff with jitter; 503s deserve a real cooldown.
      const base = res.status === 503 ? 4000 : 1500;
      const wait = base * Math.pow(2, attempt - 1) + Math.random() * 1500;
      await new Promise((r) => setTimeout(r, wait));
      return fetchPage(url, attempt + 1);
    }
    throw new Error(`fetch ${url} failed: ${res.status}`);
  }
  return await res.text();
}

function extractTranscriptHtml(html: string): { html: string; chars: number } {
  const $ = load(html);
  const blocks = $("div.ct-text-block");
  let best = { html: "", chars: 0 };
  blocks.each((_, el) => {
    const inner = $(el).html() ?? "";
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > best.chars) {
      best = { html: inner, chars: text.length };
    }
  });
  return best;
}

function frontmatter(ep: EpisodeRef, words: number): string {
  return [
    "---",
    `num: ${ep.num}`,
    `slug: ${ep.slug}`,
    `title: ${JSON.stringify(ep.title)}`,
    `url: ${ep.url}`,
    `scrapedAt: ${new Date().toISOString()}`,
    `words: ${words}`,
    "tier: 1",
    "source: meaningcrisis.co",
    "---",
    "",
  ].join("\n");
}

async function scrapeOne(ep: EpisodeRef): Promise<{ ep: EpisodeRef; words: number; skipped: boolean }> {
  const outPath = path.join(OUT_DIR, filenameFor(ep));
  if (!RESCRAPE) {
    try {
      const existing = await readdir(OUT_DIR);
      if (existing.includes(filenameFor(ep))) {
        return { ep, words: 0, skipped: true };
      }
    } catch {
      // dir not created yet
    }
  }
  const html = await fetchPage(ep.url);
  const { html: blockHtml, chars } = extractTranscriptHtml(html);
  if (chars < 1000) {
    throw new Error(`ep ${ep.num}: transcript block too short (${chars} chars)`);
  }
  const markdown = td.turndown(blockHtml).trim();
  const words = markdown.split(/\s+/).filter(Boolean).length;
  const content = frontmatter(ep, words) + markdown + "\n";
  await writeFile(outPath, content, "utf8");
  return { ep, words, skipped: false };
}

async function runBatch(items: EpisodeRef[], n: number) {
  const results: { ep: EpisodeRef; words: number; skipped: boolean; error?: string }[] = [];
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const my = idx++;
      const ep = items[my];
      try {
        const r = await scrapeOne(ep);
        results[my] = r;
        const tag = r.skipped ? "skip" : "ok  ";
        console.log(`  [${tag}] ep ${String(ep.num).padStart(2, "0")} — ${ep.title} (${r.words || "—"} words)`);
        if (!r.skipped) await new Promise((rs) => setTimeout(rs, PER_REQUEST_DELAY_MS));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results[my] = { ep, words: 0, skipped: false, error: msg };
        console.log(`  [FAIL] ep ${String(ep.num).padStart(2, "0")} — ${msg}`);
      }
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Scraping ${EPISODES.length} transcripts to ${OUT_DIR}`);
  console.log(`Concurrency: ${CONCURRENCY} | RESCRAPE=${RESCRAPE ? "yes" : "no (set RESCRAPE=1 to force)"}\n`);
  const t0 = Date.now();
  const results = await runBatch(EPISODES, CONCURRENCY);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const ok = results.filter((r) => !r.skipped && !r.error);
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => r.error);
  const totalWords = ok.reduce((a, b) => a + b.words, 0);

  console.log(`\nDone in ${dt}s.`);
  console.log(`  Scraped:  ${ok.length}`);
  console.log(`  Skipped:  ${skipped.length}`);
  console.log(`  Failed:   ${failed.length}`);
  console.log(`  Total words: ${totalWords.toLocaleString()}`);

  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  ep ${f.ep.num}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
