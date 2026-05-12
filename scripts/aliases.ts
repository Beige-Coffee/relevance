// Small alias table to canonicalize agent-extracted concept names that drifted.
// Map: variant -> canonical. Only obvious / safe merges. Conservative on purpose.
export const CONCEPT_ALIASES: Record<string, string> = {
  "idos": "eidos",
  "realization": "relevance realization",
  "mindfulness revolution": "mindfulness",
  "altered states of consciousness": "altered states",
  "higher states of consciousness": "higher states",
  "pure consciousness event": "higher states",
  "4e cognition": "4E cognition",
  "4E cognitive science": "4E cognition",
  "two-worlds mythology": "two worlds mythology",
  "self transcendence": "self-transcendence",
  "the sacred": "sacredness",
  "general intelligence": "intelligence",
  "logos": "logos",
};

export const PERSON_ALIASES: Record<string, string> = {
  "Siddhartha Gautama": "the Buddha",
  "Buddha": "the Buddha",
  "Gautama": "the Buddha",
  "Jesus of Nazareth": "Jesus",
  "Christ": "Jesus",
  "the apostle Paul": "Paul (Apostle)",
  "St. Paul": "Paul (Apostle)",
  "Apostle Paul": "Paul (Apostle)",
  "Saint Augustine": "Augustine",
  "St. Augustine": "Augustine",
  "Thomas Aquinas": "Aquinas",
  "St. Thomas Aquinas": "Aquinas",
  "Immanuel Kant": "Kant",
  "Friedrich Nietzsche": "Nietzsche",
  "Carl Jung": "Carl Jung",
  "C.G. Jung": "Carl Jung",
  "Jung": "Carl Jung",
  "Martin Heidegger": "Heidegger",
  "Henry Corbin": "Henry Corbin",
  "Corbin": "Henry Corbin",
  "Paul Tillich": "Paul Tillich",
  "Tillich": "Paul Tillich",
  "Owen Barfield": "Owen Barfield",
  "Barfield": "Owen Barfield",
  "Meister Eckhart": "Meister Eckhart",
  "Eckhart": "Meister Eckhart",
  "Iain McGilchrist": "Iain McGilchrist",
  "McGilchrist": "Iain McGilchrist",
  "Michael Polanyi": "Michael Polanyi",
  "Polanyi": "Michael Polanyi",
  "Mihaly Csikszentmihalyi": "Csikszentmihalyi",
  "Karl Friston": "Karl Friston",
  "Friston": "Karl Friston",
  "Marcus Aurelius": "Marcus Aurelius",
  "L. A. Paul": "L.A. Paul",
  "LA Paul": "L.A. Paul",
  "Charles Taylor": "Charles Taylor",
  "Agnes Callard": "Agnes Callard",
  "Robert Sternberg": "Robert Sternberg",
  "Keith Stanovich": "Keith Stanovich",
  "Harry Frankfurt": "Harry Frankfurt",
  "Hubert Dreyfus": "Hubert Dreyfus",
  "Herbert Simon": "Herbert Simon",
  "Erich Fromm": "Erich Fromm",
  "Fromm": "Erich Fromm",
};

export function canonicalConcept(name: string): string {
  const key = name.trim().toLowerCase();
  return CONCEPT_ALIASES[key] ?? key;
}

export function canonicalPerson(name: string): string {
  const key = name.trim();
  return PERSON_ALIASES[key] ?? key;
}
