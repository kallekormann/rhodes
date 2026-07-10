"use client";

import { useState } from "react";
import { AuthLink, Button, Input } from "@/components/auth/AuthForm";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/app/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Request failed");
      return;
    }

    setSuccess(data.message ?? "Check your email for a reset link.");
  }

  return (
    <>
      <h1 className="auth-title">Reset password</h1>
      <p className="auth-subtitle">We&apos;ll email you a reset link.</p>
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
        {error ? <p className="auth-error">{error}</p> : null}
        {success ? <p className="auth-success">{success}</p> : null}
        <Button disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
      </form>
      <p className="auth-footer">
        <AuthLink href="/auth/login">Back to sign in</AuthLink>
      </p>
    </>
  );
}
