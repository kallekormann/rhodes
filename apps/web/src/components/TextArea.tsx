import type { TextareaHTMLAttributes } from "react";
import "./TextArea.css";

export type TextAreaVariant = "field" | "plain";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  variant?: TextAreaVariant;
};

export function TextArea({
  label,
  hint,
  error,
  variant = "field",
  className = "",
  id,
  ...props
}: TextAreaProps) {
  const areaId = id ?? (label ? `textarea-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const isPlain = variant === "plain";

  return (
    <div className={`textarea-field ${error ? "textarea-field--error" : ""} ${className}`.trim()}>
      {label && (
        <label className="textarea-field__label" htmlFor={areaId}>
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        className={`textarea ${isPlain ? "textarea--plain" : ""}`.trim()}
        {...props}
      />
      {hint && !error && <span className="textarea-field__hint">{hint}</span>}
      {error && <span className="textarea-field__error">{error}</span>}
    </div>
  );
}
