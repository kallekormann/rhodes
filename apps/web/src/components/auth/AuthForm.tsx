import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Input({
  label,
  id,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
}) {
  const inputId = id ?? props.name;
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className="auth-input" {...props} />
      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}

export function Button({
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" className="auth-button" {...props}>
      {children}
    </button>
  );
}

export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return <Link href={href}>{children}</Link>;
}
