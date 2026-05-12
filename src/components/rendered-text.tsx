"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chunkText } from "@/lib/citations";
import { CitationPill } from "./citation-pill";
import type { ReactNode } from "react";

// Inject citation pills into Markdown leaf text nodes.
function decorate(text: string): ReactNode {
  const chunks = chunkText(text);
  return chunks.map((c, i) =>
    c.kind === "text" ? (
      <span key={i}>{c.text}</span>
    ) : (
      <CitationPill key={i} episodes={c.episodes} />
    )
  );
}

export function RenderedText({ text }: { text: string }) {
  return (
    <div className="prose-reader max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{wrapStrings(children)}</p>,
          li: ({ children }) => <li>{wrapStrings(children)}</li>,
          strong: ({ children }) => <strong className="text-[var(--ink)] font-medium">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          h2: ({ children }) => <h2 className="serif text-xl text-[var(--ink)] mt-6 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="serif text-lg text-[var(--ink)] mt-4 mb-2">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          code: ({ children }) => (
            <code className="mono text-[0.85em] bg-[var(--elev)] px-1 py-0.5 rounded">{children}</code>
          ),
          a: ({ children, href }) => (
            <a className="lnk" href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function wrapStrings(children: ReactNode): ReactNode {
  // ReactMarkdown gives us mixed children — we only decorate plain string leaves.
  if (Array.isArray(children)) {
    return children.map((c, i) => (typeof c === "string" ? <span key={i}>{decorate(c)}</span> : c));
  }
  if (typeof children === "string") return decorate(children);
  return children;
}
