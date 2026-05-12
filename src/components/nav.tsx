import Link from "next/link";

const links = [
  { href: "/courses", label: "Courses" },
  { href: "/dialogue", label: "Dialogue" },
  { href: "/ask", label: "Ask" },
  { href: "/graph", label: "Graph" },
  { href: "/episodes", label: "Episodes" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="serif text-xl tracking-tight text-[var(--ink)] hover:text-[var(--accent)] transition-colors">
          Awakening <span className="text-[var(--gold)]">Atlas</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-2 sm:px-3 py-1.5 rounded-md text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--elev)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
