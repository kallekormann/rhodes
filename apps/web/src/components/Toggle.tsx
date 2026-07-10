import type { InputHTMLAttributes } from "react";
import "./Toggle.css";

type ToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
};

export function Toggle({ label, description, className = "", id, ...props }: ToggleProps) {
  const inputId = id ?? `toggle-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label className={`toggle ${className}`.trim()} htmlFor={inputId}>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {description && <span className="toggle__desc">{description}</span>}
      </span>
      <input id={inputId} type="checkbox" role="switch" className="toggle__input" {...props} />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
    </label>
  );
}
