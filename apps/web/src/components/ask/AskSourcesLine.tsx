"use client";

import "./AskSourcesLine.css";

export type AskSourceUsed = {
  title: string;
  location_label?: string;
  origin_type?: string;
};

type AskSourcesLineProps = {
  sources: AskSourceUsed[];
};

export function AskSourcesLine({ sources }: AskSourcesLineProps) {
  if (sources.length === 0) return null;

  return (
    <p className="ask-sources-line" aria-label="Sources used">
      <span className="ask-sources-line__prefix">Sources:</span>{" "}
      {sources.map((source, index) => {
        const detail = source.location_label
          ? `${source.title} (${source.location_label})`
          : source.title;
        return (
          <span key={`${source.title}-${index}`}>
            {index > 0 ? " · " : ""}
            {detail}
          </span>
        );
      })}
    </p>
  );
}
