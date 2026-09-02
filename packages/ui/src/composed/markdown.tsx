"use client";

import { lazy, Suspense } from "react";
import type { Components } from "react-markdown";

export interface MarkdownProps {
  children: string;
  components?: Components;
  rich?: boolean;
}

// Basic Markdown covers common prose. Math and syntax highlighting stay in a
// separate chunk and are requested only when the content needs them.
const MarkdownImpl = lazy(() => import("./markdown-impl"));
const RichMarkdownImpl = lazy(() => import("./rich-markdown-impl"));

function MarkdownPlaceholder({ content }: { content: string }) {
  const lineCount = Math.min(
    6,
    Math.max(
      1,
      content
        .split("\n")
        .reduce(
          (total, line) => total + Math.max(1, Math.ceil(line.length / 80)),
          0
        )
    )
  );

  return (
    <div
      aria-hidden="true"
      className="space-y-2 py-1"
      data-slot="markdown-placeholder"
    >
      {Array.from({ length: lineCount }, (_, index) => (
        <span
          className="block h-4 rounded bg-muted/60 motion-safe:animate-pulse"
          key={index}
          style={{ width: index === lineCount - 1 ? "72%" : "100%" }}
        />
      ))}
    </div>
  );
}

function requiresRichRendering(content: string) {
  const hasFencedCode = /(^|\n)\s*(```|~~~)/.test(content);
  const hasBlockMath = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]/.test(content);
  const hasInlineMath = /(^|[^\\])\$[^$\n]+\$(?!\$)/m.test(content);
  return hasFencedCode || hasBlockMath || hasInlineMath;
}

export function Markdown({ rich, ...props }: MarkdownProps) {
  const Impl =
    rich || requiresRichRendering(props.children)
      ? RichMarkdownImpl
      : MarkdownImpl;

  return (
    <Suspense fallback={<MarkdownPlaceholder content={props.children} />}>
      <Impl {...props} />
    </Suspense>
  );
}
