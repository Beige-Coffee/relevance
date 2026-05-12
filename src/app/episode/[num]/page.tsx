"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEpisodes, getConcepts, getPeople } from "@/lib/data";
import type { Episode, Concept, Person } from "@/lib/types";

export default function EpisodePage({ params }: { params: Promise<{ num: string }> }) {
  const { num: numStr } = use(params);
  const num = Number(numStr);
  const [ep, setEp] = useState<Episode | null | undefined>(undefined);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    Promise.all([getEpisodes(), getConcepts(), getPeople()]).then(([es, cs, ps]) => {
      setConcepts(cs);
      setPeople(ps);
      setEp(es.find((e) => e.num === num) ?? null);
    });
  }, [num]);

  if (ep === undefined) return <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--muted)]">Loading...</div>;
  if (ep === null) return notFound();

  const introducedHere = (concepts ?? []).filter((c) => c.introducedIn === ep.num);
  const developedHere = (concepts ?? []).filter((c) => c.developedIn.includes(ep.num) && c.introducedIn !== ep.num);
  const appliedHere = (concepts ?? []).filter(
    (c) =>
      c.appliedIn.includes(ep.num) &&
      c.introducedIn !== ep.num &&
      !c.developedIn.includes(ep.num)
  );
  const peopleHere = (people ?? []).filter((p) => p.discussedIn.includes(ep.num));

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 w-full">
      <div className="text-xs text-[var(--muted)] mb-2">
        <Link href="/episodes" className="hover:text-[var(--accent)]">← All episodes</Link>
      </div>
      <p className="mono text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-2">Episode {ep.num}</p>
      <h1 className="serif text-4xl sm:text-5xl text-[var(--ink)] leading-tight tracking-tight">{ep.title}</h1>
      <div className="mt-4 text-sm text-[var(--muted)]">
        {ep.words.toLocaleString()} words · {ep.conceptCount} concepts · {ep.peopleCount} thinkers
      </div>
      <a
        href={ep.url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-bright)] transition-colors"
      >
        Read the full transcript at meaningcrisis.co
      </a>

      <div className="hr-soft my-10" />

      <section>
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Essence</h2>
        <p className="prose-reader">{ep.essence}</p>
      </section>

      {ep.keyClaims.length > 0 && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-3">Key claims</h2>
          <ul className="space-y-2.5 text-[var(--ink-soft)]">
            {ep.keyClaims.map((c, i) => (
              <li key={i} className="prose-reader text-[15px] leading-relaxed">{c}</li>
            ))}
          </ul>
        </section>
      )}

      {(introducedHere.length > 0 || developedHere.length > 0 || appliedHere.length > 0) && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-3">Concepts in this episode</h2>
          {introducedHere.length > 0 && (
            <ConceptRow label="Introduced" concepts={introducedHere} />
          )}
          {developedHere.length > 0 && (
            <ConceptRow label="Developed" concepts={developedHere} />
          )}
          {appliedHere.length > 0 && (
            <ConceptRow label="Applied" concepts={appliedHere} />
          )}
        </section>
      )}

      {peopleHere.length > 0 && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-3">Thinkers discussed</h2>
          <div className="flex flex-wrap gap-1.5">
            {peopleHere.map((p) => (
              <Link key={p.id} href={`/person/${p.id}`} className="cite-pill">
                {p.canonicalName}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ConceptRow({ label, concepts }: { label: string; concepts: Concept[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">{label}</h3>
      <div className="flex flex-wrap gap-1.5">
        {concepts.map((c) => (
          <Link key={c.id} href={`/concept/${c.id}`} className="cite-pill">
            {c.canonicalName}
          </Link>
        ))}
      </div>
    </div>
  );
}
