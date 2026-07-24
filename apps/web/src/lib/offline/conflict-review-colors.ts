import { avatarHueForUser } from "@/lib/profile/avatar";

/** Cursor / avatar hue — matches useYjsCollaboration collaborationUser.color. */
export function collaborationColorForUser(userId: string | undefined): string {
  return `hsl(${avatarHueForUser(userId)} 62% 46%)`;
}

export function collaborationColorMutedForUser(userId: string | undefined): string {
  return `hsl(${avatarHueForUser(userId)} 62% 46% / 0.22)`;
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
};

export function conflictReviewColors(params: {
  localUserId?: string;
  peerUserId?: string;
}): ConflictReviewColors {
  const mineHue = avatarHueForUser(params.localUserId);
  const peerHue = avatarHueForUser(params.peerUserId ?? "peer-offline");
  return {
    mine: `hsl(${mineHue} 62% 46%)`,
    mineMuted: `hsl(${mineHue} 62% 46% / 0.2)`,
    mineStrong: `hsl(${mineHue} 62% 38%)`,
    peer: `hsl(${peerHue} 62% 46%)`,
    peerMuted: `hsl(${peerHue} 62% 46% / 0.18)`,
  };
}
