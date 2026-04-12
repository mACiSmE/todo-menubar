import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Todo } from "../lib/types";
import { STATUS_ONGOING, STATUS_DONE, STATUS_PENDING } from "../lib/types";
import { localDateStr } from "../lib/date";

interface TodoItemProps {
  todo: Todo;
  onSetStatus: (id: number, status: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<void>;
}

const priorityColors: Record<string, string> = {
  high: "#eb5757",
  medium: "#f2994a",
  low: "#6ab04c",
};

const priorityCycle: Record<string, string> = {
  low: "medium",
  medium: "high",
  high: "low",
};

// Parse description: text lines + image paths (lines starting with "img:")
function parseDescription(desc: string | null): { text: string; images: string[] } {
  if (!desc) return { text: "", images: [] };
  const lines = desc.split("\n");
  const images: string[] = [];
  const textLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("img:")) {
      images.push(line.slice(4));
    } else {
      textLines.push(line);
    }
  }
  return { text: textLines.join("\n"), images };
}

function buildDescription(text: string, images: string[]): string {
  const parts = [text.trim()];
  for (const img of images) {
    parts.push("img:" + img);
  }
  return parts.join("\n");
}

export function TodoItem({ todo, onSetStatus, onDelete, onUpdate }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.title);
  const [expanded, setExpanded] = useState(false);
  const [descText, setDescText] = useState("");
  const [descImages, setDescImages] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const savingRef = useRef(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!showDatePicker) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".date-wrapper")) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker]);

  // Load description when expanded
  useEffect(() => {
    if (expanded) {
      const parsed = parseDescription(todo.description);
      setDescText(parsed.text);
      setDescImages(parsed.images);
    }
  }, [expanded, todo.description]);

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    if (editValue.trim() && editValue.trim() !== todo.title) {
      await onUpdate(todo.id, { title: editValue.trim() });
    }
    setEditing(false);
    savingRef.current = false;
  };

  const handleDescSave = async () => {
    const newDesc = buildDescription(descText, descImages);
    if (newDesc !== (todo.description || "")) {
      await onUpdate(todo.id, { description: newDesc });
    }
  };

  const handleDescPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        try {
          const path = await invoke<string>("save_todo_image", {
            imageB64: b64,
            todoId: todo.id,
          });
          const newImages = [...descImages, path];
          setDescImages(newImages);
          const newDesc = buildDescription(descText, newImages);
          await onUpdate(todo.id, { description: newDesc });
        } catch (err) {
          console.error("Failed to save image:", err);
        }
        return;
      }
    }
  };

  const removeImage = async (index: number) => {
    const newImages = descImages.filter((_, i) => i !== index);
    setDescImages(newImages);
    const newDesc = buildDescription(descText, newImages);
    await onUpdate(todo.id, { description: newDesc });
  };

  const cyclePriority = async () => {
    const next = priorityCycle[todo.priority] || "medium";
    await onUpdate(todo.id, { priority: next as Todo["priority"] });
  };

  const setQuickDate = async (offset: number | null) => {
    if (offset === null) {
      await onUpdate(todo.id, { due_date: null });
    } else {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      await onUpdate(todo.id, { due_date: localDateStr(d) });
    }
    setShowDatePicker(false);
  };

  const formatDueDate = (date: string | null) => {
    if (!date) return null;
    const today = localDateStr();
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const tomorrow = localDateStr(tmrw);
    if (date === today) return "Today";
    if (date === tomorrow) return "Tomorrow";
    if (date < today) return "Overdue";
    return date.slice(5);
  };

  const dueLabel = formatDueDate(todo.due_date);
  const isOverdue = todo.due_date && todo.due_date < localDateStr();
  const hasDesc = todo.description && todo.description.trim().length > 0;

  const isDone = todo.completed === STATUS_DONE;
  const isPending = todo.completed === STATUS_PENDING;
  const isOngoing = todo.completed === STATUS_ONGOING;

  const statusClass = isDone ? "done" : isPending ? "pending" : "ongoing";

  const handleCheckbox = () => {
    if (isDone) {
      onSetStatus(todo.id, STATUS_ONGOING);
    } else {
      onSetStatus(todo.id, STATUS_DONE);
    }
  };

  const handlePendingToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) {
      onSetStatus(todo.id, STATUS_ONGOING);
    } else {
      onSetStatus(todo.id, STATUS_PENDING);
    }
  };

  return (
    <div className={`todo-item-wrap ${expanded ? "expanded" : ""}`}>
      <div className={`todo-item ${statusClass}`}>
        <button
          className={`todo-checkbox ${statusClass}`}
          onClick={handleCheckbox}
          style={isOngoing ? { borderColor: priorityColors[todo.priority] } : {}}
          title={isDone ? "Mark ongoing" : "Mark done"}
        >
          {isDone ? <span className="check-mark">&#10003;</span> : null}
          {isPending ? <span className="pending-mark">&#8214;</span> : null}
        </button>

        <div className="todo-main" onClick={() => !editing && setExpanded(!expanded)}>
          {editing ? (
            <input
              className="todo-edit-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={handleSave}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="todo-title-row">
              <span
                className="todo-title"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                  setEditValue(todo.title);
                }}
              >
                {todo.title}
                {hasDesc && !expanded && <span className="desc-indicator">&#9998;</span>}
              </span>
              <button
                className="todo-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                  setEditValue(todo.title);
                }}
                title="Edit title"
              >&#9998;</button>
            </div>
          )}

          <div className="todo-meta">
            <button className="meta-btn priority-btn" onClick={(e) => { e.stopPropagation(); cyclePriority(); }}>
              <span className="priority-dot" style={{ background: priorityColors[todo.priority] }} />
            </button>

            <div className="date-wrapper" onClick={(e) => e.stopPropagation()}>
              <button className="meta-btn date-btn" onClick={() => setShowDatePicker(!showDatePicker)}>
                {dueLabel ? (
                  <span className={isOverdue ? "overdue" : ""}>{dueLabel}</span>
                ) : (
                  <span className="date-icon">&#128197;</span>
                )}
              </button>
              {showDatePicker && (
                <div className="date-picker">
                  <button onClick={() => setQuickDate(0)}>Today</button>
                  <button onClick={() => setQuickDate(1)}>Tomorrow</button>
                  <button onClick={() => setQuickDate(7)}>Next Week</button>
                  {todo.due_date && <button onClick={() => setQuickDate(null)}>Clear</button>}
                </div>
              )}
            </div>
          </div>
        </div>

        {!isDone && (
          <button
            className={`todo-pending-btn ${isPending ? "is-pending" : ""}`}
            onClick={handlePendingToggle}
            title={isPending ? "Resume → Ongoing" : "Pause → Pending"}
          >
            {isPending ? "\u25B6" : "\u23F8"}
          </button>
        )}
        <span className="todo-created">{todo.created_at.slice(0, 10)}</span>
        <button className="todo-delete" onClick={() => onDelete(todo.id)}>&#xd7;</button>
      </div>

      {expanded && (
        <div className="todo-detail">
          <textarea
            ref={descRef}
            className="todo-desc-input"
            placeholder="Add notes..."
            value={descText}
            onChange={(e) => setDescText(e.target.value)}
            onBlur={handleDescSave}
            onPaste={handleDescPaste}
            rows={3}
          />
          {descImages.length > 0 && (
            <div className="todo-images">
              {descImages.map((imgPath, i) => (
                <div key={i} className="todo-image-thumb">
                  <img src={convertFileSrc(imgPath)} alt="" />
                  <button className="image-remove" onClick={() => removeImage(i)}>&#xd7;</button>
                </div>
              ))}
            </div>
          )}
          <div className="todo-detail-hint">Paste images with Cmd+V</div>
        </div>
      )}
    </div>
  );
}
