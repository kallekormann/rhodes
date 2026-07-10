import type { TextareaHTMLAttributes } from "react";
import "./TextArea.css";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function TextArea({
  label,
  hint,
  error,
  className = "",
  id,
  ...props
}: TextAreaProps) {
  const areaId = id ?? (label ? `textarea-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);

  return (
    <div className={`textarea-field ${error ? "textarea-field--error" : ""} ${className}`.trim()}>
      {label && (
        <label className="textarea-field__label" htmlFor={areaId}>
          {label}
        </label>
      )}
      <textarea id={areaId} className="textarea" {...props} />
      {hint && !error && <span className="textarea-field__hint">{hint}</span>}
      {error && <span className="textarea-field__error">{error}</span>}
    </div>
  );
}
