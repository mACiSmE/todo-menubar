export interface Todo {
  id: number;
  title: string;
  description: string | null;
  completed: number; // SQLite uses 0/1
  priority: "low" | "medium" | "high";
  project_id: number | null;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  archived: number;
}

export interface Project {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  created_at: string;
}

export type FilterMode = "all" | "ongoing" | "pending" | "done";

// completed field: 0=ongoing, 1=done, 2=pending
export const STATUS_ONGOING = 0;
export const STATUS_DONE = 1;
export const STATUS_PENDING = 2;
