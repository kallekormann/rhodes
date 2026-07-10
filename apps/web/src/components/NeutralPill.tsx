import type { ReactNode } from "react";
import "./NeutralPill.css";

type NeutralPillProps = {
  children: ReactNode;
};

export function NeutralPill({ children }: NeutralPillProps) {
  return <span className="neutral-pill">{children}</span>;
}
