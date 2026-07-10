import "./TabBar.css";

type TabBarOption<T extends string> = {
  value: T;
  label: string;
  badge?: number;
};

type TabBarProps<T extends string> = {
  options: TabBarOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

export function TabBar<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: TabBarProps<T>) {
  return (
    <div className={`tab-bar ${className}`.trim()} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={`tab-bar__item ${value === opt.value ? "tab-bar__item--active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.badge != null && opt.badge > 0 && (
            <span className="tab-bar__badge">{opt.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
