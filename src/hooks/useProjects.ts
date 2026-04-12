import { useState, useEffect, useCallback } from "react";
import type { Project } from "../lib/types";
import * as db from "../lib/db";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await db.getAllProjects();
      setProjects(data);
    } catch (e) {
      console.error("Failed to load projects:", e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addProject = useCallback(
    async (name: string, color: string, icon?: string) => {
      await db.createProject(name, color, icon);
      await refresh();
    },
    [refresh]
  );

  const removeProject = useCallback(
    async (id: number) => {
      await db.deleteProject(id);
      await refresh();
    },
    [refresh]
  );

  return { projects, addProject, removeProject, refresh };
}
