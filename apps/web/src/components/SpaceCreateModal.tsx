import { useEffect, useState } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Modal } from "./Modal";

type SpaceCreateModalProps = {
  open: boolean;
  title: string;
  placeholder?: string;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function SpaceCreateModal({
  open,
  title,
  placeholder = "Space name",
  submitLabel = "Create",
  onClose,
  onSubmit,
}: SpaceCreateModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <Input
        value={name}
        onChange={setName}
        placeholder={placeholder}
        autoFocus
      />
    </Modal>
  );
}
