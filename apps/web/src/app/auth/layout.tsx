import "./auth.css";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="auth-brand">Rhodes</p>
        {children}
      </div>
    </div>
  );
}
