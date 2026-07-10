import { useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";
import "./TableInsertModal.css";

type TableInsertModalProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (rows: number, cols: number) => void;
};

export function TableInsertModal({ open, onClose, onInsert }: TableInsertModalProps) {
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");

  const handleInsert = () => {
    const r = Math.min(12, Math.max(1, Number.parseInt(rows, 10) || 3));
    const c = Math.min(8, Math.max(1, Number.parseInt(cols, 10) || 3));
    onInsert(r, c);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Insert table"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>Insert</Button>
        </>
      }
    >
      <div className="table-insert-form">
        <label className="table-insert-form__field">
          <span className="table-insert-form__label">Rows</span>
          <Input value={rows} onChange={setRows} placeholder="3" />
        </label>
        <label className="table-insert-form__field">
          <span className="table-insert-form__label">Columns</span>
          <Input value={cols} onChange={setCols} placeholder="3" />
        </label>
      </div>
    </Modal>
  );
}
