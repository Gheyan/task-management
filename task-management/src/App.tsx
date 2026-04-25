import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Task, Status } from "./types";
import { COLUMNS } from "./types";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";

import type { DragEndEvent } from "@dnd-kit/core";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ================= COLUMN CONFIG =================
type ColumnTheme = {
  label: string;
  dot: string;
  badgeBg: string;
  badgeText: string;
  columnBg: string;
  columnBorder: string;
  headerText: string;
  divider: string;
  ring: string;
};

const COLUMN_THEME: Record<string, ColumnTheme> = {
  todo: {
    label: "To Do",
    dot: "bg-zinc-400",
    badgeBg: "bg-zinc-200",
    badgeText: "text-zinc-600",
    columnBg: "bg-zinc-50",
    columnBorder: "border-zinc-200",
    headerText: "text-zinc-500",
    divider: "border-zinc-200",
    ring: "ring-zinc-400",
  },
  "in-progress": {
    label: "In Progress",
    dot: "bg-amber-400",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    columnBg: "bg-amber-50",
    columnBorder: "border-amber-200",
    headerText: "text-amber-600",
    divider: "border-amber-200",
    ring: "ring-amber-400",
  },
  done: {
    label: "Done",
    dot: "bg-emerald-400",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    columnBg: "bg-emerald-50",
    columnBorder: "border-emerald-200",
    headerText: "text-emerald-600",
    divider: "border-emerald-200",
    ring: "ring-emerald-400",
  },
};

// ================= CARD =================
function Card({
  task,
  onDelete,
}: {
  task: Task;
  onDelete: (id: string) => void;
}) {
  const {
    setNodeRef,
    listeners,
    attributes,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all duration-150"
    >
      {/* Drag handle only — listeners scoped here */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex-1 text-sm text-gray-700 select-none"
      >
        {task.title}
      </div>

      {/* Delete — stops pointer event so drag never fires */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
        className="
          w-6 h-6 flex-shrink-0 flex items-center justify-center
          rounded bg-gray-100 text-gray-400
          hover:bg-red-500 hover:text-white
          opacity-0 group-hover:opacity-100
          transition-all duration-150
          text-xs font-bold leading-none
        "
      >
        ✕
      </button>
    </div>
  );
}

// ================= COLUMN =================
function Column({
  id,
  tasks,
  children,
}: {
  id: string;
  tasks: Task[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const theme = COLUMN_THEME[id];

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col border-2 rounded-2xl p-4 min-h-[500px]
        transition-all duration-150
        ${theme.columnBg} ${theme.columnBorder}
        ${isOver ? `ring-2 ring-offset-2 ${theme.ring}` : ""}
      `}
    >
      {/* Header — identical structure for all columns */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${theme.dot}`} />
        <h2 className={`text-xs font-semibold tracking-widest uppercase flex-1 ${theme.headerText}`}>
          {theme.label}
        </h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.badgeText}`}>
          {tasks.length}
        </span>
      </div>

      {/* Divider */}
      <div className={`border-t mb-3 ${theme.divider}`} />

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {children}
      </div>
    </div>
  );
}

// ================= APP =================
export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [input, setInput] = useState("");
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const fetchTasks = async () => {
    const { data } = await supabase.from("tasks").select("*");
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel("tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const add = async () => {
    if (!input.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: input.trim(),
      status: "todo",
    };
    setTasks((prev) => [...prev, newTask]);
    setInput("");
    await supabase.from("tasks").insert(newTask);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") add();
  };

  const remove = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeTaskData = tasks.find((t) => t.id === active.id);
    if (!activeTaskData) return;

    const overId = over.id as string;
    let newStatus: Status | null = null;

    if (COLUMNS.includes(overId as Status)) {
      newStatus = overId as Status;
    } else {
      const targetTask = tasks.find((t) => t.id === overId);
      if (targetTask) newStatus = targetTask.status;
    }

    if (!newStatus || newStatus === activeTaskData.status) return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeTaskData.id ? { ...t, status: newStatus! } : t
      )
    );

    await supabase
      .from("tasks")
      .update({ status: newStatus })
      .eq("id", activeTaskData.id);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Task Board</h1>
          <p className="text-sm text-gray-400 mt-1">Drag cards to update their status</p>
        </div>

        {/* Input */}
        <div className="flex gap-2 mb-6">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white"
            placeholder="Add a new task and press Enter..."
          />
          <button
            onClick={add}
            disabled={!input.trim()}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>

        {/* Board */}
        {loading ? (
          <div className="text-center text-sm text-gray-400 py-20">Loading tasks...</div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={(e) => {
              const t = tasks.find((x) => x.id === e.active.id);
              setActiveTask(t || null);
            }}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveTask(null)}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => t.status === col);
                return (
                  <Column key={col} id={col} tasks={colTasks}>
                    {colTasks.map((task) => (
                      <Card key={task.id} task={task} onDelete={remove} />
                    ))}
                  </Column>
                );
              })}
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="px-3 py-2.5 bg-white border border-gray-300 rounded-lg shadow-xl text-sm text-gray-700 rotate-1">
                  {activeTask.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}