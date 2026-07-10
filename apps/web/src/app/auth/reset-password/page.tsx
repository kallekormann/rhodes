"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/Button";
import { createClient } from "@/lib/supabase/client";

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
          <Link href="/auth/forgot-password">Request a new link</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Choose a new password</h1>
      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
        />
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        <Button type="submit" loading={loading}>
          Update password
        </Button>
      </form>
    </>
  );
}
