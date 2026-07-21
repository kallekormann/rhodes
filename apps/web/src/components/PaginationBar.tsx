"use client";

import { Button } from "./Button";
import "./PaginationBar.css";

type PaginationBarProps = {
  offset: number;
  limit: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

export function PaginationBar({
  offset,
  limit,
  total,
  onPrevious,
  onNext,
  className = "",
}: PaginationBarProps) {
  if (total <= limit) return null;

  const start = Math.min(offset + 1, total);
  const end = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className={`pagination-bar ${className}`.trim()}>
      <Button
        type="button"
        variant="secondary"
        size="small"
        disabled={!canPrev}
        onClick={onPrevious}
      >
        Previous
      </Button>
      <p className="caption pagination-bar__status">
        Showing {start}–{end} of {total}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="small"
        disabled={!canNext}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}
