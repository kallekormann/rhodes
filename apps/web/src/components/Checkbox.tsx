import type { InputHTMLAttributes, ReactNode } from "react";
import "./Checkbox.css";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
  /** Right-aligned slot for a status pill (e.g. "Via {bundle}") — mirrors ListRow's trailing. */
  trailing?: ReactNode;
};

export function Checkbox({
  label,
  description,
  trailing,
  className = "",
  id,
  ...props
}: CheckboxProps) {
  const inputId = id ?? `checkbox-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label className={`checkbox ${className}`.trim()} htmlFor={inputId}>
      <input id={inputId} type="checkbox" className="checkbox__input" {...props} />
      <span className="checkbox__box" aria-hidden="true" />
      <span className="checkbox__text">
        <span className="checkbox__label">{label}</span>
        {description && <span className="checkbox__desc">{description}</span>}
      </span>
      {trailing ? <span className="checkbox__trailing">{trailing}</span> : null}
    </label>
  );
}
