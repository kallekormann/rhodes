"use client";

import type { ReviewSegment, ReviewSegmentRole } from "@/lib/offline/base-aligned-review";
import type { ConflictReviewColors } from "@/lib/offline/conflict-review-colors";
import { peerColorsForUser } from "@/lib/offline/conflict-review-colors";
import "./ConflictReviewText.css";

type ConflictReviewTextProps = {
  segments: ReviewSegment[];
  variant: "mine" | "peer";
  colors: ConflictReviewColors;
  activeClusterId?: string | null;
  peerUserId?: string;
};

function roleClass(role: ReviewSegmentRole): string {
  switch (role) {
    case "context":
      return "conflict-review__context";
    case "mine_add":
      return "conflict-review__mine-add";
    case "mine_del":
      return "conflict-review__mine-del";
    case "peer_add":
      return "conflict-review__peer-add";
    case "peer_del":
      return "conflict-review__peer-del";
    default:
      return "conflict-review__context";
  }
}

export function ConflictReviewText({
  segments,
  variant,
  colors,
  activeClusterId = null,
  peerUserId,
}: ConflictReviewTextProps) {
  const peerPalette = peerColorsForUser(colors, peerUserId);

  return (
    <p
      className={`conflict-review conflict-review--${variant}`}
      data-variant={variant}
      style={
        {
          "--conflict-mine": colors.mine,
          "--conflict-mine-muted": colors.mineMuted,
          "--conflict-mine-strong": colors.mineStrong,
          "--conflict-peer": peerPalette.color,
          "--conflict-peer-muted": peerPalette.muted,
        } as React.CSSProperties
      }
    >
      {segments.map((segment) => {
        const segmentPeer = peerColorsForUser(colors, segment.peerUserId ?? peerUserId);
        const active = segment.clusterId === activeClusterId;
        const className = [
          roleClass(segment.role),
          segment.clickable ? "conflict-review__clickable" : "",
          active ? "conflict-review__segment--active" : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (segment.role === "mine_del" || segment.role === "peer_del") {
          return (
            <del
              key={segment.id}
              className={className}
              data-cluster-id={segment.clusterId}
              style={
                segment.role.startsWith("peer")
                  ? ({ "--conflict-peer": segmentPeer.color, "--conflict-peer-muted": segmentPeer.muted } as React.CSSProperties)
                  : undefined
              }
            >
              {segment.text}
            </del>
          );
        }

        if (segment.role === "mine_add" || segment.role === "peer_add") {
          return (
            <mark
              key={segment.id}
              className={className}
              data-cluster-id={segment.clusterId}
              style={
                segment.role.startsWith("peer")
                  ? ({ "--conflict-peer-muted": segmentPeer.muted } as React.CSSProperties)
                  : undefined
              }
            >
              {segment.text}
            </mark>
          );
        }

        return (
          <span key={segment.id} className={className}>
            {segment.text}
          </span>
        );
      })}
    </p>
  );
}
