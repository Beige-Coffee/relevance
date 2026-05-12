// Canonical types matching the v2 registry shape.

export interface Episode {
  num: number;
  slug: string;
  title: string;
  url: string;
  words: number;
  essence: string;
  keyClaims: string[];
  conceptCount: number;
  peopleCount: number;
}

export interface SubConcept {
  id: string;
  name: string;
  summary: string;
  passages: { episode: number; phrase: string }[];
}
export interface KeyPassage { episode: number; phrase: string; role: string; }

export interface Concept {
  id: string;
  canonicalName: string;
  aliases?: string[];
  definition: string;
  sourcePassage: { episode: number; quote: string };
  depth: number;
  cluster: "cognitive-science" | "historical" | "normative" | "practical" | "methodological";
  introducedIn: number;
  developedIn: number[];
  appliedIn: number[];
  prerequisites: string[];
  relatedConcepts: string[];
  contrastedWith?: string[];
  associatedPeople: string[];
  isFlagship: boolean;
  notes?: string | null;
  subConcepts?: SubConcept[];
  commonConfusions?: string[];
  keyPassages?: KeyPassage[];
}

export interface Person {
  id: string;
  canonicalName: string;
  aliases?: string[];
  shortBio: string;
  roleInArgument: string;
  introducedIn: number;
  discussedIn: number[];
  associatedConcepts: string[];
  keyClaimsAbout: string[];
  notes?: string | null;
}

export interface GraphNode {
  id: string;
  kind: "episode" | "concept" | "person";
  label: string;
  num?: number;
  flagship?: boolean;
  cluster?: string;
  count?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: string;
  label?: string;
  weight?: number;
}

export interface Graph { nodes: GraphNode[]; links: GraphLink[]; }

export interface Passage {
  id: string; episode: number; episodeTitle: string; episodeSlug: string;
  seq: number; text: string; words: number; wordStart: number; wordEnd: number;
}

export interface Quote {
  id: string; episode: number; episodeTitle: string; episodeSlug: string;
  quote: string; context: string;
}

export interface Module {
  id: string;
  title: string;
  subConceptId: string | null;
  learningObjective: string;
  expositionPassages: { episode: number; phrase: string; note?: string }[];
  socraticSeeds: { prompt: string; expectedThemes: string[] }[];
  misconceptionBranches: { misconception: string; correction: string }[];
  checkForUnderstanding: { prompt: string; expectedThemes: string[] };
}

export interface Course {
  id: string;
  title: string;
  conceptId: string;
  abstract: string;
  prerequisites: string[];
  modules: Module[];
}

export interface CourseSummary {
  id: string; title: string; conceptId: string;
  abstract: string; moduleCount: number; prerequisites: string[];
}

export interface Citation {
  passageId: string;
  episode: number;
  episodeTitle: string;
  excerpt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  createdAt: number;
}
