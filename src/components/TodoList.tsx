import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Todo } from "../lib/types";
import * as db from "../lib/db";
import { TodoItem } from "./TodoItem";

interface TodoListProps {
  todos: Todo[];
  loading: boolean;
  onSetStatus: (id: number, status: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

function SortableTodoItem(props: {
  todo: Todo;
  onSetStatus: (id: number, status: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, updates: Partial<Todo>) => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: props.todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TodoItem
        todo={props.todo}
        onSetStatus={props.onSetStatus}
        onDelete={props.onDelete}
        onUpdate={props.onUpdate}
      />
    </div>
  );
}

export function TodoList({
  todos,
  loading,
  onSetStatus,
  onDelete,
  onUpdate,
  onRefresh,
}: TodoListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading...</p>
      </div>
    );
  }

  // 0=ongoing, 1=done, 2=pending
  const active = todos.filter((t) => t.completed !== 1);
  const completed = todos.filter((t) => t.completed === 1);

  if (todos.length === 0) {
    return (
      <div className="empty-state">
        <p>No tasks yet</p>
        <p className="hint">Type above to add your first task</p>
      </div>
    );
  }

  return (
    <div className="todo-list">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={async (event: DragEndEvent) => {
          const { active: dragActive, over } = event;
          if (over && dragActive.id !== over.id) {
            const oldIndex = active.findIndex((t) => t.id === dragActive.id);
            const newIndex = active.findIndex((t) => t.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
              const reordered = arrayMove(active, oldIndex, newIndex);
              const updates = reordered
                .map((todo, i) => ({ id: todo.id, position: i }))
                .filter((u, i) => reordered[i].position !== u.position);
              await Promise.all(updates.map((u) => db.updateTodo(u.id, { position: u.position })));
              if (onRefresh) await onRefresh();
            }
          }
        }}
      >
        <SortableContext
          items={active.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {active.map((todo) => (
            <SortableTodoItem
              key={todo.id}
              todo={todo}
              onSetStatus={onSetStatus}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
        </SortableContext>
      </DndContext>

      {completed.length > 0 && (
        <>
          <div className="section-divider">
            <span>Done ({completed.length})</span>
          </div>
          {completed.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onSetStatus={onSetStatus}
              onDelete={onDelete}
              onUpdate={onUpdate}
            />
          ))}
        </>
      )}
    </div>
  );
}
