"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/conversations", label: "Conversations" },
  { href: "/episodes", label: "Episodes" },
  { href: "/about", label: "About" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--border-soft)] bg-[var(--bg)]/85 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl lowercase tracking-tight text-[var(--accent)] hover:opacity-80 transition-opacity">
          relevance
        </Link>
        <nav className="flex items-center gap-1 sm:gap-1.5 text-sm">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md transition-colors ${
                  active ? "text-[var(--accent)] bg-[var(--accent-tint)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--elev)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
