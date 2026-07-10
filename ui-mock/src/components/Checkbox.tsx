import type { InputHTMLAttributes } from "react";
import "./Checkbox.css";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
};

export function Checkbox({ label, description, className = "", id, ...props }: CheckboxProps) {
  const inputId = id ?? `checkbox-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label className={`checkbox ${className}`.trim()} htmlFor={inputId}>
      <input id={inputId} type="checkbox" className="checkbox__input" {...props} />
      <span className="checkbox__box" aria-hidden="true" />
      <span className="checkbox__text">
        <span className="checkbox__label">{label}</span>
        {description && <span className="checkbox__desc">{description}</span>}
      </span>
    </label>
  );
}
