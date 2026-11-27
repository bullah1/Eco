import { describe, expect, it } from "vitest";
import { dueLabel, groupOpenTasks, taskCounts, type PosTask } from "./pos-tasks";

const T = "2026-11-27";
const task = (id: string, extra: Partial<PosTask> = {}): PosTask => ({
  id,
  task_no: `T${id}`,
  title: `Task ${id}`,
  detail: "",
  kind: "task",
  priority: "normal",
  room_unit_id: null,
  blocks_room: false,
  assigned_to: null,
  assigned_name: "",
  due_date: null,
  status: "open",
  created_by_name: "Desk",
  created_at: `2026-11-2${id}T05:00:00Z`,
  done_at: null,
  done_by_name: "",
  done_note: "",
  ...extra,
});

describe("tasks", () => {
  const list = [
    task("1", { due_date: "2026-11-25" }),
    task("2", { priority: "urgent", due_date: "2026-11-30" }),
    task("3", { due_date: T, status: "in_progress" }),
    task("4"),
    task("5", { due_date: "2026-12-01", kind: "repair", room_unit_id: "r1", blocks_room: true }),
    task("6", { status: "done" }),
  ];
  it("puts the most pressing work first", () => {
    expect(groupOpenTasks(list, T).map((g) => [g.title, g.tasks.map((t) => t.id)])).toEqual([
      ["Urgent", ["2"]],
      ["Overdue", ["1"]],
      ["Today", ["3"]],
      ["Later", ["5", "4"]],
    ]);
  });
  it("counts what is open", () => {
    expect(taskCounts(list, T)).toEqual({ open: 5, urgent: 1, overdue: 1, roomsBlocked: 1 });
  });
  it("says when it is due", () => {
    expect(dueLabel(null, T).text).toBe("No date");
    expect(dueLabel("2026-11-25", T)).toEqual({ text: "Overdue 2 days", late: true });
    expect(dueLabel(T, T).text).toBe("Due today");
    expect(dueLabel("2026-11-28", T).text).toBe("Due tomorrow");
  });
});
