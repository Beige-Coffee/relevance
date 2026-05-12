"use client";

import type { Episode, Concept, Person, Passage, Quote, Graph, CourseSummary, Course } from "./types";

export type TranscriptIndex = Record<number, { title: string; body: string }>;

type Cache = Partial<{
  episodes: Episode[];
  concepts: Concept[];
  people: Person[];
  passages: Passage[];
  quotes: Quote[];
  graph: Graph;
  courses: CourseSummary[];
  transcripts: TranscriptIndex;
}>;

const cache: Cache = {};
const courseCache = new Map<string, Course>();

async function load<K extends keyof Cache, T>(key: K, url: string): Promise<T> {
  if (cache[key] !== undefined) return cache[key] as T;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const data = (await res.json()) as T;
  (cache as Record<string, unknown>)[key] = data;
  return data;
}

export const getEpisodes = () => load<"episodes", Episode[]>("episodes", "/data/episodes.json");
export const getConcepts = () => load<"concepts", Concept[]>("concepts", "/data/concepts.json");
export const getPeople = () => load<"people", Person[]>("people", "/data/people.json");
export const getPassages = () => load<"passages", Passage[]>("passages", "/data/passages.json");
export const getQuotes = () => load<"quotes", Quote[]>("quotes", "/data/quotes.json");
export const getGraph = () => load<"graph", Graph>("graph", "/data/graph.json");
export const getCourses = () => load<"courses", CourseSummary[]>("courses", "/data/courses.json");
export const getTranscripts = () => load<"transcripts", TranscriptIndex>("transcripts", "/data/transcripts.json");

export async function getCourse(id: string): Promise<Course> {
  if (courseCache.has(id)) return courseCache.get(id)!;
  const res = await fetch(`/data/courses/${id}.json`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Course ${id} not found`);
  const c = (await res.json()) as Course;
  courseCache.set(id, c);
  return c;
}
