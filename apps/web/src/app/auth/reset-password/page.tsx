"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthLink, Button, Input } from "@/components/auth/AuthForm";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (!ready) {
    return (
      <>
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">
          Open the reset link from your email to continue.
        </p>
        <p className="auth-footer">
          <AuthLink href="/auth/forgot-password">Request a new link</AuthLink>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Choose a new password</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        <Input
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <Button disabled={loading}>{loading ? "Saving…" : "Update password"}</Button>
      </form>
    </>
  );
}
