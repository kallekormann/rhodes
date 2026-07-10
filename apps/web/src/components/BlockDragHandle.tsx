import { GripVertical } from "lucide-react";
import "./BlockDragHandle.css";

type BlockDragHandleProps = {
  visible?: boolean;
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export function BlockDragHandle({
  visible = false,
  onMouseDown,
  className = "",
}: BlockDragHandleProps) {
  return (
    <button
      type="button"
      className={`block-drag-handle ${visible ? "block-drag-handle--visible" : ""} ${className}`.trim()}
      aria-label="Drag to reorder"
      onMouseDown={onMouseDown}
    >
      <GripVertical size={16} strokeWidth={1.75} />
    </button>
  );
}
