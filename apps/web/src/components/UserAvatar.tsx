"use client";

import { useState } from "react";
import {
  avatarBackgroundStyle,
  initialsFromName,
  resolveAvatarPublicUrl,
} from "@/lib/profile/avatar";
import "./UserAvatar.css";

export type UserAvatarSize = "sm" | "md" | "lg";

type UserAvatarProps = {
  name: string;
  userId?: string;
  src?: string | null;
  size?: UserAvatarSize;
  className?: string;
  title?: string;
};

export function UserAvatar({
  name,
  userId,
  src,
  size = "md",
  className = "",
  title,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedSrc = resolveAvatarPublicUrl(src);
  const showImage = Boolean(resolvedSrc) && !imageFailed;
  const initials = initialsFromName(name);
  const style = avatarBackgroundStyle(userId);

  return (
    <span
      className={`user-avatar user-avatar--${size} ${className}`.trim()}
      title={title ?? name}
      aria-hidden={title ? undefined : true}
      style={showImage ? undefined : style}
    >
      {showImage ? (
        <img
          className="user-avatar__image"
          src={resolvedSrc ?? undefined}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="user-avatar__initials" aria-hidden="true">
          {initials}
        </span>
      )}
    </span>
  );
}
