import type { ReactNode } from "react";
import type { ButtonHTMLAttributes } from "react";
import "./TemplateCard.css";

type TemplateCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  name: string;
  description: string;
};

export function TemplateCard({ name, description, className = "", ...props }: TemplateCardProps) {
  return (
    <button type="button" className={`template-card ${className}`.trim()} {...props}>
      <span className="template-card__name">{name}</span>
      <span className="template-card__desc">{description}</span>
    </button>
  );
}

export function TemplateCardGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`template-card-grid ${className}`.trim()}>{children}</div>;
}
