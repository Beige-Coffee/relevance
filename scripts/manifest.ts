// Canonical list of all 51 transcripts (intro + 50 episodes) from meaningcrisis.co.
// Numbering: 0 = intro, 1-50 = main episodes.

export interface EpisodeRef {
  num: number;
  slug: string;
  title: string;
  url: string;
}

export const EPISODES: EpisodeRef[] = [
  { num: 0, slug: "intro", title: "What is the Awakening from the Meaning Crisis Series", url: "https://www.meaningcrisis.co/the-introduction-to-the-meaning-crisis-series/" },
  { num: 1, slug: "introduction", title: "Introduction", url: "https://www.meaningcrisis.co/episode-1-introduction/" },
  { num: 2, slug: "flow-metaphor-axial-revolution", title: "Flow, Metaphor, and the Axial Revolution", url: "https://www.meaningcrisis.co/episode-2-flow-metaphor-and-the-axial-revolution/" },
  { num: 3, slug: "continuous-cosmos-modern-world-grammar", title: "Continuous Cosmos and Modern World Grammar", url: "https://www.meaningcrisis.co/episode-3-continuous-cosmos-and-modern-world-grammar/" },
  { num: 4, slug: "socrates-quest-for-wisdom", title: "Socrates and the Quest for Wisdom", url: "https://www.meaningcrisis.co/episode-4-socrates-and-the-quest-for-wisdom/" },
  { num: 5, slug: "plato-and-the-cave", title: "Plato and the Cave", url: "https://www.meaningcrisis.co/episode-5-plato-and-the-cave/" },
  { num: 6, slug: "aristotle-kant-evolution", title: "Aristotle, Kant, and Evolution", url: "https://www.meaningcrisis.co/episode-6-aristotle-kant-and-evolution/" },
  { num: 7, slug: "aristotles-worldview-erich-fromm", title: "Aristotle's World View and Erich Fromm", url: "https://www.meaningcrisis.co/episode-7-aristotles-world-view-and-erich-fromm/" },
  { num: 8, slug: "buddha-and-mindfulness", title: "The Buddha and Mindfulness", url: "https://www.meaningcrisis.co/episode-8-the-buddha-and-mindfulness/" },
  { num: 9, slug: "insight", title: "Insight", url: "https://www.meaningcrisis.co/episode-9-insight/" },
  { num: 10, slug: "consciousness", title: "Consciousness", url: "https://www.meaningcrisis.co/episode-10-consciousness/" },
  { num: 11, slug: "higher-states-of-consciousness-part-1", title: "Higher States of Consciousness, Part 1", url: "https://www.meaningcrisis.co/higher-states-of-consciousness-part-1/" },
  { num: 12, slug: "higher-states-of-consciousness-part-2", title: "Higher States of Consciousness, Part 2", url: "https://www.meaningcrisis.co/ep-12-awakening-from-the-meaning-crisis-higher-states-of-consciousness-part-2-2/" },
  { num: 13, slug: "buddhism-parasitic-processing", title: "Buddhism and Parasitic Processing", url: "https://www.meaningcrisis.co/ep-13-awakening-from-the-meaning-crisis-buddhism-and-parasitic-processing/" },
  { num: 14, slug: "epicureans-cynics-stoics", title: "Epicureans, Cynics, and Stoics", url: "https://www.meaningcrisis.co/ep-14-awakening-from-the-meaning-crisis-epicureans-cynics-and-stoics/" },
  { num: 15, slug: "marcus-aurelius-and-jesus", title: "Marcus Aurelius and Jesus", url: "https://www.meaningcrisis.co/ep-15-awakening-from-the-meaning-crisis-marcus-aurelius-and-jesus/" },
  { num: 16, slug: "christianity-and-agape", title: "Christianity and Agape", url: "https://www.meaningcrisis.co/ep-16-awakening-from-the-meaning-crisis-christianity-and-agape/" },
  { num: 17, slug: "gnosis-existential-inertia", title: "Gnosis and Existential Inertia", url: "https://www.meaningcrisis.co/ep-17-awakening-from-the-meaning-crisis-gnosis-and-existential-inertia/" },
  { num: 18, slug: "plotinus-neoplatonism", title: "Plotinus and Neoplatonism", url: "https://www.meaningcrisis.co/ep-18-awakening-from-the-meaning-crisis-plotinus-and-neoplatonism/" },
  { num: 19, slug: "augustine-aquinas", title: "Augustine and Aquinas", url: "https://www.meaningcrisis.co/ep-19-awakening-from-the-meaning-crisis-augustine-and-aquin/" },
  { num: 20, slug: "death-of-the-universe", title: "Death of the Universe", url: "https://www.meaningcrisis.co/ep-20-awakening-from-the-meaning-crisis-death-of-the-universe/" },
  { num: 21, slug: "martin-luther-descartes", title: "Martin Luther and Descartes", url: "https://www.meaningcrisis.co/ep-21-awakening-from-the-meaning-crisis-martin-luther-and-descartes/" },
  { num: 22, slug: "descartes-vs-hobbes", title: "Descartes vs. Hobbes", url: "https://www.meaningcrisis.co/ep-22-awakening-from-the-meaning-crisis-descartes-vs-hobbes/" },
  { num: 23, slug: "romanticism", title: "Romanticism", url: "https://www.meaningcrisis.co/ep-23-awakening-from-the-meaning-crisis-romanticism/" },
  { num: 24, slug: "hegel", title: "Hegel", url: "https://www.meaningcrisis.co/ep-24-awakening-from-the-meaning-crisis-hegel/" },
  { num: 25, slug: "the-clash", title: "The Clash", url: "https://www.meaningcrisis.co/ep-25-awakening-from-the-meaning-crisis-the-clash/" },
  { num: 26, slug: "cognitive-science", title: "Cognitive Science", url: "https://www.meaningcrisis.co/ep-26-awakening-from-the-meaning-crisis-cognitive-science/" },
  { num: 27, slug: "problem-formulation", title: "Problem Formulation", url: "https://www.meaningcrisis.co/ep-27-awakening-from-the-meaning-crisis-problem-formulation/" },
  { num: 28, slug: "convergence-relevance-realization", title: "Convergence To Relevance Realization", url: "https://www.meaningcrisis.co/ep-28-awakening-from-the-meaning-crisis-convergence-to-relevance-realization/" },
  { num: 29, slug: "depths-of-relevance-realization", title: "Getting to the Depths of Relevance Realization", url: "https://www.meaningcrisis.co/ep-29-awakening-from-the-meaning-crisis-getting-to-the-depths-of-relevance-realization/" },
  { num: 30, slug: "rr-meets-dynamical-systems", title: "Relevance Realization Meets Dynamical Systems Theory", url: "https://www.meaningcrisis.co/ep-30-awakening-from-the-meaning-crisis-relevance-realization-meets-dynamical-systems-theory/" },
  { num: 31, slug: "embodied-embedded-rr-dynamical-gi", title: "Embodied-Embedded RR as Dynamical-Developmental GI", url: "https://www.meaningcrisis.co/ep-31-awakening-from-the-meaning-crisis-embodied-embedded-rr-as-dynamical-developmental-gi/" },
  { num: 32, slug: "rr-brain-insight-consciousness", title: "RR in the Brain, Insight, and Consciousness", url: "https://www.meaningcrisis.co/ep-32-awakening-from-the-meaning-crisis-rr-in-the-brain-insight-and-consciousness/" },
  { num: 33, slug: "spirituality-of-rr-wonder-awe", title: "The Spirituality of RR: Wonder/Awe/Mystery/Sacredness", url: "https://www.meaningcrisis.co/ep-33-awakening-from-the-meaning-crisis-the-spirituality-of-rr-wonder-awe-mystery-sacredness/" },
  { num: 34, slug: "sacredness-horror-music-symbol", title: "Sacredness: Horror, Music, and the Symbol", url: "https://www.meaningcrisis.co/ep-34-awakening-from-the-meaning-crisis-sacredness-horror-music-and-the-symbol/" },
  { num: 35, slug: "symbol-sacredness-sacred", title: "The Symbol, Sacredness, and the Sacred", url: "https://www.meaningcrisis.co/ep-35-awakening-from-the-meaning-crisis-the-symbol-sacredness-and-the-sacred/" },
  { num: 36, slug: "religio-perennial-problems", title: "Religio/Perennial Problems/Reverse Eng. Enlightenment", url: "https://www.meaningcrisis.co/ep-36-awakening-from-the-meaning-crisis-religio-perennial-problems-reverse-eng-enlightenment/" },
  { num: 37, slug: "reverse-engineering-enlightenment-part-2", title: "Reverse Engineering Enlightenment: Part 2", url: "https://www.meaningcrisis.co/ep-37-awakening-from-the-meaning-crisis-reverse-engineering-enlightenment-part-2/" },
  { num: 38, slug: "agape-4e-cognitive-science", title: "Agape and 4E Cognitive Science", url: "https://www.meaningcrisis.co/ep-38-awakening-from-the-meaning-crisis-agape-and-4e-cognitive-science/" },
  { num: 39, slug: "religion-of-no-religion", title: "The Religion of No Religion", url: "https://www.meaningcrisis.co/ep-39-awakening-from-the-meaning-crisis-the-religion-of-no-religion/" },
  { num: 40, slug: "wisdom-and-rationality", title: "Wisdom and Rationality", url: "https://www.meaningcrisis.co/ep-40-awakening-from-the-meaning-crisis-wisdom-and-rationality/" },
  { num: 41, slug: "what-is-rationality", title: "What is Rationality?", url: "https://www.meaningcrisis.co/ep-41-awakening-from-the-meaning-crisis-what-is-rationality/" },
  { num: 42, slug: "intelligence-rationality-wisdom", title: "Intelligence, Rationality, and Wisdom", url: "https://www.meaningcrisis.co/ep-42-awakening-from-the-meaning-crisis-intelligence-rationality-and-wisdom/" },
  { num: 43, slug: "wisdom-and-virtue", title: "Wisdom and Virtue", url: "https://www.meaningcrisis.co/ep-43-awakening-from-the-meaning-crisis-wisdom-and-virtue/" },
  { num: 44, slug: "theories-of-wisdom", title: "Theories of Wisdom", url: "https://www.meaningcrisis.co/ep-44-awakening-from-the-meaning-crisis-theories-of-wisdom/" },
  { num: 45, slug: "nature-of-wisdom", title: "The Nature of Wisdom", url: "https://www.meaningcrisis.co/ep-45-awakening-from-the-meaning-crisis-the-nature-of-wisdom/" },
  { num: 46, slug: "conclusion-prophets-of-meaning-crisis", title: "Conclusion and the Prophets of the Meaning Crisis", url: "https://www.meaningcrisis.co/ep-46-awakening-from-the-meaning-crisis-conclusion-and-the-prophets-of-the-meaning-crisis/" },
  { num: 47, slug: "heidegger", title: "Heidegger", url: "https://www.meaningcrisis.co/ep-47-awakening-from-the-meaning-crisis-heidegger/" },
  { num: 48, slug: "corbin-divine-double", title: "Corbin and the Divine Double", url: "https://www.meaningcrisis.co/ep-48-awakening-from-the-meaning-crisis-corbin-and-the-divine-double/" },
  { num: 49, slug: "corbin-and-jung", title: "Corbin and Jung", url: "https://www.meaningcrisis.co/ep-49-awakening-from-the-meaning-crisis-corbin-and-jung/" },
  { num: 50, slug: "tillich-and-barfield", title: "Tillich and Barfield", url: "https://www.meaningcrisis.co/ep-50-awakening-from-the-meaning-crisis-tillich-and-barfield/" },
];

export function filenameFor(ep: EpisodeRef): string {
  const padded = String(ep.num).padStart(2, "0");
  return `ep-${padded}-${ep.slug}.md`;
}
