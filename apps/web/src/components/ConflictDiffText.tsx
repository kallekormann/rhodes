"use client";

import { diffWords, type TextDiffSegment } from "@/lib/documents/text-diff";
import "./ConflictDiffText.css";

type ConflictDiffTextProps = {
  baseText: string;
  text: string;
  variant: "mine" | "theirs";
};

function DiffSegments({ segments }: { segments: TextDiffSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "equal") {
          return <span key={index}>{segment.text}</span>;
        }
        if (segment.type === "add") {
          return (
            <mark key={index} className="conflict-diff__add">
              {segment.text}
            </mark>
          );
        }
        return (
          <del key={index} className="conflict-diff__del">
            {segment.text}
          </del>
        );
      })}
    </>
  );
}

export function ConflictDiffText({ baseText, text, variant }: ConflictDiffTextProps) {
  const segments = diffWords(baseText, text);

  return (
    <p
      className={`conflict-diff conflict-diff--${variant}`}
      data-variant={variant}
    >
      <DiffSegments segments={segments} />
    </p>
  );
}
