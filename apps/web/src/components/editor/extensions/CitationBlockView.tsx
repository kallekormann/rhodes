import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useRef } from "react";
import "./CitationBlockView.css";

export function CitationBlockView({
  node,
  updateAttributes,
}: NodeViewProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const excerptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    const excerpt = excerptRef.current;
    if (!title || !excerpt) return;

    const titleText = String(node.attrs.sourceTitle ?? "");
    const excerptText = String(node.attrs.excerpt ?? "");

    if (title.textContent !== titleText) title.textContent = titleText;
    if (excerpt.textContent !== excerptText) excerpt.textContent = excerptText;
  }, [node.attrs.sourceTitle, node.attrs.excerpt]);

  return (
    <NodeViewWrapper
      as="blockquote"
      className="editor-citation"
      data-type="citation"
      contentEditable={false}
    >
      <div
        ref={titleRef}
        className="editor-citation__chip"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Library source"
        onMouseDown={(event) => event.stopPropagation()}
        onInput={(event) =>
          updateAttributes({
            sourceTitle: event.currentTarget.textContent ?? "",
          })
        }
      />
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
