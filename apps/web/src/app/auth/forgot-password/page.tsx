"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/Button";

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
        <AuthField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
        />
        {error ? <p className="auth-message auth-message--error">{error}</p> : null}
        {success ? <p className="auth-message auth-message--success">{success}</p> : null}
        <Button type="submit" loading={loading}>
          Send reset link
        </Button>
      </form>
      <p className="auth-footer">
        <Link href="/auth/login">Back to sign in</Link>
      </p>
    </>
  );
}
