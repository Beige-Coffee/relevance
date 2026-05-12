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
          This site is an educational tool. It indexes the fifty hand-edited transcripts at
          {" "}
          <a className="lnk" href="https://www.meaningcrisis.co/all-transcripts/" target="_blank" rel="noreferrer">
            meaningcrisis.co
          </a>
          , extracts the concepts and thinkers that recur across the series, and lets you engage with them in three ways.
        </p>
        <p>
          The home page is a graph of ideas and thinkers, drawn from the corpus.
          {" "}
          <Link href="/" className="lnk">Open it</Link>{" "}
          and click any node to inspect its definition, source passage, sub-concepts, and the episodes where it appears. Toggle between Concepts and Thinkers at the top-left.
        </p>
        <p>
          For the twenty-eight flagship concepts of the series, there are pre-curated{" "}
          <Link href="/conversations" className="lnk">Conversations</Link>: Socratic walkthroughs built from verbatim transcript passages. Each one breaks the concept into modules, with prompts and check-for-understanding questions that hold the AI to the text.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">A clear disclaimer</h2>
        <div className="prose-reader space-y-3">
          <p>
            The dialogue partner you meet in this app is an AI assistant. It is not John Vervaeke, does not speak in his voice, and does not represent his views. Its job is to ask you questions and ground its replies in passages from the lectures that you can verify yourself.
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
          The graph and search work without any account. To use the chat features (Dialogue, Ask, the right-panel discussion threads, or a Conversation), add an Anthropic or OpenRouter key on the{" "}
          <Link href="/settings" className="lnk">Settings page</Link>. Your key lives in your browser&rsquo;s local storage and is never sent to this site&rsquo;s server.
        </p>
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
