# relevance

A study companion for John Vervaeke's lecture series *Awakening from the Meaning Crisis*. Search, dialogue with, and map the ideas across the 50 lectures.

This is an unaffiliated educational tool. It is not endorsed by Dr. Vervaeke, by [johnvervaeke.com](https://johnvervaeke.com/), or by the volunteers behind [meaningcrisis.co](https://www.meaningcrisis.co/). All quotes and ideas belong to him; the indexing and tooling here are just a way to navigate them.

## What it does

- **Graph view.** A force-directed map of the concepts and thinkers Vervaeke discusses, edges drawn from the canonical registry (prerequisite, related, contrasted).
- **Isolate a concept.** Click any concept, then "Isolate on graph" to see its full transitive prerequisite chain stacked left-to-right toward it, contrasts to the right, related ideas below.
- **Chat.** A Socratic dialogue partner that grounds every reply in the actual transcripts via three tools (`look_up`, `read_concept`, `verify_quote`) bounded by a per-turn budget.
- **Conversations.** 28 pre-curated multi-module walkthroughs of the flagship concepts in Vervaeke's argument. Each module has its own learning objective, source passages, Socratic seeds, and check-for-understanding question. Click a flagship concept, click Begin the Conversation, and the dialogue is bound to that module's text.

## BYOK + privacy

This app stores no user data on a server. There is no server: it is statically deployed Next.js with a few JSON files in `/public/data`. Everything happens in your browser.

To chat, you supply your own API key from one of two providers:

- **OpenRouter** (recommended). Sign up at [openrouter.ai/keys](https://openrouter.ai/keys), add a few dollars of credit, paste the key on the Settings page. A few dollars goes a long way.
- **Anthropic** direct. Get a key at [console.anthropic.com](https://console.anthropic.com/settings/keys). Same flow.

Your key lives only in your browser's `localStorage`. It is never sent to this site's server (because there is no server). When you chat, your messages and the key go directly from your browser to the provider you chose.

### Audit summary

You can verify the privacy claims yourself by reading the source:

- **No analytics or telemetry libraries** in `package.json`. No GA, no PostHog, no Plausible, no Sentry, no Datadog, no Mixpanel, no Amplitude. No third-party scripts.
- **No `process.env` reads** anywhere in `src/`. The code can't be configured at deploy time to send data to a hidden endpoint.
- **No `.env` files** committed.
- **No personal info** in source. No hardcoded keys. The only personal string is "Made by Austin" on the About page.
- **Three (and only three) network destinations:**
  1. `src/lib/data.ts` fetches static JSON from the same origin (`/data/*.json`).
  2. `src/lib/anthropic.ts` builds an Anthropic SDK client pointed at either `api.anthropic.com` or `openrouter.ai/api`, depending on which provider you select.
  3. `src/lib/stream.ts` calls that client's `messages.stream`.

That's it. The chat sends your prompt, the system prompt, the conversation history, the tool definitions, and (for OpenRouter only) attribution headers `HTTP-Referer` and `X-Title`. Nothing else leaves the browser.

### What's stored locally

The browser keeps three `localStorage` entries, all under your control. Clear them anytime from devtools.

| Key                       | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `amc-settings-v2`         | Provider choice, model choice, API key, Enter-to-send flag.  |
| `amc-chat-threads-v1`     | Chat history per topic (concept, thinker, or course module). |
| `home-chat-width`         | Width of the resizable chat panel.                           |

## How it was built

Five-pass Opus 1M pipeline applied to the 50 hand-edited transcripts at [meaningcrisis.co](https://www.meaningcrisis.co/all-transcripts/):

1. **Registry.** Read every transcript, emit canonical concepts and thinkers with aliases, clusters, depth.
2. **Per-episode extraction.** For each episode, pull the passages where each registered entity appears.
3. **Enrichment.** Backfill definitions, short bios, role-in-argument, related concepts, contrasted concepts.
4. **Validation.** A separate Opus pass spot-checks definitions and passages against the transcripts, flags ambiguous attributions, rejects fabricated quotes.
5. **Conversation generation.** For the 28 flagship concepts, generate a multi-module Socratic walkthrough.

Result: 105 concepts, 94 thinkers, 780 source passages, 28 Conversations. All in `public/data/`.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind 4
- `react-force-graph-2d` + `d3-force` for the canvas graph
- `@anthropic-ai/sdk` in the browser, pointed at Anthropic or OpenRouter (both expose the Anthropic Messages API shape)
- `zustand` (with `persist`) for the settings + chat-thread stores
- No backend, no database

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Add a key on the Settings page and you're chatting.

## Acknowledgements

Vervaeke's full lecture series is at [meaningcrisis.co](https://www.meaningcrisis.co/). The transcripts on that site are the bedrock of everything here; thank you to the volunteers who made them. Vervaeke's own work, courses, and writing are at [johnvervaeke.com](https://johnvervaeke.com/).
