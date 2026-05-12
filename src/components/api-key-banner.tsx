"use client";

import Link from "next/link";
import { useSettings } from "@/lib/store";
import { useEffect, useState } from "react";

export function ApiKeyBanner({ requiredFor }: { requiredFor: string }) {
  const hasKey = useSettings((s) => s.hasKey());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (hasKey) return null;
  return (
    <div className="mx-auto max-w-3xl my-4 px-4 py-3 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-tint)] text-sm text-[var(--ink-soft)] flex items-center justify-between gap-4">
      <p>
        <strong className="text-[var(--ink)] font-medium">An API key is needed</strong> for {requiredFor}. Your key
        stays in your browser only.
      </p>
      <Link
        href="/settings"
        className="shrink-0 px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-bright)] transition-colors"
      >
        Add key
      </Link>
    </div>
  );
}
