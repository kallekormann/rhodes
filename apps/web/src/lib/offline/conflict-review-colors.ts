import { avatarHueForUser } from "@/lib/profile/avatar";

/** Cursor / avatar hue — matches useYjsCollaboration collaborationUser.color. */
export function collaborationColorForUser(userId: string | undefined): string {
  return `hsl(${avatarHueForUser(userId)} 62% 46%)`;
}

export function collaborationColorMutedForUser(userId: string | undefined): string {
  return `hsl(${avatarHueForUser(userId)} 62% 46% / 0.38)`;
}

export function collaborationColorStrongForUser(userId: string | undefined): string {
  return `hsl(${avatarHueForUser(userId)} 62% 38%)`;
}

export type ConflictReviewColors = {
  mine: string;
  mineMuted: string;
  mineStrong: string;
  peer: string;
  peerMuted: string;
  peerByUserId: Record<string, { color: string; muted: string; strong: string }>;
};

export function conflictReviewColors(params: {
  localUserId?: string;
  peerUserIds?: string[];
}): ConflictReviewColors {
  const mineHue = avatarHueForUser(params.localUserId);
  const peerIds = params.peerUserIds?.length
    ? params.peerUserIds
    : ["peer-offline"];

  const peerByUserId: ConflictReviewColors["peerByUserId"] = {};
  for (const peerUserId of peerIds) {
    const hue = avatarHueForUser(peerUserId);
    peerByUserId[peerUserId] = {
      color: `hsl(${hue} 62% 46%)`,
      muted: `hsl(${hue} 62% 46% / 0.34)`,
      strong: `hsl(${hue} 62% 38%)`,
    };
  }

  const primaryPeer = peerIds[0];

  return {
    mine: `hsl(${mineHue} 62% 46%)`,
    mineMuted: `hsl(${mineHue} 62% 46% / 0.38)`,
    mineStrong: `hsl(${mineHue} 62% 38%)`,
    peer: collaborationColorForUser(primaryPeer),
    peerMuted: collaborationColorMutedForUser(primaryPeer),
    peerByUserId,
  };
}

export function peerColorsForUser(
  colors: ConflictReviewColors,
  peerUserId?: string,
): { color: string; muted: string; strong: string } {
  if (peerUserId && colors.peerByUserId[peerUserId]) {
    return colors.peerByUserId[peerUserId];
  }
  return {
    color: colors.peer,
    muted: colors.peerMuted,
    strong: colors.mineStrong,
  };
}
