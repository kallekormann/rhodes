import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";
import {
  citationPreviewInput,
  knowledgeSourcePreviewUrl,
  openKnowledgeSourcePreview,
} from "@/lib/library/preview";
import "./CitationBlockView.css";

export function CitationBlockView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const excerptRef = useRef<HTMLDivElement>(null);
  const preview = citationPreviewInput(node.attrs);
  const sourceTitle = String(node.attrs.sourceTitle ?? "").trim() || "Source";
  const locationLabel = String(node.attrs.locationLabel ?? "").trim();
  const page =
    typeof node.attrs.page === "number" ? node.attrs.page : null;
  const chipLabel = locationLabel
    ? `${sourceTitle} · ${locationLabel}`
    : page != null
      ? `${sourceTitle} · p.${page}`
      : sourceTitle;
  const previewUrl = preview ? knowledgeSourcePreviewUrl(preview) : null;

  useEffect(() => {
    const excerpt = excerptRef.current;
    if (!excerpt) return;

    const excerptText = String(node.attrs.excerpt ?? "");
    if (excerpt.textContent !== excerptText) excerpt.textContent = excerptText;
  }, [node.attrs.excerpt]);

  return (
    <NodeViewWrapper
      as="blockquote"
      className="editor-citation"
      data-type="citation"
      contentEditable={false}
    >
      {previewUrl ? (
        <a
          href={previewUrl}
          className="editor-citation__chip editor-citation__chip--link"
          target="_blank"
          rel="noopener noreferrer"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            if (preview) openKnowledgeSourcePreview(preview);
          }}
        >
          {chipLabel}
        </a>
      ) : (
        <div className="editor-citation__chip">{chipLabel}</div>
      )}
      <div
        ref={excerptRef}
        className="editor-citation__excerpt"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Citation excerpt…"
        onMouseDown={(event) => event.stopPropagation()}
        onInput={(event) =>
          updateAttributes({
            excerpt: event.currentTarget.textContent ?? "",
          })
        }
      />
    </NodeViewWrapper>
  );
}
