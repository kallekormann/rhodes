export const AVATAR_BUCKET = "avatars";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

export function avatarStoragePath(userId: string, ext: string): string {
  return `${userId}/avatar.${ext}`;
}

export function avatarServeUrl(storagePath: string): string {
  return `/app/api/profile/avatar/serve?path=${encodeURIComponent(storagePath)}`;
}

export function resolveAvatarPublicUrl(
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath?.trim()) return null;
  const trimmed = storagePath.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return avatarServeUrl(trimmed);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function avatarHueForUser(userId: string | undefined): number {
  if (!userId) return 210;
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function avatarBackgroundStyle(userId: string | undefined): {
  backgroundColor: string;
  color: string;
} {
  const hue = avatarHueForUser(userId);
  return {
    backgroundColor: `hsl(${hue} 48% 42%)`,
    color: "hsl(0 0% 100%)",
  };
}

export function resolveAvatarImageContentType(file: File): string | null {
  if (file.type.startsWith("image/")) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MIME[ext] ?? null;
}

export function assertAvatarFile(file: File): string | null {
  const contentType = resolveAvatarImageContentType(file);
  if (!contentType) return "Only image files are supported";
  if (file.size > MAX_AVATAR_BYTES) return "Avatar must be under 2MB";
  return null;
}

export function avatarExtensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    default:
      return "png";
  }
}
