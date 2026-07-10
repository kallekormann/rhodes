import "./BlockDropZone.css";

type BlockDropZoneProps = {
  label?: string;
  className?: string;
};

export function BlockDropZone({ label = "Drop here", className = "" }: BlockDropZoneProps) {
  return (
    <div className={`block-drop-zone ${className}`.trim()} aria-hidden="true">
      {label}
    </div>
  );
}
