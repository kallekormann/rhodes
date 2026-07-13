import type { HTMLAttributes } from "react";
import "./Loader.css";

export type LoaderSize = "xs" | "s" | "m" | "l";

type LoaderProps = HTMLAttributes<HTMLSpanElement> & {
  size?: LoaderSize;
  label?: string;
};

export function Loader({
  size = "m",
  label = "Loading",
  className = "",
  ...props
}: LoaderProps) {
  return (
    <span
      className={`loader loader--${size} ${className}`.trim()}
      role="status"
      aria-label={label}
      {...props}
    >
      <span className="loader__ring" aria-hidden="true" />
      <span className="loader__track" aria-hidden="true" />
    </span>
  );
}

type LoaderStateProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
  size?: LoaderSize;
  align?: "start" | "center";
};

export function LoaderState({
  label,
  size = "m",
  align = "center",
  className = "",
  ...props
}: LoaderStateProps) {
  return (
    <div
      className={`loader-state loader-state--${align} ${className}`.trim()}
      {...props}
    >
      <Loader size={size} label={label ?? "Loading"} />
      {label ? <p className="loader-state__label caption">{label}</p> : null}
    </div>
  );
}
