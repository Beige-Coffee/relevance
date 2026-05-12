"use client";

import { getConcepts, getTranscripts } from "./data";
import { retrieve } from "./retrieve";

// Anthropic tool-use schema. Note: input_schema must be a JSON Schema object.
export const TOOLS = [
  {
    name: "look_up",
    description:
      "Search Vervaeke's lecture transcripts for passages matching a query. Returns up to 6 ranked passages with episode number and verbatim text. Use this when you need fresh source material to ground a reply, especially when the student asks about something not already covered in the conversation context. Limit: 2 calls per turn.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query. A phrase ('relevance realization'), a thinker's name ('Heidegger'), or a question ('what does Vervaeke mean by religio?').",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "read_concept",
    description:
      "Fetch the full canonical entry for a specific concept by its id. Returns: definition, verbatim source passage with episode, sub-concepts, common confusions, prerequisites, related concepts, key passages, and which episodes the concept appears in. Use this whenever the student names a concept or you want to ground how a specific concept is treated in the series. Limit: 5 calls per turn.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Concept id in kebab-case. Examples: 'relevance-realization', 'agape', 'salience-landscape', 'the-meaning-crisis', '4e-cognition', 'religio', 'wisdom', 'the-axial-revolution'.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "verify_quote",
    description:
      "Check whether a verbatim quote actually appears in a specific episode's transcript. Returns whether it was found and, if not, whether the same quote exists in a different episode. ALWAYS call this BEFORE emitting any quoted text with an episode citation. If found=false, do NOT use the quote: paraphrase instead, or say you can't find it. Limit: 8 calls per turn.",
    input_schema: {
      type: "object",
      properties: {
        quote: {
          type: "string",
          description: "The exact text you intend to quote (no surrounding quotation marks needed). Provide a contiguous span of words; do not summarize.",
        },
        episode: {
          type: "number",
          description: "Episode number (0 for the intro, 1-50 for the main series).",
        },
      },
      required: ["quote", "episode"],
    },
  },
] as const;

// Per-turn rate limits and dedup cache, instantiated fresh for each user turn.
const LIMITS: Record<string, number> = {
  look_up: 2,
  read_concept: 5,
  verify_quote: 8,
};

export class ToolBudget {
  private counts = new Map<string, number>();
  private cache = new Map<string, unknown>();

  reset(): void {
    this.counts.clear();
    this.cache.clear();
  }

  canCall(name: string): boolean {
    const used = this.counts.get(name) ?? 0;
    const limit = LIMITS[name] ?? Number.POSITIVE_INFINITY;
    return used < limit;
  }

  recordCall(name: string): void {
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
  }

  cacheGet(name: string, args: unknown): unknown | undefined {
    return this.cache.get(this.cacheKey(name, args));
  }

  cacheSet(name: string, args: unknown, result: unknown): void {
    this.cache.set(this.cacheKey(name, args), result);
  }

  private cacheKey(name: string, args: unknown): string {
    return name + ":" + JSON.stringify(args);
  }
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolEventStart {
  kind: "start";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface ToolEventDone {
  kind: "done";
  id: string;
  name: string;
  input: Record<string, unknown>;
  result: unknown;
  cached?: boolean;
  rateLimited?: boolean;
}
export type ToolEvent = ToolEventStart | ToolEventDone;

function normalize(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\\(\[|\]|\(|\)|"|')/g, "$1");
}
function alphaOnly(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function containsFuzzy(haystack: string, needle: string): boolean {
  if (haystack.includes(needle)) return true;
  if (normalize(haystack).includes(normalize(needle))) return true;
  if (needle.length >= 24 && alphaOnly(haystack).includes(alphaOnly(needle))) return true;
  return false;
}

export async function executeTool(call: ToolCall, budget: ToolBudget): Promise<unknown> {
  // Dedup: identical call within the same turn returns cached result instantly.
  const cached = budget.cacheGet(call.name, call.input);
  if (cached !== undefined) {
    return { ...(cached as object), _cached: true };
  }

  if (!budget.canCall(call.name)) {
    return {
      error: `Tool '${call.name}' is rate-limited for this turn. You've used the budget. Pick a different tool, or work with what you already know.`,
    };
  }
  budget.recordCall(call.name);

  let result: unknown;
  try {
    switch (call.name) {
      case "look_up": {
        const query = String(call.input.query ?? "").trim();
        if (!query) {
          result = { error: "Empty query." };
          break;
        }
        const hits = await retrieve(query, 6);
        result = {
          query,
          passages: hits.map((r) => ({
            episode: r.passage.episode,
            episodeTitle: r.passage.episodeTitle,
            text: r.passage.text,
            score: Math.round(r.score * 100) / 100,
          })),
        };
        break;
      }

      case "read_concept": {
        const id = String(call.input.id ?? "").trim();
        const concepts = await getConcepts();
        const c = concepts.find((x) => x.id === id);
        if (!c) {
          const lower = id.toLowerCase();
          const close = concepts
            .filter((x) => x.id.includes(lower) || x.canonicalName.toLowerCase().includes(lower))
            .slice(0, 5)
            .map((x) => `${x.id} (${x.canonicalName})`);
          result = {
            error: `No concept with id '${id}'.`,
            suggestions: close.length ? close : ["Try look_up with a query instead."],
          };
        } else {
          result = c;
        }
        break;
      }

      case "verify_quote": {
        const quote = String(call.input.quote ?? "").trim();
        const ep = Number(call.input.episode);
        if (!quote) {
          result = { error: "Empty quote." };
          break;
        }
        const transcripts = await getTranscripts();
        const claimed = transcripts[ep];
        if (!claimed) {
          result = { found: false, error: `Episode ${ep} not in the corpus.` };
          break;
        }
        if (containsFuzzy(claimed.body, quote)) {
          result = {
            found: true,
            episode: ep,
            message: `Quote verified verbatim in Episode ${ep} (${claimed.title}).`,
          };
          break;
        }
        // Try other episodes
        let foundIn: number | undefined;
        for (const [n, t] of Object.entries(transcripts)) {
          const num = Number(n);
          if (num === ep) continue;
          if (containsFuzzy(t.body, quote)) {
            foundIn = num;
            break;
          }
        }
        result =
          foundIn !== undefined
            ? {
                found: false,
                episodeChecked: ep,
                foundInOtherEpisode: foundIn,
                message: `Not found in Episode ${ep}, but a verbatim match exists in Episode ${foundIn}. Cite that one instead, or do not use this quote.`,
              }
            : {
                found: false,
                episodeChecked: ep,
                message: `Not found in Episode ${ep} or any other episode. Do not use this quote. Paraphrase the idea and cite the episode where you actually saw it discussed, or admit you cannot locate the exact wording.`,
              };
        break;
      }

      default:
        result = { error: `Unknown tool: ${call.name}` };
    }
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }

  budget.cacheSet(call.name, call.input, result);
  return result;
}
