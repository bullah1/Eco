// Staff tasks, repairs and guest requests.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, nights } from "./pos";

export type TaskKind = "task" | "repair" | "guest_request";
export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type PosTask = {
  id: string;
  task_no: string;
  title: string;
  detail: string;
  kind: TaskKind;
  priority: "normal" | "urgent";
  room_unit_id: string | null;
  blocks_room: boolean;
  assigned_to: string | null;
  assigned_name: string;
  due_date: string | null;
  status: TaskStatus;
  created_by_name: string;
  created_at: string;
  done_at: string | null;
  done_by_name: string;
  done_note: string;
};

export const kindLabel: Record<TaskKind, string> = {
  task: "Task",
  repair: "Repair",
  guest_request: "Guest request",
};

export type TaskGroup = { key: string; title: string; tasks: PosTask[] };

/** When is it due, in words: "Due today", "Overdue 2 days", "Due 3 Dec", "No date". */
export function dueLabel(due: string | null, today: string, fmt: (d: string) => string = (d) => d) {
  if (!due) return { text: "No date", late: false };
  if (due < today) {
    const n = nights(due, today);
    return { text: `Overdue ${n} ${n === 1 ? "day" : "days"}`, late: true };
  }
  if (due === today) return { text: "Due today", late: false };
  if (due === addDays(today, 1)) return { text: "Due tomorrow", late: false };
  return { text: `Due ${fmt(due)}`, late: false };
}

/** Open work, most pressing first: urgent, overdue, today, later. */
export function groupOpenTasks(tasks: PosTask[], today: string): TaskGroup[] {
  const open = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const byDue = (a: PosTask, b: PosTask) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    a.created_at.localeCompare(b.created_at);
  const groups: TaskGroup[] = [
    { key: "urgent", title: "Urgent", tasks: open.filter((t) => t.priority === "urgent") },
    {
      key: "overdue",
      title: "Overdue",
      tasks: open.filter(
        (t) => t.priority !== "urgent" && t.due_date !== null && t.due_date < today,
      ),
    },
    {
      key: "today",
      title: "Today",
      tasks: open.filter((t) => t.priority !== "urgent" && t.due_date === today),
    },
    {
      key: "later",
      title: "Later",
      tasks: open.filter(
        (t) => t.priority !== "urgent" && (t.due_date === null || t.due_date > today),
      ),
    },
  ];
  for (const g of groups) g.tasks.sort(byDue);
  return groups.filter((g) => g.tasks.length > 0);
}

export function taskCounts(tasks: PosTask[], today: string) {
  const open = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  return {
    open: open.length,
    urgent: open.filter((t) => t.priority === "urgent").length,
    overdue: open.filter((t) => t.due_date !== null && t.due_date < today).length,
    roomsBlocked: new Set(open.filter((t) => t.blocks_room).map((t) => t.room_unit_id)).size,
  };
}

const cols =
  "id, task_no, title, detail, kind, priority, room_unit_id, blocks_room, assigned_to, assigned_name, due_date, status, created_by_name, created_at, done_at, done_by_name, done_note";

/** Open work plus everything finished in the last 14 days. */
export function useTasks(today: string) {
  return useQuery({
    queryKey: ["pos", "tasks", today],
    refetchInterval: 20_000,
    queryFn: async () => {
      const [open, done] = await Promise.all([
        supabase
          .from("pos_tasks")
          .select(cols)
          .in("status", ["open", "in_progress"])
          .order("created_at")
          .limit(500),
        supabase
          .from("pos_tasks")
          .select(cols)
          .in("status", ["done", "cancelled"])
          .gte("done_at", `${addDays(today, -14)}T00:00:00+06:00`)
          .order("done_at", { ascending: false })
          .limit(300),
      ]);
      if (open.error) throw open.error;
      if (done.error) throw done.error;
      return [...(open.data ?? []), ...(done.data ?? [])] as PosTask[];
    },
  });
}

export function useStaffNames() {
  return useQuery({
    queryKey: ["pos", "staff-names"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_staff_names");
      if (error) throw error;
      return (data ?? []) as { user_id: string; name: string }[];
    },
  });
}
