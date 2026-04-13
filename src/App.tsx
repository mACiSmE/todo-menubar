import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { AddTodo } from "./components/AddTodo";
import { TodoList } from "./components/TodoList";
import { FilterBar } from "./components/FilterBar";
import { ProjectBar } from "./components/ProjectBar";
import { SearchBar } from "./components/SearchBar";
import { ScreenshotUpload } from "./components/ScreenshotUpload";
import { Archive } from "./components/Archive";
import { Settings } from "./components/Settings";
import { useTodos } from "./hooks/useTodos";
import { useProjects } from "./hooks/useProjects";
import { localDateStr } from "./lib/date";
import * as db from "./lib/db";
import type { FilterMode } from "./lib/types";
import "./App.css";

type View = "main" | "screenshot" | "archive" | "settings";

function App() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("main");
  const [projectId, setProjectId] = useState<number | null>(null);
  const { todos, loading, addTodo, setStatus, remove, update, refresh } = useTodos(filter, projectId ?? undefined);
  const { projects, addProject, removeProject } = useProjects();
  const notifiedRef = useRef<Set<number>>(new Set());
  const todosRef = useRef(todos);
  todosRef.current = todos;

  useEffect(() => {
    // Auto-archive on startup
    db.runAutoArchive().then((n) => {
      if (n > 0) {
        console.log(`Auto-archived ${n} tasks`);
        refresh();
      }
    });
  }, []);

  // Auto-archive check every hour
  useEffect(() => {
    const interval = setInterval(async () => {
      const n = await db.runAutoArchive();
      if (n > 0) refresh();
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const checkDueNotifications = useCallback(async () => {
    const today = localDateStr();
    const dueTodos = todosRef.current.filter(
      (t) => !t.completed && t.due_date === today && !notifiedRef.current.has(t.id)
    );
    if (dueTodos.length === 0) return;

    let permitted = await isPermissionGranted();
    if (!permitted) {
      const perm = await requestPermission();
      permitted = perm === "granted";
    }
    if (!permitted) return;

    for (const todo of dueTodos) {
      sendNotification({ title: "Task Due Today", body: todo.title });
      notifiedRef.current.add(todo.id);
    }
  }, []);

  useEffect(() => {
    checkDueNotifications();
    const interval = setInterval(checkDueNotifications, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkDueNotifications]);

  const filteredTodos = useMemo(() => {
    if (!search) return todos;
    const q = search.toLowerCase();
    return todos.filter((t) => t.title.toLowerCase().includes(q));
  }, [todos, search]);

  // 0=ongoing, 1=done, 2=pending
  const counts = useMemo(() => ({
    all: todos.length,
    ongoing: todos.filter((t) => t.completed === 0).length,
    pending: todos.filter((t) => t.completed === 2).length,
    done: todos.filter((t) => t.completed === 1).length,
  }), [todos]);

  const handleAddFromScreenshot = async (titles: string[], pid?: number) => {
    for (const title of titles) {
      await db.createTodo(title, pid);
    }
    await refresh();
  };

  if (view === "screenshot") {
    return (
      <div className="container">
        <ScreenshotUpload
          projects={projects}
          currentProjectId={projectId}
          onAddTodos={handleAddFromScreenshot}
          onClose={() => setView("main")}
        />
      </div>
    );
  }

  if (view === "archive") {
    return (
      <div className="container">
        <Archive onClose={() => setView("main")} />
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="container">
        <Settings onClose={() => setView("main")} />
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Todo</h1>
        <div className="header-actions">
          <SearchBar value={search} onChange={setSearch} />
          <button
            className="header-btn"
            onClick={() => setView("screenshot")}
            title="Screenshot OCR"
          >&#128247;</button>
          <button
            className="header-btn"
            onClick={() => setView("archive")}
            title="Archive"
          >&#128451;</button>
          <button
            className="header-btn"
            onClick={() => setView("settings")}
            title="Settings"
          >&#9881;</button>
        </div>
      </header>
      <ProjectBar
        projects={projects}
        current={projectId}
        onChange={setProjectId}
        onAdd={addProject}
        onDelete={removeProject}
      />
      <FilterBar current={filter} onChange={setFilter} counts={counts} />
      <div className="content">
        <AddTodo onAdd={addTodo} />
        <TodoList
          todos={filteredTodos}
          loading={loading}
          onSetStatus={setStatus}
          onDelete={remove}
          onUpdate={update}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}

export default App;
