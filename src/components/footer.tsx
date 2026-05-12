export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-16">
      <div className="max-w-6xl mx-auto px-6 py-8 text-xs text-[var(--muted)] leading-relaxed">
        <p>
          Transcripts sourced from{" "}
          <a className="lnk" href="https://www.meaningcrisis.co/all-transcripts/" target="_blank" rel="noreferrer">
            meaningcrisis.co
          </a>
          . Lectures and ideas are the work of John Vervaeke. This is an unaffiliated educational tool.
        </p>
        <p className="mt-2">
          The dialogue agent in this app is an AI assistant. It is <em>not</em> John Vervaeke, does not speak as him, and does
          not represent his views.
        </p>
      </div>
    </footer>
  );
}
