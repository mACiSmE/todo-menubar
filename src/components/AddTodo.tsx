import { useState, useRef, useEffect } from "react";

interface AddTodoProps {
  onAdd: (title: string, priority?: string) => Promise<void>;
}

const priorityColors: Record<string, string> = {
  low: "#6ab04c",
  medium: "#f2994a",
  high: "#eb5757",
};

const priorityCycle: Record<string, string> = {
  low: "medium",
  medium: "high",
  high: "low",
};

export function AddTodo({ onAdd }: AddTodoProps) {
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState("");
  const [multiLines, setMultiLines] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAdd = async () => {
    if (!value.trim()) return;
    try {
      setError("");
      await onAdd(value.trim(), priority);
      setValue("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const lines = text
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length > 1) {
      e.preventDefault();
      setMultiLines(lines);
    }
  };

  const handleAddMulti = async () => {
    if (!multiLines) return;
    try {
      setError("");
      for (const line of multiLines) {
        await onAdd(line, priority);
      }
      setMultiLines(null);
      setValue("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (multiLines) {
    return (
      <div className="add-todo">
        <div className="multi-paste-panel">
          <div className="multi-paste-header">
            Detected {multiLines.length} tasks
          </div>
          <div className="multi-paste-list">
            {multiLines.map((line, i) => (
              <div key={i} className="multi-paste-item">
                <span className="multi-paste-num">{i + 1}</span>
                <span className="multi-paste-text">{line}</span>
                <button
                  className="multi-paste-remove"
                  onClick={() => {
                    const next = multiLines.filter((_, j) => j !== i);
                    if (next.length === 0) setMultiLines(null);
                    else setMultiLines(next);
                  }}
                >&#xd7;</button>
              </div>
            ))}
          </div>
          <div className="multi-paste-actions">
            <button className="btn-secondary" onClick={() => setMultiLines(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleAddMulti}>
              Add {multiLines.length} tasks
            </button>
          </div>
        </div>
        {error && <div className="add-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="add-todo">
      <div className="add-todo-row">
        <button
          className="add-priority-btn"
          onClick={() => setPriority(priorityCycle[priority])}
          title={`Priority: ${priority}`}
        >
          <span className="priority-dot" style={{ background: priorityColors[priority] }} />
        </button>
        <input
          ref={inputRef}
          type="text"
          className="add-input"
          placeholder="Add a task..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          onPaste={handlePaste}
        />
        <button className="add-btn" onClick={handleAdd}>+</button>
      </div>
      {error && <div className="add-error">{error}</div>}
    </div>
  );
}
