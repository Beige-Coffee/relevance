"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getCourse, getConcepts, getEpisodes } from "@/lib/data";
import type { Course, Concept, Episode } from "@/lib/types";
import { notFound } from "next/navigation";
import { useChat } from "@/lib/store";

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [activeModule, setActiveModule] = useState<number>(0);

  useEffect(() => {
    Promise.all([getConcepts(), getEpisodes()]).then(([cs, es]) => {
      setConcepts(cs); setEpisodes(es);
    });
    getCourse(id).then(setCourse).catch(() => setCourse(null));
  }, [id]);

  if (course === undefined) return <div className="max-w-3xl mx-auto px-6 py-12 text-[var(--muted)]">Loading…</div>;
  if (course === null) return notFound();

  const concept = concepts?.find((c) => c.id === course.conceptId);
  const eMap = new Map(episodes?.map((e) => [e.num, e]) ?? []);
  const mod = course.modules[activeModule];

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-4 w-full">
        <Link href="/conversations" className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">← All Conversations</Link>
        <div className="text-xs uppercase tracking-wider text-[var(--muted)] mt-3 mb-2">
          Conversation · {concept?.cluster ?? ""}{concept ? ` · depth ${concept.depth}` : ""}
        </div>
        <h1 className="serif text-5xl text-[var(--ink)] leading-tight">{course.title}</h1>
        <p className="prose-reader mt-4 max-w-3xl">{course.abstract}</p>

        {course.prerequisites.length > 0 && (
          <div className="mt-4 text-sm text-[var(--muted)]">
            <span className="uppercase tracking-wider text-xs mr-2">Prerequisites:</span>
            {course.prerequisites.map((p, i) => {
              const tc = concepts?.find((c) => c.id === p);
              return tc ? (
                <Link key={p} href={`/conversation/${p}`} className="lnk mr-2">
                  {tc.canonicalName}
                </Link>
              ) : (
                <span key={p} className="mono text-xs mr-2">{p}</span>
              );
            })}
          </div>
        )}
      </div>

      <div className="hr-soft mx-6 max-w-5xl xl:mx-auto" />

      <div className="flex-1 flex flex-col md:flex-row max-w-5xl mx-auto w-full">
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[var(--border)] px-6 py-6">
          <h2 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Modules</h2>
          <ol className="space-y-1.5">
            {course.modules.map((m, i) => (
              <li key={m.id}>
                <button
                  onClick={() => setActiveModule(i)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    i === activeModule
                      ? "bg-[var(--accent)] text-[var(--bg)]"
                      : "hover:bg-[var(--elev)] text-[var(--ink-soft)]"
                  }`}
                >
                  <span className="mono text-[10px] opacity-70 mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                  {m.title}
                </button>
              </li>
            ))}
          </ol>

          <div className="mt-8 pt-6 border-t border-[var(--border)]">
            <h2 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">Related</h2>
            {concept && (
              <Link href={`/concept/${concept.id}`} className="text-sm lnk block mb-1">
                Concept deep-dive ↗
              </Link>
            )}
          </div>
        </aside>

        <section className="flex-1 px-6 py-8">
          <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-2">
            Module {activeModule + 1} of {course.modules.length}
          </div>
          <h2 className="serif text-3xl text-[var(--ink)] leading-tight">{mod.title}</h2>
          <p className="prose-reader mt-3 text-[var(--ink-soft)]">{mod.learningObjective}</p>

          <section className="mt-8">
            <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Exposition</h3>
            <div className="space-y-3">
              {mod.expositionPassages.map((p, i) => (
                <blockquote key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                  <div className="flex items-baseline gap-2 mb-1.5 text-xs">
                    <span className="mono text-[var(--accent)]">Episode {p.episode}</span>
                    <span className="text-[var(--muted)]">{eMap.get(p.episode)?.title}</span>
                  </div>
                  <p className="prose-reader text-[15px] italic">&ldquo;{p.phrase}&rdquo;</p>
                  {p.note && <p className="text-xs text-[var(--muted)] mt-2 italic">{p.note}</p>}
                </blockquote>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Socratic prompts</h3>
            <div className="space-y-3">
              {mod.socraticSeeds.map((s, i) => (
                <div key={i} className="border-l-2 border-[var(--accent)] pl-4 py-1">
                  <p className="serif text-[17px] italic text-[var(--ink)]">{s.prompt}</p>
                  {s.expectedThemes && s.expectedThemes.length > 0 && (
                    <details className="mt-1.5 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer hover:text-[var(--ink)]">expected themes</summary>
                      <ul className="mt-1 ml-3 space-y-0.5">
                        {s.expectedThemes.map((t, j) => (
                          <li key={j}>, {t}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </section>

          {mod.misconceptionBranches.length > 0 && (
            <section className="mt-10">
              <h3 className="text-xs uppercase tracking-wider text-[var(--muted)] mb-3">Common misreadings</h3>
              <div className="space-y-3">
                {mod.misconceptionBranches.map((b, i) => (
                  <div key={i} className="rounded-lg bg-[var(--elev)] p-4">
                    <p className="text-sm text-[var(--ink-soft)]"><strong className="text-[var(--ink)]">If:</strong> {b.misconception}</p>
                    <p className="text-sm text-[var(--ink-soft)] mt-2"><strong className="text-[var(--accent)]">Then:</strong> {b.correction}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10 rounded-lg border-2 border-[var(--accent)] bg-[var(--elev)] p-5">
            <h3 className="text-xs uppercase tracking-wider text-[var(--accent)] mb-2">Check for understanding</h3>
            <p className="serif text-[17px] italic text-[var(--ink)]">{mod.checkForUnderstanding.prompt}</p>
            {mod.checkForUnderstanding.expectedThemes && mod.checkForUnderstanding.expectedThemes.length > 0 && (
              <details className="mt-2 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer hover:text-[var(--ink)]">a good answer touches on…</summary>
                <ul className="mt-1 ml-3 space-y-0.5">
                  {mod.checkForUnderstanding.expectedThemes.map((t, i) => (
                    <li key={i}>, {t}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="mt-10 flex items-center gap-3">
            {activeModule > 0 && (
              <button
                onClick={() => setActiveModule(activeModule - 1)}
                className="px-3 py-1.5 rounded-md text-sm text-[var(--ink-soft)] hover:bg-[var(--elev)]"
              >
                ← Prev module
              </button>
            )}
            {activeModule < course.modules.length - 1 && (
              <button
                onClick={() => setActiveModule(activeModule + 1)}
                className="ml-auto px-4 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
              >
                Next module: {course.modules[activeModule + 1].title} →
              </button>
            )}
            {activeModule === course.modules.length - 1 && (
              <Link
                href={concept ? `/concept/${concept.id}` : "/"}
                className="ml-auto px-4 py-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--accent)] transition-colors"
              >
                Finish → back to concept
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
