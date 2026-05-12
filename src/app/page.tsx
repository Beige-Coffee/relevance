import Link from "next/link";

const modes = [
  {
    href: "/dialogue",
    title: "Dialogue",
    blurb:
      "Think through Vervaeke's ideas in Socratic exchange. The AI asks questions back, draws on the corpus, and cites episodes — it does not impersonate Vervaeke.",
    cta: "Begin a dialogue",
  },
  {
    href: "/ask",
    title: "Ask",
    blurb:
      "Where did he discuss X? Get a synthesized answer with passages and episode citations, drawn from the full corpus.",
    cta: "Ask a question",
  },
  {
    href: "/graph",
    title: "Graph",
    blurb:
      "Explore the lecture series as a web of concepts, thinkers, and episodes. Click a node to see what bridges to what.",
    cta: "Open the graph",
  },
];

export default function Home() {
  return (
    <div className="flex-1">
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <p className="ep-num text-xs uppercase tracking-[0.22em] mb-6">A study companion · 50 lectures · ~395k words</p>
        <h1 className="serif text-5xl sm:text-6xl leading-[1.02] tracking-tight text-[var(--ink)]">
          Awakening <span className="text-[var(--gold)]">Atlas</span>
        </h1>
        <p className="serif italic text-xl sm:text-2xl text-[var(--ink-soft)] mt-3 leading-snug">
          Search, dialogue, and map the ideas in John Vervaeke&rsquo;s lecture series{" "}
          <span className="whitespace-nowrap">&ldquo;Awakening from the Meaning Crisis.&rdquo;</span>
        </p>

        <div className="hr-soft my-10" />

        <p className="prose-reader max-w-2xl">
          This is an educational tool. It indexes the 50 hand-edited transcripts at meaningcrisis.co, extracts the concepts
          and thinkers Vervaeke discusses, and lets you engage with them in three ways &mdash; through Socratic dialogue,
          targeted lookup, and a graph of how the ideas connect. The dialogue partner is an AI helper, not Vervaeke, and is
          designed to ask you questions rather than perform him.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
          {modes.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)] transition-colors"
            >
              <h2 className="serif text-2xl text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors">
                {m.title}
              </h2>
              <p className="text-sm text-[var(--ink-soft)] mt-3 leading-relaxed">{m.blurb}</p>
              <span className="text-xs mono mt-5 inline-block text-[var(--accent)] group-hover:underline">
                {m.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="text-sm text-[var(--muted)] space-y-3 leading-relaxed">
          <p>
            <strong className="text-[var(--ink-soft)] font-medium">Bring your own key.</strong> Dialogue and Ask use the
            Anthropic API. Paste your key once on the{" "}
            <Link href="/settings" className="lnk">
              Settings page
            </Link>{" "}
            &mdash; it stays in your browser and is never sent to this site&rsquo;s server.
          </p>
          <p>
            <strong className="text-[var(--ink-soft)] font-medium">Graph &amp; search work offline.</strong> The corpus is
            indexed in your browser. No API key needed to browse.
          </p>
        </div>
      </section>
    </div>
  );
}
