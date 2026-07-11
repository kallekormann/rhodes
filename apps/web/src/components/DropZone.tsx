"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import "./DropZone.css";

type DropZoneProps = {
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  uploading?: boolean;
  accept?: string;
  onFilesSelected?: (files: File[]) => void;
};

export function DropZone({
  icon,
  children = "Drop PDF, DOCX, or TXT — or click to browse",
  className = "",
  disabled = false,
  uploading = false,
  accept = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
  onFilesSelected,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled || uploading) return;
    onFilesSelected?.(Array.from(fileList));
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || uploading) return;
    setDragging(true);
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`drop-zone ${dragging ? "drop-zone--dragging" : ""} ${disabled ? "drop-zone--disabled" : ""} ${className}`.trim()}
      onClick={() => {
        if (!disabled && !uploading) inputRef.current?.click();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (!disabled && !uploading) inputRef.current?.click();
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-disabled={disabled || uploading}
    >
      <input
        ref={inputRef}
        type="file"
        className="drop-zone__input"
        accept={accept}
        multiple
        hidden
        disabled={disabled || uploading}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {icon ?? <Upload size={24} strokeWidth={1.75} className="drop-zone__icon" />}
      <p className="drop-zone__label">
        {uploading ? "Uploading…" : children}
      </p>
    </div>
  );
}
