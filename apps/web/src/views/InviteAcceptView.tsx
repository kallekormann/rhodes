"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { LoaderState } from "@/components/Loader";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { appUrl } from "@/lib/auth/urls";
import { writeActiveWorkspaceId } from "@/lib/workspaces/scope";
import "./InviteAcceptView.css";

type InvitePreviewState = {
  valid: boolean;
  workspace_name?: string;
  email?: string;
  role?: string;
  reason?: string;
};

export function InviteAcceptView({ token }: { token: string }) {
  const router = useRouter();
  const invitePath = `/invite/${token}`;
  const autoAcceptStarted = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "error">(
    "loading",
  );
  const [preview, setPreview] = useState<InvitePreviewState | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [emailMatches, setEmailMatches] = useState(false);
  const [error, setError] = useState("");

  const authLinks = useMemo(() => {
    const next = encodeURIComponent(invitePath);
    const email = preview?.email ? encodeURIComponent(preview.email) : "";
    const emailQuery = email ? `&email=${email}` : "";

    return {
      register: `/auth/register?next=${next}${emailQuery}`,
      login: `/auth/login?next=${next}${emailQuery}`,
    };
  }, [invitePath, preview?.email]);

  const acceptInvite = async () => {
    setStatus("accepting");
    setError("");

    try {
      await fetch("/app/api/workspaces/bootstrap", { method: "POST" });
      await fetch("/app/api/invites/accept-pending", { method: "POST" });

      const response = await fetch(`/app/api/invites/${token}/accept`, {
        method: "POST",
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        workspace?: { id: string; name: string };
      };

      if (!response.ok) {
        setError(body.error ?? "Couldn't accept invite");
        setStatus("error");
        return;
      }

      const workspaceId = body.workspace?.id;
      if (workspaceId) {
        writeActiveWorkspaceId(workspaceId);
      }

      window.location.href = appUrl("/settings?mode=scope&section=Team");
    } catch {
      setError("Couldn't accept invite");
      setStatus("error");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setStatus("loading");
      setError("");

      try {
        const response = await fetch(`/app/api/invites/${token}`);
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          preview?: InvitePreviewState;
          signed_in?: boolean;
          signed_in_email?: string | null;
          email_matches?: boolean;
        };

        if (cancelled) return;

        if (!response.ok) {
          setError(body.error ?? "Couldn't load invite");
          setStatus("error");
          return;
        }

        const nextPreview = body.preview ?? { valid: false };
        setPreview(nextPreview);
        setSignedIn(Boolean(body.signed_in));
        setSignedInEmail(body.signed_in_email ?? null);
        setEmailMatches(Boolean(body.email_matches));

        if (!nextPreview.valid) {
          const reason =
            nextPreview.reason === "already_accepted"
              ? "This invite was already accepted."
              : nextPreview.reason === "expired"
                ? "This invite has expired."
                : "This invite link is invalid.";
          setError(reason);
          setStatus("error");
          return;
        }

        setStatus("ready");
      } catch {
        if (!cancelled) {
          setError("Couldn't load invite");
          setStatus("error");
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== "ready" || !emailMatches || autoAcceptStarted.current) {
      return;
    }

    autoAcceptStarted.current = true;
    void acceptInvite();
  }, [status, emailMatches]);

  if (status === "loading") {
    return (
      <>
        <p className="auth-brand">Rhodes</p>
        <LoaderState label="Loading invite…" size="m" />
      </>
    );
  }

  if (status === "accepting") {
    return (
      <>
        <p className="auth-brand">Rhodes</p>
        <LoaderState label="Joining team scope…" size="m" />
      </>
    );
  }

  return (
    <>
      <p className="auth-brand">Rhodes</p>
      {status === "error" ? (
        <>
          <h1 className="auth-title">Invite unavailable</h1>
          <p className="auth-subtitle">{error}</p>
          <Button variant="secondary" onClick={() => router.push("/documents")}>
            Back to editor
          </Button>
        </>
      ) : (
        <>
          <h1 className="auth-title">
            Join {preview?.workspace_name ?? "team scope"}
          </h1>
          <p className="auth-subtitle">
            This invite was sent to <strong>{preview?.email}</strong>.
            {signedInEmail ? (
              <>
                {" "}
                You&apos;re signed in as <strong>{signedInEmail}</strong>.
              </>
            ) : (
              <> Create an account or sign in with that email to join.</>
            )}
          </p>

          {!signedIn && (
            <div className="invite-accept__actions">
              <Button onClick={() => router.push(authLinks.register)}>
                Create account
              </Button>
              <Button variant="secondary" onClick={() => router.push(authLinks.login)}>
                Sign in
              </Button>
            </div>
          )}

          {signedIn && !emailMatches && (
            <div className="invite-accept__notice">
              <p className="caption">
                Sign in with <strong>{preview?.email}</strong> to accept. Use a private
                window, or sign out and register or sign in with the invited email.
              </p>
              <LogoutButton />
            </div>
          )}

          {signedIn && emailMatches && (
            <Button onClick={() => void acceptInvite()}>Accept invite</Button>
          )}
        </>
      )}
    </>
  );
}
