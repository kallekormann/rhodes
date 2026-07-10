import "./BlockDropZone.css";

type BlockDropZoneProps = {
  label?: string;
  className?: string;
  variant?: "accent" | "muted";
};

export function BlockDropZone({
  label = "Drop here",
  className = "",
  variant = "accent",
}: BlockDropZoneProps) {
  return (
    <div
      className={`block-drop-zone block-drop-zone--${variant} ${className}`.trim()}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
