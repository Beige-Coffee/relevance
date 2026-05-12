"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getConcepts, getPeople, getEpisodes } from "@/lib/data";
import type { Concept, Person, Episode } from "@/lib/types";
import { notFound } from "next/navigation";

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null | undefined>(undefined);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);

  useEffect(() => {
    Promise.all([getConcepts(), getPeople(), getEpisodes()]).then(([cs, ps, es]) => {
      setConcepts(cs); setEpisodes(es);
      const p = ps.find((x) => x.id === id) ?? null;
      setPerson(p);
    });
  }, [id]);

  if (person === undefined) return <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--muted)]">Loading…</div>;
  if (person === null) return notFound();

  const cMap = new Map(concepts?.map((x) => [x.id, x]) ?? []);
  const eMap = new Map(episodes?.map((x) => [x.num, x]) ?? []);

  const epPill = (n: number) => {
    const e = eMap.get(n);
    return (
      <Link key={n} href={`/episodes#ep-${n}`} className="cite-pill" title={e?.title}>
        Ep {n}
      </Link>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Thinker</div>
      <h1 className="serif text-5xl text-[var(--ink)] leading-tight">{person.canonicalName}</h1>
      <p className="serif italic text-xl text-[var(--ink-soft)] mt-3 leading-snug">{person.shortBio}</p>

      <div className="hr-soft my-10" />

      <section>
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Role in Vervaeke&rsquo;s argument</h2>
        <p className="prose-reader">{person.roleInArgument}</p>
      </section>

      <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Introduced</h3>
          <div>{epPill(person.introducedIn)}</div>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Discussed in</h3>
          <div className="flex flex-wrap gap-1">{person.discussedIn.map(epPill)}</div>
        </div>
      </section>

      {person.keyClaimsAbout.length > 0 && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-4">What Vervaeke says about them</h2>
          <ul className="space-y-3 text-[var(--ink-soft)]">
            {person.keyClaimsAbout.map((c, i) => (
              <li key={i} className="prose-reader text-[15px] leading-relaxed">{c}</li>
            ))}
          </ul>
        </section>
      )}

      {person.associatedConcepts.length > 0 && (
        <section className="mt-10">
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Associated concepts</h3>
          <div className="flex flex-wrap gap-1.5">
            {person.associatedConcepts.map((cid) => {
              const c = cMap.get(cid);
              return c ? (
                <Link key={cid} href={`/concept/${cid}`} className="cite-pill" style={{ color: "var(--accent)" }}>
                  {c.canonicalName}
                </Link>
              ) : null;
            })}
          </div>
        </section>
      )}

      {person.notes && (
        <section className="mt-8">
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Notes</h3>
          <p className="text-sm text-[var(--ink-soft)]">{person.notes}</p>
        </section>
      )}
    </div>
  );
}
