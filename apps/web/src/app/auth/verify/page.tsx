import Link from "next/link";

export default function VerifyPage() {
  return (
    <>
      <h1 className="auth-title">Email verified</h1>
      <p className="auth-subtitle">
        Your account is ready. Sign in to continue setup.
      </p>
      <p className="auth-footer">
        <Link href="/auth/login">Continue to sign in</Link>
      </p>
    </>
  );
}
