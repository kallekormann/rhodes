import type { InputHTMLAttributes } from "react";
import "./Radio.css";

type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
  name: string;
};

export function Radio({ label, description, className = "", id, name, ...props }: RadioProps) {
  const inputId = id ?? `radio-${name}-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label className={`radio ${className}`.trim()} htmlFor={inputId}>
      <input
        id={inputId}
        type="radio"
        name={name}
        className="radio__input"
        {...props}
      />
      <span className="radio__dot" aria-hidden="true" />
      <span className="radio__text">
        <span className="radio__label">{label}</span>
        {description && <span className="radio__desc">{description}</span>}
      </span>
    </label>
  );
}

type RadioGroupProps = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; description?: string }[];
  className?: string;
};

export function RadioGroup({ name, value, onChange, options, className = "" }: RadioGroupProps) {
  return (
    <div className={`radio-group ${className}`.trim()} role="radiogroup">
      {options.map((opt) => (
        <Radio
          key={opt.value}
          name={name}
          value={opt.value}
          label={opt.label}
          description={opt.description}
          checked={value === opt.value}
          onChange={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
}
