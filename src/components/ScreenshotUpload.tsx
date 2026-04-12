import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { extractTodosFromImage, extractTodosFromClipboard } from "../lib/ocr";
import type { Project } from "../lib/types";

interface ScreenshotUploadProps {
  projects: Project[];
  currentProjectId: number | null;
  onAddTodos: (titles: string[], projectId?: number) => Promise<void>;
  onClose: () => void;
}

export function ScreenshotUpload({ projects, currentProjectId, onAddTodos, onClose }: ScreenshotUploadProps) {
  const [status, setStatus] = useState<"idle" | "processing" | "review">("idle");
  const [extracted, setExtracted] = useState<{ text: string; checked: boolean }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | string>(currentProjectId ?? "none");
  const [method, setMethod] = useState("");
  const [error, setError] = useState("");
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Listen for paste events
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          setStatus("processing");
          setError("");

          try {
            const arrayBuf = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            const result = await extractTodosFromClipboard(bytes);
            setMethod(result.method);

            if (result.todos.length === 0) {
              setError("No tasks found in this image");
              setStatus("idle");
              return;
            }

            setExtracted(result.todos.map((t) => ({ text: t, checked: true })));
            setStatus("review");
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            setError(msg);
            setStatus("idle");
          }
          return;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  const handlePickFile = async () => {
    try {
      setError("");
      const file = await open({
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "heic", "webp"] }],
        multiple: false,
      });
      if (!file) return;

      setStatus("processing");
      const result = await extractTodosFromImage(file as string);
      setMethod(result.method);

      if (result.todos.length === 0) {
        setError("No tasks found in this image");
        setStatus("idle");
        return;
      }

      setExtracted(result.todos.map((t) => ({ text: t, checked: true })));
      setStatus("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("idle");
    }
  };

  const handleAdd = async () => {
    const selected = extracted.filter((e) => e.checked).map((e) => e.text);
    if (selected.length > 0) {
      const pid = selectedProjectId === "none" ? undefined : Number(selectedProjectId);
      await onAddTodos(selected, pid);
    }
    onClose();
  };

  const toggleItem = (index: number) => {
    setExtracted((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  if (status === "processing") {
    return (
      <div className="screenshot-panel">
        <div className="screenshot-header">
          <span>Extracting tasks...</span>
        </div>
        <div className="screenshot-loading">
          <div className="spinner" />
          <p>Analyzing image</p>
        </div>
      </div>
    );
  }

  if (status === "review") {
    const selectedCount = extracted.filter((e) => e.checked).length;
    return (
      <div className="screenshot-panel">
        <div className="screenshot-header">
          <span>Found {extracted.length} tasks</span>
          <span className="method-badge">{method === "claude" ? "AI" : "OCR"}</span>
        </div>
        <div className="screenshot-project-select">
          <span className="screenshot-project-label">Add to:</span>
          <select
            className="screenshot-project-dropdown"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="none">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.icon} {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="screenshot-list">
          {extracted.map((item, i) => (
            <label key={i} className="screenshot-item">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleItem(i)}
              />
              <span>{item.text}</span>
            </label>
          ))}
        </div>
        <div className="screenshot-actions">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleAdd} disabled={selectedCount === 0}>
            Add {selectedCount} task{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screenshot-panel" ref={pasteAreaRef}>
      <div className="screenshot-header">
        <span>Screenshot OCR</span>
        <button className="screenshot-close" onClick={onClose}>&#xd7;</button>
      </div>
      <div className="screenshot-body">
        <div className="paste-area">
          <span className="paste-icon">&#128203;</span>
          <span className="paste-title">Cmd+V to paste screenshot</span>
          <span className="paste-hint">Take a screenshot, then paste here</span>
        </div>
        <div className="paste-divider">
          <span>or</span>
        </div>
        <button className="screenshot-pick-btn" onClick={handlePickFile}>
          <span className="pick-icon">&#128193;</span>
          <span>Select image file</span>
        </button>
        {error && <div className="add-error">{error}</div>}
      </div>
    </div>
  );
}
