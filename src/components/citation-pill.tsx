import Link from "next/link";

export function CitationPill({ episodes }: { episodes: number[] }) {
  if (episodes.length === 1) {
    return (
      <Link href={`/episodes#ep-${episodes[0]}`} className="cite-pill" title={`Episode ${episodes[0]}`}>
        Ep {episodes[0]}
      </Link>
    );
  }
  return (
    <span className="cite-pill" title={`Episodes ${episodes.join(", ")}`}>
      Eps {episodes.join(", ")}
    </span>
  );
}
