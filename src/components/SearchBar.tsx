import { useState } from "react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded && !value) {
    return (
      <button className="search-toggle" onClick={() => setExpanded(true)}>
        &#x1F50D;
      </button>
    );
  }

  return (
    <div className="search-bar">
      <input
        className="search-input"
        type="text"
        placeholder="Search tasks..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) setExpanded(false);
        }}
        autoFocus
      />
      {value && (
        <button
          className="search-clear"
          onClick={() => {
            onChange("");
            setExpanded(false);
          }}
        >
          &#xd7;
        </button>
      )}
    </div>
  );
}
