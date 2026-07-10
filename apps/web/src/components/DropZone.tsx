import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Upload } from "lucide-react";
import "./DropZone.css";

type DropZoneProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  children?: ReactNode;
};

export function DropZone({
  icon,
  children = "Drop PDF, DOCX, or TXT — or click to browse",
  className = "",
  ...props
}: DropZoneProps) {
  return (
    <button type="button" className={`drop-zone ${className}`.trim()} {...props}>
      {icon ?? <Upload size={24} strokeWidth={1.75} className="drop-zone__icon" />}
      <p className="drop-zone__label">{children}</p>
    </button>
  );
}
