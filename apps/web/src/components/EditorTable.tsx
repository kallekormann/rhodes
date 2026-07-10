import { Plus } from "lucide-react";
import type { TableBlock } from "@/data/editorTypes";
import { Button } from "./Button";
import "./EditorTable.css";

type EditorTableProps = {
  block: TableBlock;
  onChange: (block: TableBlock) => void;
  className?: string;
};

export function EditorTable({ block, onChange, className = "" }: EditorTableProps) {
  const updateCell = (row: number, col: number, value: string) => {
    const cells = block.cells.map((r, ri) =>
      r.map((cell, ci) => (ri === row && ci === col ? value : cell)),
    );
    onChange({ ...block, cells });
  };

  const addRow = () => {
    onChange({
      ...block,
      rows: block.rows + 1,
      cells: [...block.cells, Array.from({ length: block.cols }, () => "")],
    });
  };

  const addColumn = () => {
    onChange({
      ...block,
      cols: block.cols + 1,
      cells: block.cells.map((row) => [...row, ""]),
    });
  };

  return (
    <div className={`editor-table ${className}`.trim()}>
      <table>
        <tbody>
          {block.cells.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, colIndex) => (
                <td key={colIndex}>
                  <div
                    className="editor-table__cell"
                    contentEditable
                    suppressContentEditableWarning
                    ref={(el) => {
                      if (el && document.activeElement !== el && el.textContent !== cell) {
                        el.textContent = cell;
                      }
                    }}
                    onInput={(e) =>
                      updateCell(rowIndex, colIndex, e.currentTarget.textContent ?? "")
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="editor-table__toolbar">
        <Button variant="ghost" size="small" icon={Plus} onClick={addRow}>
          Row
        </Button>
        <Button variant="ghost" size="small" icon={Plus} onClick={addColumn}>
          Column
        </Button>
      </div>
    </div>
  );
}
