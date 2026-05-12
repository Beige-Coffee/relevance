import Link from "next/link";

export const metadata = {
  title: "About, relevance",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 w-full">
      <p className="mono text-xs uppercase tracking-[0.22em] text-[var(--accent)] mb-3">A study companion</p>
      <h1 className="text-5xl lowercase text-[var(--accent)] leading-[1.05] tracking-tight">
        relevance
      </h1>
      <p className="serif italic text-xl text-[var(--ink-soft)] mt-4 leading-snug">
        Search, dialogue with, and map the ideas in John Vervaeke&rsquo;s lecture series{" "}
        <span className="whitespace-nowrap">&ldquo;Awakening from the Meaning Crisis.&rdquo;</span>
        {" "}A nod to the central technical construct of the series: relevance realization.
      </p>

      <div className="hr-soft my-10" />

      <section className="prose-reader space-y-5">
        <p>
          This site is an educational tool. It indexes the 50 hand-edited transcripts at
          {" "}
          <a className="lnk" href="https://www.meaningcrisis.co/all-transcripts/" target="_blank" rel="noreferrer">
            meaningcrisis.co
          </a>
          , extracts the concepts and thinkers that recur across the series, and lets you engage with them through a graph, a chat panel, and pre-curated multi-module walkthroughs.
        </p>
        <p>
          The{" "}
          <Link href="/" className="lnk">Graph</Link>{" "}
          is the front door. Each node is either a concept or a thinker from the corpus; the edges show how Vervaeke relates them. Click a node and the right-side panel opens with a brief description and, when one exists, an invitation to begin a Conversation.
        </p>
        <p>
          For the 28 flagship concepts of the series, there are pre-curated{" "}
          <Link href="/conversations" className="lnk">Conversations</Link>: Socratic walkthroughs built from verbatim transcript passages. Each one breaks the concept into modules, with prompts and check-for-understanding questions that hold the chat to the text. Conversations run right inside the same panel as the graph, so you can keep one eye on the network while you talk.
        </p>
        <p>
          Concept and thinker pages give you the full canonical entry for any node: definition, related ideas, source episodes, and verbatim quotes. The search box at the top of the <Link href="/" className="lnk">graph</Link> jumps you straight to any of them, and the &ldquo;Open the concept card&rdquo; link in the chat panel does the same.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">A clear disclaimer</h2>
        <div className="prose-reader space-y-3">
          <p>
            The chat partner you meet in this app is an AI assistant. It does not have a name; it is referred to simply as the dialogue. It is not John Vervaeke, does not speak in his voice, and does not represent his views. Its job is to ask you questions and ground its replies in passages from the lectures that you can verify yourself.
          </p>
          <p>
            This project is unaffiliated with Dr. Vervaeke,{" "}
            <a className="lnk" href="https://johnvervaeke.com/" target="_blank" rel="noreferrer">johnvervaeke.com</a>, or the volunteers who built{" "}
            <a className="lnk" href="https://www.meaningcrisis.co/" target="_blank" rel="noreferrer">meaningcrisis.co</a>. All quotes and ideas belong to him; the indexing and tooling here are just a way to navigate them.
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Bring your own key</h2>
        <p className="prose-reader">
          The graph and search work without any account. To use the chat (in the right-side dialogue panel or inside a Conversation), add an Anthropic or OpenRouter key on the{" "}
          <Link href="/settings" className="lnk">Settings page</Link>. Your key lives in your browser&rsquo;s local storage and is never sent to this site&rsquo;s server.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Browse the lectures</h2>
        <p className="prose-reader">
          If you prefer a flat list, the{" "}
          <Link href="/episodes" className="lnk">Episodes index</Link>{" "}
          has all 50 lectures with a one-paragraph essence per episode and a link out to the canonical transcript.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">How this was built</h2>
        <p className="prose-reader text-sm text-[var(--ink-soft)]">
          A technical overview of the corpus and the chat&rsquo;s grounding architecture. Optional reading.
        </p>
        <details className="mt-3 group rounded-md border border-[var(--border)] bg-[var(--surface)]">
          <summary className="cursor-pointer px-4 py-3 text-sm text-[var(--ink)] flex items-center justify-between hover:bg-[var(--elev)] rounded-md">
            <span>Behind the scenes</span>
            <span className="text-[var(--muted)] group-open:rotate-90 transition-transform inline-block">›</span>
          </summary>
          <div className="px-4 pb-5 pt-1 space-y-5 text-[14px] text-[var(--ink-soft)] leading-relaxed">
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">The corpus</h3>
              <p>
                The 50 hand-edited transcripts on{" "}
                <a className="lnk" href="https://www.meaningcrisis.co/all-transcripts/" target="_blank" rel="noreferrer">meaningcrisis.co</a>
                {" "}plus the introductory &ldquo;Awakening from the Meaning Crisis&rdquo; preview were scraped and normalized into 51 transcript JSON files. The resulting index covers 105 concepts, 94 thinkers, and 780 verbatim source passages.
              </p>
            </div>

            <div>
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">The metadata pipeline</h3>
              <p>
                The entity extraction was done with Claude Opus running in 1M-context mode so every pass could read whole regions of the corpus at once instead of chunking. It runs in five passes:
              </p>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>
                  <strong>Registry pass.</strong> Read the full corpus and emit a canonical list of concepts and thinkers, with aliases, clusters, and depth.
                </li>
                <li>
                  <strong>Per-episode extraction.</strong> For each of the 51 episodes, pull the passages where each registered entity appears, with surrounding context for grounding.
                </li>
                <li>
                  <strong>Enrichment.</strong> Backfill definitions, short bios, role-in-argument, related concepts, and contrasted concepts using the assembled passages.
                </li>
                <li>
                  <strong>Validation.</strong> A separate Opus pass spot-checks definitions and passages against the transcripts, flags ambiguous attributions, and rejects fabricated quotes.
                </li>
                <li>
                  <strong>Conversation generation.</strong> For each of the 28 flagship concepts, generate a multi-module Socratic walkthrough: learning objectives, exposition passages, Socratic seeds, anticipated misconceptions, and a check-for-understanding question per module.
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">The chat&rsquo;s grounding architecture</h3>
              <p>
                When you chat, the model does not improvise from memory. It is bound to a system prompt that enforces a five-rule grounding protocol designed to make hallucinated Vervaeke quotes harder to produce than honest ones:
              </p>
              <ol className="list-decimal pl-5 space-y-2 mt-3">
                <li>
                  <strong>Read on this turn.</strong> Before composing a reply that cites anything, the model must call one of its tools on the current turn. It is not allowed to lean on what it &ldquo;remembers&rdquo; from earlier in the session, or from training. That training memory is exactly the surface that generates plausible-sounding but fabricated Vervaeke quotes; this rule routes around it.
                </li>
                <li>
                  <strong>Quote inline, never send out.</strong> When the model quotes, it puts the verbatim text directly in the reply. It is forbidden from deflecting with &ldquo;go read Episode 28.&rdquo; Verbatim quotes are used sparingly, only for genuinely striking lines; the default is paraphrase plus an episode citation.
                </li>
                <li>
                  <strong>Every citation carries metadata.</strong> A bare &ldquo;Vervaeke says...&rdquo; without an episode number is treated as a claim, not a citation. Every reference to the corpus is tagged inline as &ldquo;(Episode N).&rdquo; If the model cannot tag it, it cannot make the claim.
                </li>
                <li>
                  <strong>Failure mode: say so.</strong> When <code className="mono text-[12px]">look_up</code> returns nothing useful, or <code className="mono text-[12px]">verify_quote</code> returns <code className="mono text-[12px]">found=false</code>, the model is required to tell you plainly: &ldquo;I do not see that in the transcripts I can access.&rdquo; It is explicitly not allowed to fill the gap with a plausible-sounding line. A missing citation is always better than a wrong one.
                </li>
                <li>
                  <strong>Pre-reply self-audit.</strong> Before sending, the model silently walks a checklist: every quoted phrase has a <code className="mono text-[12px]">verify_quote</code> result from this turn; every claim that Vervaeke discussed a thinker in a particular way has a <code className="mono text-[12px]">look_up</code> or <code className="mono text-[12px]">read_concept</code> from this turn; every &ldquo;(Episode N)&rdquo; tag traces back to a tool result from this turn. If any answer is no, the model is instructed to fix the reply or retract the claim before sending.
                </li>
              </ol>
              <p className="mt-4">
                To make the rules actually enforceable, the model is given three tools instead of being asked to introspect. The tools live behind a per-turn budget: each user turn instantiates a fresh budget object that counts calls per tool and caches results within the turn, so an identical call returns instantly without consuming budget. When the limit for a tool is exhausted, the next call returns an error telling the model to work with what it already has.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 mt-3">
                <li>
                  <code className="mono text-[12px]">look_up(query)</code>: BM25 search over the 780 passages, returns up to 6 ranked matches with episode metadata. <span className="text-[var(--muted)]">Limit: 2 calls per turn.</span>
                </li>
                <li>
                  <code className="mono text-[12px]">read_concept(id)</code>: fetch the full canonical entry for a concept or thinker (definition, related entities, source episodes, verbatim passages). <span className="text-[var(--muted)]">Limit: 5 calls per turn.</span>
                </li>
                <li>
                  <code className="mono text-[12px]">verify_quote(phrase, episode)</code>: check whether a verbatim phrase actually appears in a given episode, with fuzzy matching that tolerates minor punctuation differences. <span className="text-[var(--muted)]">Limit: 8 calls per turn.</span>
                </li>
              </ul>
              <p className="mt-4">
                Inside a Conversation the system prompt is swapped for one scoped to the current module: the learning objective, exposition passages, Socratic seeds, and misconception branches are baked in, so the dialogue stays inside that module&rsquo;s lesson plan. The five rules still apply.
              </p>
            </div>

            <div>
              <h3 className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)] mb-2">The stack</h3>
              <p>
                Next.js App Router, TypeScript, Tailwind, and a force-directed graph rendered to canvas. The chat uses the Anthropic SDK in the browser, talking either directly to Anthropic or through OpenRouter so you can try GPT, Gemini, or Llama models with the same UI. Your key never touches this site&rsquo;s server.
              </p>
            </div>
          </div>
        </details>
      </section>

      <section className="mt-10 text-sm text-[var(--muted)]">
        <p>
          Made by Austin. The source is open at{" "}
          <a className="lnk" href="https://github.com/" target="_blank" rel="noreferrer">github</a>{" "}
          (insert link).
        </p>
      </section>
    </div>
  );
}
