import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "./IconButton";
import "./DatePicker.css";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function formatDate(date: Date | null | undefined) {
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type DatePickerProps = {
  value?: Date | null;
  onChange?: (date: Date) => void;
  embedded?: boolean;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  embedded = false,
  className = "",
}: DatePickerProps) {
  const initial = value ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState<Date | null>(value ?? null);

  const cells = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth);
    const offset = startOffset(viewYear, viewMonth);
    const items: (number | null)[] = [];
    for (let i = 0; i < offset; i++) items.push(null);
    for (let d = 1; d <= total; d++) items.push(d);
    return items;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const pick = (day: number) => {
    const next = new Date(viewYear, viewMonth, day);
    setSelected(next);
    onChange?.(next);
  };

  const isSelected = (day: number) =>
    selected &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;

  const isToday = (day: number) => {
    const now = new Date();
    return (
      now.getFullYear() === viewYear &&
      now.getMonth() === viewMonth &&
      now.getDate() === day
    );
  };

  return (
    <div className={`date-picker ${embedded ? "date-picker--embedded" : ""} ${className}`.trim()}>
      <div className="date-picker__header">
        <IconButton icon={ChevronLeft} label="Previous month" size="small" onClick={() => shiftMonth(-1)} />
        <span className="date-picker__month">{monthLabel}</span>
        <IconButton icon={ChevronRight} label="Next month" size="small" onClick={() => shiftMonth(1)} />
      </div>
      <div className="date-picker__weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d} className="date-picker__weekday">
            {d}
          </span>
        ))}
      </div>
      <div className="date-picker__grid">
        {cells.map((day, i) =>
          day === null ? (
            <span key={`empty-${i}`} className="date-picker__cell date-picker__cell--empty" />
          ) : (
            <button
              key={day}
              type="button"
              className={`date-picker__cell ${isSelected(day) ? "date-picker__cell--selected" : ""} ${isToday(day) ? "date-picker__cell--today" : ""}`}
              onClick={() => pick(day)}
            >
              {day}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
