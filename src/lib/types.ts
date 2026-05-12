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

export interface ConceptSummary {
  ep: number;
  text: string;
}

export interface Concept {
  name: string;
  count: number;
  episodes: number[];
  treatments: Record<string, number>;
  summaries: ConceptSummary[];
}

export interface Person {
  name: string;
  count: number;
  episodes: number[];
  roles: Record<string, number>;
  summaries: ConceptSummary[];
}

export interface GraphNode {
  id: string;
  kind: "episode" | "concept" | "person";
  label: string;
  num?: number;
  count?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: string;
  label?: string;
}

export interface Graph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Passage {
  id: string;
  episode: number;
  episodeTitle: string;
  episodeSlug: string;
  seq: number;
  text: string;
  words: number;
  wordStart: number;
  wordEnd: number;
}

export interface Quote {
  id: string;
  episode: number;
  episodeTitle: string;
  episodeSlug: string;
  quote: string;
  context: string;
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
