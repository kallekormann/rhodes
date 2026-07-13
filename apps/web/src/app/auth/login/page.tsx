"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const invitedEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invitedEmail) {
      setEmail(invitedEmail);
    }
  }, [invitedEmail]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/app/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Login failed");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <>
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-subtitle">Welcome back to your workspace.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />
        <AuthField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        <Button type="submit" loading={loading}>
          Sign in
        </Button>
      </form>
      <p className="auth-footer">
        <Link href="/auth/forgot-password">Forgot password?</Link>
        {" · "}
        <Link href={`/auth/register?next=${encodeURIComponent(next)}${email ? `&email=${encodeURIComponent(email)}` : ""}`}>
          Create account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="auth-subtitle">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
