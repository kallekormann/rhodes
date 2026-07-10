import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import "./Input.css";
import "./FieldControl.css";

export type InputVariant = "field" | "plain";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
  hint?: string;
  variant?: InputVariant;
  className?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    value,
    onChange,
    placeholder,
    icon,
    hint,
    variant = "field",
    className = "",
    ...props
  },
  ref,
) {
  const isPlain = variant === "plain";

  return (
    <div className={`input-wrap ${isPlain ? "input-wrap--plain" : ""} ${className}`.trim()}>
      {icon && <span className="input-wrap__icon">{icon}</span>}
      <input
        ref={ref}
        className={`input ${isPlain ? "input--plain" : ""}`}
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        {...props}
      />
      {hint && <span className="input-wrap__hint">{hint}</span>}
    </div>
  );
});
