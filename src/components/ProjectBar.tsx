import { useState } from "react";
import type { Project } from "../lib/types";

interface ProjectBarProps {
  projects: Project[];
  current: number | null;
  onChange: (projectId: number | null) => void;
  onAdd: (name: string, color: string, icon: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const COLORS = ["#007AFF", "#FF453A", "#FF9F0A", "#30D158", "#BF5AF2", "#64D2FF", "#FFD60A"];

export function ProjectBar({ projects, current, onChange, onAdd, onDelete }: ProjectBarProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLORS[0]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd(newName.trim(), newColor, "📁");
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="project-bar">
      <div className="project-scroll">
        <button
          className={`project-chip ${current === null ? "active" : ""}`}
          onClick={() => onChange(null)}
        >
          All
        </button>
        {projects.map((p) => (
          <div key={p.id} className="project-chip-wrap">
            <button
              className={`project-chip ${current === p.id ? "active" : ""}`}
              onClick={() => onChange(p.id)}
              style={{
                borderColor: current === p.id ? p.color : "transparent",
                ...(current === p.id ? { background: `${p.color}20` } : {}),
              }}
            >
              {p.icon && <span className="project-icon">{p.icon}</span>}
              {p.name}
            </button>
            <button
              className="project-delete"
              onClick={(e) => {
                e.stopPropagation();
                if (current === p.id) onChange(null);
                onDelete(p.id);
              }}
              title="Delete project"
            >&#xd7;</button>
          </div>
        ))}
        <button
          className="project-chip project-add-chip"
          onClick={() => setAdding(!adding)}
        >
          +
        </button>
      </div>
      {adding && (
        <div className="project-add-form">
          <div className="project-add-row">
            <div className="project-color-picks">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-dot ${newColor === c ? "selected" : ""}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="project-add-row">
            <input
              className="project-add-input"
              placeholder="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              autoFocus
            />
            <button className="btn-primary btn-sm" onClick={handleAdd}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
