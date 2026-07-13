import "../auth/auth.css";
import type { ReactNode } from "react";

export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">{children}</div>
    </div>
  );
}
