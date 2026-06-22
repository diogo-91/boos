"use client";

type FilterBarProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterBar({ label, options, value, onChange }: FilterBarProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = value === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={[
                "rounded-md border px-3 py-2 text-sm font-medium transition",
                isSelected
                  ? "border-navy-800 bg-navy-800 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-navy-700 hover:text-navy-800"
              ].join(" ")}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
