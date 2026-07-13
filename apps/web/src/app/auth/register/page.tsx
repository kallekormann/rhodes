"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/Button";

function RegisterForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const invitedEmail = searchParams.get("email") ?? "";
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setSuccess(null);

    const response = await fetch("/app/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, next }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Registration failed");
      return;
    }

    setSuccess(data.message ?? "Check your email to confirm your account.");
  }

  const loginHref =
    next && next !== "/"
      ? `/auth/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}`
      : "/auth/login";

  return (
    <>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-subtitle">
        {invitedEmail
          ? "Create your Rhodes account to accept the team invite."
          : "Start your private Rhodes scope."}
      </p>
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={setPassword}
          hint="8+ characters"
        />
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        {success ? <p className="auth-message auth-message--success">{success}</p> : null}
        <Button type="submit" loading={loading}>
          Create account
        </Button>
      </form>
      <p className="auth-footer">
        <Link href={loginHref}>Already have an account?</Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<p className="auth-subtitle">Loading…</p>}>
      <RegisterForm />
    </Suspense>
  );
}
