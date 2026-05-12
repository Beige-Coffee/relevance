"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getConcepts, getPeople, getEpisodes, getCourses } from "@/lib/data";
import type { Concept, Person, Episode, CourseSummary } from "@/lib/types";
import { notFound } from "next/navigation";

export default function ConceptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [concept, setConcept] = useState<Concept | null | undefined>(undefined);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);

  useEffect(() => {
    Promise.all([getConcepts(), getPeople(), getEpisodes(), getCourses()]).then(([cs, ps, es, crs]) => {
      setConcepts(cs); setPeople(ps); setEpisodes(es); setCourses(crs);
      const c = cs.find((x) => x.id === id) ?? null;
      setConcept(c);
    });
  }, [id]);

  if (concept === undefined) return <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--muted)]">Loading…</div>;
  if (concept === null) return notFound();

  const cMap = new Map(concepts?.map((x) => [x.id, x]) ?? []);
  const pMap = new Map(people?.map((x) => [x.id, x]) ?? []);
  const eMap = new Map(episodes?.map((x) => [x.num, x]) ?? []);
  const course = courses?.find((cr) => cr.conceptId === concept.id);

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
      <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
        Concept · {concept.cluster} · depth {concept.depth}{concept.isFlagship ? " · ★ flagship" : ""}
      </div>
      <h1 className="serif text-5xl text-[var(--ink)] leading-tight">{concept.canonicalName}</h1>
      <p className="serif italic text-xl text-[var(--ink-soft)] mt-3 leading-snug">{concept.definition}</p>

      {course && (
        <Link
          href={`/conversation/${course.id}`}
          className="mt-6 inline-flex items-center px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--bg)] text-sm font-medium hover:opacity-90 transition"
        >
          ★ Take the mini-course →
        </Link>
      )}

      <div className="hr-soft my-10" />

      <section>
        <h2 className="serif text-2xl text-[var(--ink)] mb-3">Source passage</h2>
        <blockquote className="border-l-2 border-[var(--accent)] pl-4 py-2 bg-[var(--elev)] rounded-r-md">
          <div className="mono text-xs text-[var(--accent)] mb-1">Episode {concept.sourcePassage.episode}</div>
          <p className="prose-reader text-[15px] italic">&ldquo;{concept.sourcePassage.quote}&rdquo;</p>
        </blockquote>
      </section>

      {concept.notes && (
        <section className="mt-8">
          <h2 className="serif text-2xl text-[var(--ink)] mb-3">Notes</h2>
          <p className="prose-reader text-[15px]">{concept.notes}</p>
        </section>
      )}

      <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Introduced</h3>
          <div>{epPill(concept.introducedIn)}</div>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Developed</h3>
          <div className="flex flex-wrap gap-1">{concept.developedIn.map(epPill)}</div>
        </div>
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Applied</h3>
          <div className="flex flex-wrap gap-1">{concept.appliedIn.map(epPill)}</div>
        </div>
      </section>

      {concept.subConcepts && concept.subConcepts.length > 0 && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-4">Sub-concepts</h2>
          <div className="space-y-4">
            {concept.subConcepts.map((sc) => (
              <article key={sc.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
                <h3 className="serif text-xl text-[var(--ink)]">{sc.name}</h3>
                <p className="prose-reader text-[15px] mt-2">{sc.summary}</p>
                {sc.passages && sc.passages.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {sc.passages.map((pp, i) => (
                      <blockquote key={i} className="border-l-2 border-[var(--border)] pl-3 py-1">
                        <div className="mono text-xs text-[var(--accent)] mb-0.5">Episode {pp.episode}</div>
                        <p className="serif italic text-sm text-[var(--ink-soft)]">&ldquo;{pp.phrase}&rdquo;</p>
                      </blockquote>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {concept.keyPassages && concept.keyPassages.length > 0 && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-4">Key passages</h2>
          <div className="space-y-3">
            {concept.keyPassages.map((kp, i) => (
              <blockquote key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center gap-2 mb-1.5 text-xs">
                  <span className="mono uppercase tracking-wider text-[var(--muted)]">{kp.role}</span>
                  <span className="mono text-[var(--accent)]">Episode {kp.episode}</span>
                </div>
                <p className="prose-reader text-[15px] italic">&ldquo;{kp.phrase}&rdquo;</p>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {concept.commonConfusions && concept.commonConfusions.length > 0 && (
        <section className="mt-10">
          <h2 className="serif text-2xl text-[var(--ink)] mb-4">Common confusions</h2>
          <ul className="space-y-3 text-[var(--ink-soft)]">
            {concept.commonConfusions.map((c, i) => (
              <li key={i} className="prose-reader text-[15px] leading-relaxed">, {c}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
        {concept.prerequisites.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Prerequisites</h3>
            <div className="flex flex-wrap gap-1.5">
              {concept.prerequisites.map((p) => {
                const target = cMap.get(p);
                return target ? (
                  <Link key={p} href={`/concept/${p}`} className="cite-pill" style={{ color: "var(--accent)" }}>
                    {target.canonicalName}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        )}
        {concept.relatedConcepts.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Related concepts</h3>
            <div className="flex flex-wrap gap-1.5">
              {concept.relatedConcepts.map((p) => {
                const target = cMap.get(p);
                return target ? (
                  <Link key={p} href={`/concept/${p}`} className="cite-pill" style={{ color: "var(--accent)" }}>
                    {target.canonicalName}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        )}
        {concept.contrastedWith && concept.contrastedWith.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Contrasted with</h3>
            <div className="flex flex-wrap gap-1.5">
              {concept.contrastedWith.map((p) => {
                const target = cMap.get(p);
                return target ? (
                  <Link key={p} href={`/concept/${p}`} className="cite-pill" style={{ color: "var(--accent)" }}>
                    {target.canonicalName}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        )}
        {concept.associatedPeople.length > 0 && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Associated thinkers</h3>
            <div className="flex flex-wrap gap-1.5">
              {concept.associatedPeople.map((p) => {
                const target = pMap.get(p);
                return target ? (
                  <Link key={p} href={`/person/${p}`} className="cite-pill" style={{ color: "var(--accent)" }}>
                    {target.canonicalName}
                  </Link>
                ) : null;
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
