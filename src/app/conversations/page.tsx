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
      <p className="mono text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-3">Guided Socratic dialogues</p>
      <h1 className="serif text-5xl text-[var(--ink)] leading-tight">Conversations</h1>
      <p className="serif italic text-xl text-[var(--ink-soft)] mt-3 leading-snug">
        Small, focused dialogues that help you understand one of Vervaeke&rsquo;s flagship concepts by thinking it through, not by being told the answer.
      </p>

      <div className="mt-7 grid gap-5 sm:grid-cols-2 text-sm text-[var(--ink-soft)] leading-relaxed">
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">What this is</h2>
          <p>
            Each Conversation is a short, structured exchange built around one concept. The dialogue asks you questions, listens to your answer, then nudges you toward the next idea. You arrive at the insight; you are not handed it. Think of it as a study session with a patient interlocutor, not a lecture.
          </p>
        </div>
        <div>
          <h2 className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">How they were made</h2>
          <p>
            We read all 50 lectures end-to-end with Claude Opus, identified the 28 concepts Vervaeke treats as load-bearing, and for each one drafted a multi-module walkthrough: learning objective, verbatim source passages, Socratic prompts, common misreadings, and a check-for-understanding question. The dialogue is bound to those passages at runtime so it stays inside the text.
          </p>
        </div>
      </div>

      <div className="hr-soft my-10" />

      {!courses && <p className="text-[var(--muted)]">Loading...</p>}

      {courses && courses.length === 0 && (
        <p className="text-[var(--muted)]">No Conversations have been generated yet.</p>
      )}

      {courses && clusterOrder.filter((c) => groupByCluster.has(c)).map((cluster) => (
        <section key={cluster} className="mb-12">
          <h2 className="serif text-2xl text-[var(--ink)] mb-1 capitalize">{cluster.replace("-", " ")}</h2>
          <p className="text-xs text-[var(--muted)] mb-4">
            {groupByCluster.get(cluster)!.length} Conversation{groupByCluster.get(cluster)!.length === 1 ? "" : "s"}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {groupByCluster.get(cluster)!.map((c) => (
              <Link
                key={c.id}
                href={`/conversation/${c.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)] transition-colors group"
              >
                <h3 className="serif text-xl text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors mb-1">
                  {c.title}
                </h3>
                <div className="text-xs text-[var(--muted)] mb-2">
                  {c.moduleCount} module{c.moduleCount === 1 ? "" : "s"}
                </div>
                <p className="text-sm text-[var(--ink-soft)] leading-relaxed line-clamp-3">{c.abstract}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
