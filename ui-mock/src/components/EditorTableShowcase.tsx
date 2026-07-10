import { createTableCells } from "../data/editorTypes";
import { EditorTable } from "./EditorTable";
import { TableInsertModal } from "./TableInsertModal";
import "./EditorTable.css";
import "./EditorTableShowcase.css";

const sampleTable = {
  id: "table-demo",
  kind: "table" as const,
  rows: 3,
  cols: 3,
  cells: createTableCells(3, 3).map((row, ri) =>
    row.map((_, ci) => (ri === 0 ? `Header ${ci + 1}` : ri === 1 && ci === 0 ? "Cell" : "")),
  ),
};

export function EditorTableShowcase() {
  return (
    <div className="editor-table-showcase">
      <div className="editor-table-showcase__item">
        <span className="editor-table-showcase__label">Editable table — add row/column</span>
        <EditorTable block={sampleTable} onChange={() => {}} />
      </div>
      <div className="editor-table-showcase__item">
        <span className="editor-table-showcase__label">Insert table dialog</span>
        <p className="editor-table-showcase__hint">
          Opened via slash command /table in the editor. Set rows and columns before insert.
        </p>
        <TableInsertModal open onClose={() => {}} onInsert={() => {}} />
      </div>
    </div>
  );
}
