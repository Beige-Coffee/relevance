export function CitationPill({ episodes }: { episodes: number[] }) {
  if (episodes.length === 1) {
    return (
      <a
        href={`/episodes#ep-${episodes[0]}`}
        target="_blank"
        rel="noreferrer"
        className="cite-pill"
        title={`Episode ${episodes[0]} (opens in a new tab)`}
      >
        Ep {episodes[0]}
      </a>
    );
  }
  return (
    <a
      href={`/episodes#ep-${episodes[0]}`}
      target="_blank"
      rel="noreferrer"
      className="cite-pill"
      title={`Episodes ${episodes.join(", ")} (opens in a new tab)`}
    >
      Eps {episodes.join(", ")}
    </a>
  );
}
