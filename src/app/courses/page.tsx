"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCourses, getConcepts } from "@/lib/data";
import type { CourseSummary, Concept } from "@/lib/types";

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [concepts, setConcepts] = useState<Concept[] | null>(null);

  useEffect(() => {
    Promise.all([getCourses(), getConcepts()]).then(([cs, ks]) => {
      setCourses(cs); setConcepts(ks);
    });
  }, []);

  const cMap = new Map(concepts?.map((c) => [c.id, c]) ?? []);
  const groupByCluster = new Map<string, CourseSummary[]>();
  for (const c of courses ?? []) {
    const concept = cMap.get(c.conceptId);
    const cluster = concept?.cluster ?? "other";
    if (!groupByCluster.has(cluster)) groupByCluster.set(cluster, []);
    groupByCluster.get(cluster)!.push(c);
  }
  const clusterOrder = ["historical", "cognitive-science", "methodological", "normative", "practical", "other"];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 w-full">
      <p className="ep-num text-xs uppercase tracking-[0.22em] mb-3">Pre-curated Socratic mini-courses</p>
      <h1 className="serif text-5xl text-[var(--ink)] leading-tight">Courses</h1>
      <p className="serif italic text-xl text-[var(--ink-soft)] mt-3 leading-snug">
        Hand-grounded mini-courses on the flagship concepts of Vervaeke&rsquo;s argument. Each one is built from verbatim
        transcript passages, with sub-modules that walk you through the idea via Socratic dialogue.
      </p>

      <div className="hr-soft my-10" />

      {!courses && <p className="text-[var(--muted)]">Loading…</p>}

      {courses && courses.length === 0 && (
        <p className="text-[var(--muted)]">
          No courses have been generated yet. Run Pass 5 to produce them.
        </p>
      )}

      {courses && clusterOrder.filter((c) => groupByCluster.has(c)).map((cluster) => (
        <section key={cluster} className="mb-12">
          <h2 className="serif text-2xl text-[var(--ink)] mb-1 capitalize">{cluster.replace("-", " ")}</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            {groupByCluster.get(cluster)!.length} course{groupByCluster.get(cluster)!.length === 1 ? "" : "s"}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {groupByCluster.get(cluster)!.map((c) => {
              const concept = cMap.get(c.conceptId);
              return (
                <Link
                  key={c.id}
                  href={`/course/${c.id}`}
                  className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)] transition-colors group"
                >
                  <h3 className="serif text-xl text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors mb-1">
                    {c.title}
                  </h3>
                  {concept && (
                    <div className="text-xs text-[var(--muted)] mb-2">
                      {c.moduleCount} module{c.moduleCount === 1 ? "" : "s"} · depth {concept.depth}
                    </div>
                  )}
                  <p className="text-sm text-[var(--ink-soft)] leading-relaxed line-clamp-3">{c.abstract}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
