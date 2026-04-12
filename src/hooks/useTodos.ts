import { useState, useEffect, useCallback } from "react";
import type { Todo, FilterMode } from "../lib/types";
import * as db from "../lib/db";

export function useTodos(filter?: FilterMode, projectId?: number) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await db.getAllTodos(filter, projectId);
      setTodos(data);
    } catch (e) {
      console.error("Failed to load todos:", e);
    } finally {
      setLoading(false);
    }
  }, [filter, projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addTodo = useCallback(
    async (title: string, priority?: string) => {
      await db.createTodo(title, projectId, priority);
      await refresh();
    },
    [projectId, refresh]
  );

  const toggle = useCallback(
    async (id: number) => {
      await db.toggleTodo(id);
      await refresh();
    },
    [refresh]
  );

  const setStatus = useCallback(
    async (id: number, status: number) => {
      await db.setTodoStatus(id, status);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await db.deleteTodo(id);
      await refresh();
    },
    [refresh]
  );

  const update = useCallback(
    async (id: number, updates: Partial<Todo>) => {
      await db.updateTodo(id, updates);
      await refresh();
    },
    [refresh]
  );

  return { todos, loading, addTodo, toggle, setStatus, remove, update, refresh };
}
