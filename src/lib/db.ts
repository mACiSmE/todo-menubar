import Database from "@tauri-apps/plugin-sql";
import type { Todo, Project, FilterMode } from "./types";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:todos.db");
  }
  return db;
}

export async function getAllTodos(
  filter?: FilterMode,
  projectId?: number
): Promise<Todo[]> {
  const d = await getDb();
  let query = "SELECT * FROM todos";
  const conditions: string[] = [];
  const params: unknown[] = [];

  // Only show non-archived tasks in main list
  conditions.push("archived = 0");

  // completed: 0=ongoing, 1=done, 2=pending
  if (filter === "ongoing") {
    conditions.push("completed = 0");
  } else if (filter === "pending") {
    conditions.push("completed = 2");
  } else if (filter === "done") {
    conditions.push("completed = 1");
  }

  if (projectId) {
    conditions.push("project_id = $1");
    params.push(projectId);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY completed ASC, created_at ASC";

  return d.select<Todo[]>(query, params);
}

export async function createTodo(
  title: string,
  projectId?: number,
  priority?: string
): Promise<Todo> {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO todos (title, project_id, priority) VALUES ($1, $2, $3)",
    [title, projectId ?? null, priority ?? "medium"]
  );
  const todos = await d.select<Todo[]>("SELECT * FROM todos WHERE id = $1", [
    result.lastInsertId,
  ]);
  return todos[0];
}

export async function updateTodo(
  id: number,
  updates: Partial<Pick<Todo, "title" | "description" | "priority" | "due_date" | "project_id" | "position">>
): Promise<void> {
  const d = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  const ALLOWED = new Set(["title", "description", "priority", "due_date", "project_id", "position"]);
  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED.has(key)) continue;
    fields.push(`${key} = $${paramIdx}`);
    values.push(value);
    paramIdx++;
  }

  fields.push(`updated_at = datetime('now')`);
  values.push(id);

  await d.execute(
    `UPDATE todos SET ${fields.join(", ")} WHERE id = $${paramIdx}`,
    values
  );
}

export async function toggleTodo(id: number): Promise<void> {
  const d = await getDb();
  await d.execute(
    "UPDATE todos SET completed = CASE WHEN completed = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = $1",
    [id]
  );
}

export async function setTodoStatus(id: number, status: number): Promise<void> {
  const d = await getDb();
  // status 1 = done: record completed_at; otherwise clear it
  if (status === 1) {
    await d.execute(
      "UPDATE todos SET completed = $1, completed_at = datetime('now','localtime'), updated_at = datetime('now') WHERE id = $2",
      [status, id]
    );
  } else {
    await d.execute(
      "UPDATE todos SET completed = $1, completed_at = NULL, updated_at = datetime('now') WHERE id = $2",
      [status, id]
    );
  }
}

/** Get available archive months (YYYY-MM) for archived done tasks */
export async function getArchiveMonths(): Promise<string[]> {
  const d = await getDb();
  const rows = await d.select<{ month: string }[]>(
    "SELECT DISTINCT strftime('%Y-%m', completed_at) as month FROM todos WHERE archived = 1 AND completed_at IS NOT NULL ORDER BY month DESC"
  );
  return rows.map((r) => r.month);
}

/** Get archived todos for a specific month */
export async function getArchivedTodos(month: string): Promise<Todo[]> {
  const d = await getDb();
  return d.select<Todo[]>(
    "SELECT * FROM todos WHERE archived = 1 AND strftime('%Y-%m', completed_at) = $1 ORDER BY completed_at DESC",
    [month]
  );
}

/**
 * Auto-archive: mark done tasks from previous months as archived.
 * Runs on app startup and periodically.
 * Archives done tasks where completed_at is before the 1st of current month (UTC+8).
 */
export async function runAutoArchive(): Promise<number> {
  const d = await getDb();
  // Get 1st day of current month in local time
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;

  const result = await d.execute(
    "UPDATE todos SET archived = 1 WHERE completed = 1 AND archived = 0 AND completed_at IS NOT NULL AND completed_at < $1",
    [firstOfMonth]
  );
  return result.rowsAffected;
}

export async function deleteTodo(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM todos WHERE id = $1", [id]);
}

export async function getAllProjects(): Promise<Project[]> {
  const d = await getDb();
  return d.select<Project[]>(
    "SELECT * FROM projects ORDER BY position ASC"
  );
}

export async function createProject(
  name: string,
  color: string,
  icon?: string
): Promise<Project> {
  const d = await getDb();
  const result = await d.execute(
    "INSERT INTO projects (name, color, icon) VALUES ($1, $2, $3)",
    [name, color, icon ?? null]
  );
  const projects = await d.select<Project[]>(
    "SELECT * FROM projects WHERE id = $1",
    [result.lastInsertId]
  );
  return projects[0];
}

export async function deleteProject(id: number): Promise<void> {
  const d = await getDb();
  await d.execute("DELETE FROM projects WHERE id = $1", [id]);
}
