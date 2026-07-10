"use client";

import { useState } from "react";
import { AuthLink, Button, Input } from "@/components/auth/AuthForm";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/app/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Registration failed");
      return;
    }

    setSuccess(data.message ?? "Check your email to confirm your account.");
  }

  return (
    <>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-subtitle">Start your private Rhodes workspace.</p>
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="auth-error">{error}</p> : null}
        {success ? <p className="auth-success">{success}</p> : null}
        <Button disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="auth-footer">
        <AuthLink href="/auth/login">Already have an account?</AuthLink>
      </p>
    </>
  );
}
