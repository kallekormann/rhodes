"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { UserAvatar } from "@/components/UserAvatar";
import { useApp } from "@/context/AppContext";
import "./ProfileAvatarField.css";

type ProfileAvatarFieldProps = {
  name: string;
  userId: string;
  avatarUrl: string | null;
  onAvatarChange: (avatarUrl: string | null) => void;
};

export function ProfileAvatarField({
  name,
  userId,
  avatarUrl,
  onAvatarChange,
}: ProfileAvatarFieldProps) {
  const { showToast } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/app/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        avatar_url?: string | null;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Couldn't upload avatar");
      }

      onAvatarChange(body.avatar_url ?? null);
      showToast("Avatar updated", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Couldn't upload avatar",
        "error",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setRemoving(true);
    try {
      const response = await fetch("/app/api/profile/avatar", { method: "DELETE" });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Couldn't remove avatar");
      }
      onAvatarChange(null);
      showToast("Avatar removed", "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Couldn't remove avatar",
        "error",
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="profile-avatar-field">
      <UserAvatar name={name} userId={userId} src={avatarUrl} size="lg" />
      <div className="profile-avatar-field__actions">
        <Button
          variant="secondary"
          size="small"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Change photo
        </Button>
        {avatarUrl ? (
          <Button
            variant="ghost"
            size="small"
            loading={removing}
            onClick={() => void removeAvatar()}
          >
            Remove
          </Button>
        ) : null}
        <p className="caption profile-avatar-field__hint">
          JPG, PNG, or WebP. Max 2 MB.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        className="profile-avatar-field__input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadFile(file);
        }}
      />
    </div>
  );
}
