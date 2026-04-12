import { useState, useEffect } from "react";
import type { Todo } from "../lib/types";
import * as db from "../lib/db";

interface ArchiveProps {
  onClose: () => void;
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function formatDate(dt: string | null): string {
  if (!dt) return "";
  return dt.slice(5, 10);
}

export function Archive({ onClose }: ArchiveProps) {
  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const m = await db.getArchiveMonths();
      setMonths(m);
      setLoading(false);
      if (m.length > 0) {
        setSelectedMonth(m[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    (async () => {
      const data = await db.getArchivedTodos(selectedMonth);
      setTodos(data);
    })();
  }, [selectedMonth]);

  return (
    <div className="archive-panel">
      <div className="screenshot-header">
        <span>Archive</span>
        <button className="screenshot-close" onClick={onClose}>&times;</button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading...</p></div>
      ) : months.length === 0 ? (
        <div className="empty-state">
          <p>No archived tasks</p>
          <p className="hint">Completed tasks will appear here by month</p>
        </div>
      ) : (
        <>
          <div className="archive-months">
            {months.map((m) => (
              <button
                key={m}
                className={`archive-month-btn ${selectedMonth === m ? "active" : ""}`}
                onClick={() => setSelectedMonth(m)}
              >
                {formatMonth(m)}
              </button>
            ))}
          </div>

          <div className="archive-list">
            <div className="archive-count">
              {todos.length} task{todos.length !== 1 ? "s" : ""} completed
            </div>
            {todos.map((todo) => (
              <div key={todo.id} className="archive-item">
                <span className="archive-check">{"\u2713"}</span>
                <div className="archive-item-main">
                  <span className="archive-item-title">{todo.title}</span>
                  {todo.description && (
                    <span className="archive-item-desc">
                      {todo.description.split("\n").filter(l => !l.startsWith("img:")).join(" ").slice(0, 60)}
                    </span>
                  )}
                </div>
                <span className="archive-item-date">
                  {formatDate(todo.completed_at)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
