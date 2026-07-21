"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u"],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ["target"], ["rel"]],
  },
};

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  u: ({ children }) => <u>{children}</u>,
};

type AskMarkdownProps = {
  content: string;
};

/** Sanitized GFM markdown for Rhodes Ask replies. */
export function AskMarkdown({ content }: AskMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeSanitize, schema]]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
