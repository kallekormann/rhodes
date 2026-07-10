import type { InputHTMLAttributes, ReactNode } from "react";
import { Input } from "@/components/Input";

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  icon?: ReactNode;
};

export function AuthField({
  label,
  error,
  hint,
  ...inputProps
}: AuthFieldProps) {
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={inputProps.id ?? inputProps.name}>
        {label}
      </label>
      <Input hint={hint} aria-invalid={Boolean(error)} {...inputProps} />
      {error ? <p className="auth-message auth-message--error">{error}</p> : null}
    </div>
  );
}
