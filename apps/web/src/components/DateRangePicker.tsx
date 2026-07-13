import { CalendarRange } from "lucide-react";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./IconButton";
import { FieldPanel, useFieldPanel } from "./FieldControl";
import type { InputVariant } from "./Input";
import "./DatePicker.css";
import "./DateRangePicker.css";
import "./FieldControl.css";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function startOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function sameDay(a: Date, y: number, m: number, d: number) {
  return a.getFullYear() === y && a.getMonth() === m && a.getDate() === d;
}

function between(date: Date, start: Date, end: Date) {
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export type DateRange = { start: Date | null; end: Date | null };

export function formatDateRange(range: DateRange) {
  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "";
  if (range.start && range.end) return `${fmt(range.start)} → ${fmt(range.end)}`;
  if (range.start) return fmt(range.start);
  return "";
}

type DateRangePickerProps = {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  embedded?: boolean;
  className?: string;
};

export function DateRangePicker({
  value,
  onChange,
  embedded = false,
  className = "",
}: DateRangePickerProps) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [range, setRange] = useState<DateRange>(value ?? { start: null, end: null });

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
    const nextDate = new Date(viewYear, viewMonth, day);
    let next: DateRange;
    if (!range.start || (range.start && range.end)) {
      next = { start: nextDate, end: null };
    } else if (nextDate < range.start) {
      next = { start: nextDate, end: range.start };
    } else {
      next = { start: range.start, end: nextDate };
    }
    setRange(next);
    onChange?.(next);
  };

  const cellClass = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    const classes = ["date-picker__cell"];
    if (range.start && sameDay(range.start, viewYear, viewMonth, day)) {
      classes.push("date-picker__cell--selected", "date-picker__cell--range-start");
    }
    if (range.end && sameDay(range.end, viewYear, viewMonth, day)) {
      classes.push("date-picker__cell--selected", "date-picker__cell--range-end");
    }
    if (range.start && range.end && between(date, range.start, range.end)) {
      classes.push("date-picker__cell--in-range");
    }
    const today = new Date();
    if (sameDay(today, viewYear, viewMonth, day)) classes.push("date-picker__cell--today");
    return classes.join(" ");
  };

  const format = (d: Date | null) =>
    d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

  return (
    <div className={`date-range-picker ${embedded ? "date-range-picker--embedded" : ""} ${className}`.trim()}>
      {!embedded && (
        <div className="date-range-picker__inputs">
          <span className="date-range-picker__chip">{format(range.start)}</span>
          <span className="date-range-picker__sep">→</span>
          <span className="date-range-picker__chip">{format(range.end)}</span>
        </div>
      )}
      <div className="date-picker date-picker--embedded">
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
              <button key={day} type="button" className={cellClass(day)} onClick={() => pick(day)}>
                {day}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

type DateRangeFieldProps = {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  variant?: InputVariant;
  className?: string;
};

export function DateRangeField({
  value,
  onChange,
  placeholder = "Select range",
  variant = "field",
  className = "",
}: DateRangeFieldProps) {
  const { open, setOpen, rootRef, panelRef, align, placement, panelCoords } =
    useFieldPanel();
  const isPlain = variant === "plain";
  const display = value ? formatDateRange(value) : "";

  const handleChange = (range: DateRange) => {
    onChange?.(range);
    if (range.start && range.end) setOpen(false);
  };

  return (
    <div className={`field-root ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={`field-control ${isPlain ? "field-control--plain" : ""} ${open ? "field-control--open" : ""} ${!display ? "field-control--placeholder" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="field-control__value">{display || placeholder}</span>
        <CalendarRange size={16} strokeWidth={1.75} className="field-control__icon" />
      </button>

      {open && (
        <FieldPanel
          ref={panelRef}
          align={align}
          placement={placement}
          coords={panelCoords}
          calendar
        >
          <DateRangePicker embedded value={value} onChange={handleChange} />
        </FieldPanel>
      )}
    </div>
  );
}
