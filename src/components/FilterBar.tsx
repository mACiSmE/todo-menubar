import type { FilterMode } from "../lib/types";

interface FilterBarProps {
  current: FilterMode;
  onChange: (mode: FilterMode) => void;
  counts: Record<FilterMode, number>;
}

const filters: { key: FilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ongoing", label: "Ongoing" },
  { key: "pending", label: "Pending" },
  { key: "done", label: "Done" },
];

export function FilterBar({ current, onChange, counts }: FilterBarProps) {
  return (
    <div className="filter-bar">
      {filters.map((f) => (
        <button
          key={f.key}
          className={`filter-pill ${current === f.key ? "active" : ""}`}
          onClick={() => onChange(f.key)}
        >
          {f.label}
          {counts[f.key] > 0 && (
            <span className="filter-count">{counts[f.key]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
