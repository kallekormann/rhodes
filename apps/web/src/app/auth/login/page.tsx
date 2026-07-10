"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLink, Button, Input } from "@/components/auth/AuthForm";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <p className="auth-subtitle">Welcome back to Rhodes.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <Button disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button>
      </form>
      <p className="auth-footer">
        <AuthLink href="/auth/forgot-password">Forgot password?</AuthLink>
        {" · "}
        <AuthLink href="/auth/register">Create account</AuthLink>
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
