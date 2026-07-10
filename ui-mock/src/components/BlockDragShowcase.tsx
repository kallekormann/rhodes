import { BlockDragHandle } from "./BlockDragHandle";
import { BlockDropZone } from "./BlockDropZone";
import "./BlockDragHandle.css";
import "./BlockDropZone.css";
import "./BlockDragShowcase.css";

export function BlockDragShowcase() {
  return (
    <div className="block-drag-showcase">
      <div className="block-drag-showcase__item">
        <span className="block-drag-showcase__label">Drag handle — visible on hover</span>
        <div className="block-drag-showcase__block">
          <BlockDragHandle visible />
          <p className="block-drag-showcase__text">
            Hover a paragraph to reveal the grip. Drag to reorder blocks.
          </p>
        </div>
      </div>
      <div className="block-drag-showcase__item">
        <span className="block-drag-showcase__label">Dragging — tilted block</span>
        <div className="block-drag-showcase__block block-drag-showcase__block--dragging">
          <BlockDragHandle visible />
          <p className="block-drag-showcase__text">Block being moved…</p>
        </div>
      </div>
      <div className="block-drag-showcase__item">
        <span className="block-drag-showcase__label">Drop zone</span>
        <BlockDropZone />
      </div>
    </div>
  );
}
