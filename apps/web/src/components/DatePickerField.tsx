import { Calendar } from "lucide-react";
import { DatePicker, formatDate } from "./DatePicker";
import { FieldPanel, useFieldPanel } from "./FieldControl";
import type { InputVariant } from "./Input";
import "./FieldControl.css";

type DatePickerFieldProps = {
  value?: Date | null;
  onChange?: (date: Date) => void;
  placeholder?: string;
  variant?: InputVariant;
  className?: string;
};

export function DatePickerField({
  value,
  onChange,
  placeholder = "Select date",
  variant = "field",
  className = "",
}: DatePickerFieldProps) {
  const { open, setOpen, rootRef, panelRef, align, placement, panelCoords } =
    useFieldPanel();
  const isPlain = variant === "plain";

  const handleChange = (date: Date) => {
    onChange?.(date);
    setOpen(false);
  };

  return (
    <div className={`field-root ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`field-control ${isPlain ? "field-control--plain" : ""} ${open ? "field-control--open" : ""} ${!value ? "field-control--placeholder" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="field-control__value">{value ? formatDate(value) : placeholder}</span>
        <Calendar size={16} strokeWidth={1.75} className="field-control__icon" />
      </button>

      {open && (
        <FieldPanel
          ref={panelRef}
          align={align}
          placement={placement}
          coords={panelCoords}
          calendar
        >
          <DatePicker embedded value={value} onChange={handleChange} />
        </FieldPanel>
      )}
    </div>
  );
}
