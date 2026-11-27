import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ClipboardList,
  ConciergeBell,
  LoaderCircle,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Wrench,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  posError,
  resortToday,
  rpc,
  shortDate,
  shortDateTime,
  useBoardData,
  usePosAction,
} from "@/lib/pos";
import {
  dueLabel,
  groupOpenTasks,
  kindLabel,
  taskCounts,
  useStaffNames,
  useTasks,
  type PosTask,
  type TaskKind,
} from "@/lib/pos-tasks";
import { LoadState, PageTitle, Panel } from "./pos-shell";

const kindIcon = { task: ClipboardList, repair: Wrench, guest_request: ConciergeBell } as const;

type View = "open" | "mine" | "done";

export function TasksPage() {
  const today = resortToday();
  const q = useTasks(today);
  const board = useBoardData();
  const staff = useStaffNames();
  const [me, setMe] = useState<string | null>(null);
  const [view, setView] = useState<View>("open");
  const [kind, setKind] = useState<"all" | TaskKind>("all");
  const [editing, setEditing] = useState<PosTask | "new" | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const roomName = useMemo(() => {
    const m = new Map((board.data?.units ?? []).map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? (m.get(id) ?? "Room") : null);
  }, [board.data]);

  const all = q.data ?? [];
  const ofKind = all.filter((t) => kind === "all" || t.kind === kind);
  const counts = taskCounts(all, today);
  const mineCount = all.filter(
    (t) => (t.status === "open" || t.status === "in_progress") && t.assigned_to === me,
  ).length;
  const groups =
    view === "done"
      ? []
      : groupOpenTasks(
          view === "mine" ? ofKind.filter((t) => t.assigned_to === me) : ofKind,
          today,
        );
  const done = ofKind.filter((t) => t.status === "done" || t.status === "cancelled");

  return (
    <>
      <PageTitle
        title="Tasks"
        sub="Jobs for the team: tasks, repairs and guest requests. A repair can take its room out of order until it is fixed."
        actions={
          <Button
            onClick={() => setEditing("new")}
            className="h-11 gap-2 bg-pos-gold px-5 font-semibold text-pos-ocean hover:bg-pos-gold/85"
          >
            <Plus size={18} /> New task
          </Button>
        }
      />

      <section aria-label="Totals" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Count label="Open" value={counts.open} />
        <Count label="Urgent" value={counts.urgent} warn={counts.urgent > 0} />
        <Count label="Overdue" value={counts.overdue} warn={counts.overdue > 0} />
        <Count label="Rooms out of order for repair" value={counts.roomsBlocked} />
      </section>

      <Panel>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Which tasks"
            className="flex rounded-full bg-pos-ground p-1"
          >
            {(
              [
                ["open", `Open · ${counts.open}`],
                ["mine", `Mine · ${mineCount}`],
                ["done", "Done (14 days)"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`h-9 rounded-full px-4 text-sm ${view === id ? "bg-pos-ocean text-white" : "text-pos-muted hover:text-pos-ink"}`}
              >
                {text}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Type" className="flex flex-wrap gap-1.5">
            {(["all", "task", "repair", "guest_request"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={`h-9 rounded-full border px-3.5 text-sm ${kind === k ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line hover:border-pos-ocean"}`}
              >
                {k === "all" ? "All types" : `${kindLabel[k]}s`}
              </button>
            ))}
          </div>
        </div>

        <LoadState isLoading={q.isLoading} error={q.error} retry={() => void q.refetch()} />

        {q.data && view !== "done" && groups.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-pos-muted">
              {view === "mine" ? "Nothing is assigned to you." : "No open tasks. All done."}
            </p>
            <Button variant="outline" className="mt-3 h-10 gap-2" onClick={() => setEditing("new")}>
              <Plus size={16} /> New task
            </Button>
          </div>
        )}

        <div className="grid gap-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.title}>
              <h2
                className={`mb-2 text-xs font-medium tracking-[0.08em] uppercase ${g.key === "urgent" || g.key === "overdue" ? "text-red-700" : "text-pos-muted"}`}
              >
                {g.title} · {g.tasks.length}
              </h2>
              <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {g.tasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    today={today}
                    room={roomName(t.room_unit_id)}
                    onEdit={() => setEditing(t)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        {view === "done" && q.data && (
          <ul className="divide-y divide-pos-line">
            {done.length === 0 && (
              <li className="py-10 text-center text-sm text-pos-muted">
                Nothing finished in the last 14 days.
              </li>
            )}
            {done.map((t) => (
              <DoneRow key={t.id} task={t} room={roomName(t.room_unit_id)} />
            ))}
          </ul>
        )}
      </Panel>

      <TaskDialog
        task={editing}
        units={board.data?.units ?? []}
        staff={staff.data ?? []}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function Count({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-pos-line bg-white px-4 py-3">
      <p className="truncate text-[11px] font-medium tracking-[0.08em] text-pos-muted uppercase">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-[28px] leading-none font-medium tabular-nums ${warn ? "text-red-700" : "text-pos-ink"}`}
      >
        {value}
      </p>
    </div>
  );
}

function TaskCard({
  task: t,
  today,
  room,
  onEdit,
}: {
  task: PosTask;
  today: string;
  room: string | null;
  onEdit: () => void;
}) {
  const Icon = kindIcon[t.kind];
  const due = dueLabel(t.due_date, today, shortDate);
  const [finishing, setFinishing] = useState(false);
  const [note, setNote] = useState("");
  const set = usePosAction((v: { status: string; note: string }) =>
    rpc(supabase.rpc("pos_task_set_status", { p_id: t.id, p_status: v.status, p_note: v.note })),
  );
  const go = (status: string, msg: string) =>
    set.mutate(
      { status, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(msg);
          setFinishing(false);
          setNote("");
        },
        onError: (e) => toast.error(posError(e)),
      },
    );

  return (
    <li
      className={`flex flex-col rounded-xl border bg-white p-4 ${t.priority === "urgent" ? "border-red-300" : "border-pos-line"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${t.kind === "repair" ? "bg-[#f3e6cf] text-[#4d3a17]" : t.kind === "guest_request" ? "bg-pos-teal-soft text-pos-ocean" : "bg-pos-ground text-pos-ink"}`}
        >
          <Icon size={17} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{t.title}</p>
          <p className="mt-0.5 text-xs text-pos-muted">
            {kindLabel[t.kind]} · {t.task_no}
            {t.status === "in_progress" && (
              <span className="font-medium text-pos-teal"> · Started</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Change ${t.title}`}
          className="grid size-8 shrink-0 place-items-center rounded-md text-pos-muted hover:bg-pos-ground hover:text-pos-ink"
        >
          <Pencil size={15} />
        </button>
      </div>
      {t.detail && <p className="mt-2 text-sm whitespace-pre-line text-pos-muted">{t.detail}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        {room && <span className="rounded-full bg-pos-ground px-2.5 py-1 font-medium">{room}</span>}
        {t.blocks_room && (
          <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-800">
            Out of order
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 ${due.late ? "bg-red-50 font-medium text-red-800" : "bg-pos-ground text-pos-muted"}`}
        >
          {due.text}
        </span>
        <span className="text-pos-muted">
          {t.assigned_name ? `→ ${t.assigned_name}` : "Anyone"}
        </span>
      </div>
      <p className="mt-2 text-[11px] text-pos-muted">
        Added {shortDateTime(t.created_at)}
        {t.created_by_name && ` by ${t.created_by_name}`}
      </p>

      {finishing ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go("done", `${t.task_no} done`);
          }}
        >
          <Input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was done (optional)"
            aria-label="What was done"
            className="h-10 text-base sm:text-sm"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1"
              onClick={() => setFinishing(false)}
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={set.isPending}
              className="h-10 flex-1 gap-1.5 bg-pos-ocean text-white hover:bg-pos-ocean/90"
            >
              {set.isPending ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              Mark done
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          {t.status === "open" && (
            <Button
              variant="outline"
              className="h-10 flex-1 gap-1.5"
              disabled={set.isPending}
              onClick={() => go("in_progress", `${t.task_no} started`)}
            >
              <Play size={14} /> Start
            </Button>
          )}
          <Button
            className="h-10 flex-1 gap-1.5 bg-pos-ocean text-white hover:bg-pos-ocean/90"
            onClick={() => setFinishing(true)}
          >
            <Check size={15} /> Done
          </Button>
        </div>
      )}
    </li>
  );
}

function DoneRow({ task: t, room }: { task: PosTask; room: string | null }) {
  const Icon = kindIcon[t.kind];
  const reopen = usePosAction(() =>
    rpc(supabase.rpc("pos_task_set_status", { p_id: t.id, p_status: "open", p_note: "" })),
  );
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-pos-muted" />
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${t.status === "cancelled" ? "text-pos-muted line-through" : ""}`}
        >
          {t.title}
          {room && <span className="font-normal text-pos-muted"> · {room}</span>}
        </p>
        <p className="text-xs text-pos-muted">
          {t.status === "cancelled" ? "Cancelled" : "Done"} {t.done_at && shortDateTime(t.done_at)}
          {t.done_by_name && ` by ${t.done_by_name}`}
          {t.done_note && ` · ${t.done_note}`}
        </p>
      </div>
      <Button
        variant="ghost"
        className="h-8 gap-1 px-2 text-xs text-pos-muted"
        disabled={reopen.isPending}
        onClick={() =>
          reopen.mutate(undefined, {
            onSuccess: () => toast.success(`${t.task_no} reopened`),
            onError: (e) => toast.error(posError(e)),
          })
        }
      >
        <RotateCcw size={13} /> Reopen
      </Button>
    </li>
  );
}

function TaskDialog({
  task,
  units,
  staff,
  onClose,
}: {
  task: PosTask | "new" | null;
  units: { id: string; name: string; is_active: boolean }[];
  staff: { user_id: string; name: string }[];
  onClose: () => void;
}) {
  const isNew = task === "new";
  const existing = task && task !== "new" ? task : null;
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<TaskKind>("task");
  const [urgent, setUrgent] = useState(false);
  const [room, setRoom] = useState("");
  const [blocks, setBlocks] = useState(false);
  const [who, setWho] = useState("");
  const [due, setDue] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!task) return;
    const t = task === "new" ? null : task;
    setTitle(t?.title ?? "");
    setDetail(t?.detail ?? "");
    setKind(t?.kind ?? "task");
    setUrgent(t?.priority === "urgent");
    setRoom(t?.room_unit_id ?? "");
    setBlocks(t?.blocks_room ?? false);
    setWho(t?.assigned_to ?? "");
    setDue(t?.due_date ?? (task === "new" ? resortToday() : ""));
    setCancelling(false);
    setReason("");
  }, [task]);

  const save = usePosAction(() =>
    rpc(
      supabase.rpc("pos_task_save", {
        p_id: existing?.id ?? null,
        p_title: title.trim(),
        p_detail: detail.trim(),
        p_kind: kind,
        p_priority: urgent ? "urgent" : "normal",
        p_room: room || null,
        p_assignee: who || null,
        p_due: due || null,
        p_blocks_room: kind === "repair" && Boolean(room) && blocks,
      }),
    ),
  );
  const cancel = usePosAction(() =>
    rpc(
      supabase.rpc("pos_task_set_status", {
        p_id: existing!.id,
        p_status: "cancelled",
        p_note: reason.trim(),
      }),
    ),
  );

  return (
    <Dialog open={Boolean(task)} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto font-sans sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "New task" : `Change ${existing?.task_no}`}</DialogTitle>
          <DialogDescription>Say what needs doing, where, and who should do it.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(undefined, {
              onSuccess: () => {
                toast.success(isNew ? "Task added" : "Task saved");
                onClose();
              },
              onError: (err) => toast.error(posError(err)),
            });
          }}
        >
          <div role="group" aria-label="Type" className="grid grid-cols-3 gap-1.5">
            {(["task", "repair", "guest_request"] as const).map((k) => {
              const Icon = kindIcon[k];
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm ${kind === k ? "border-pos-ocean bg-pos-ocean text-white" : "border-pos-line hover:border-pos-ocean"}`}
                >
                  <Icon size={15} /> {kindLabel[k]}
                </button>
              );
            })}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tk-title">What needs doing</Label>
            <Input
              id="tk-title"
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                kind === "repair"
                  ? "AC not cooling"
                  : kind === "guest_request"
                    ? "Extra towels and a pillow"
                    : "Clean the beach chairs"
              }
              className="h-11 text-base sm:text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tk-room">
                Room <span className="font-normal text-pos-muted">(optional)</span>
              </Label>
              <select
                id="tk-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="h-11 rounded-md border border-pos-line bg-white px-2.5 text-base sm:text-sm"
              >
                <option value="">No room</option>
                {units
                  .filter((u) => u.is_active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tk-who">Who does it</Label>
              <select
                id="tk-who"
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="h-11 rounded-md border border-pos-line bg-white px-2.5 text-base sm:text-sm"
              >
                <option value="">Anyone</option>
                {staff.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tk-due">
                Due <span className="font-normal text-pos-muted">(optional)</span>
              </Label>
              <Input
                id="tk-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="h-11 text-base sm:text-sm"
              />
            </div>
            <label className="flex items-center gap-2.5 self-end rounded-lg border border-pos-line px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="size-4 accent-red-700"
              />
              Urgent
            </label>
          </div>
          {kind === "repair" && room && (
            <label className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/60 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={blocks}
                onChange={(e) => setBlocks(e.target.checked)}
                className="mt-0.5 size-4 accent-red-700"
              />
              <span>
                Take the room out of order until it is fixed
                <span className="block text-xs text-pos-muted">
                  It can't be booked meanwhile. When the repair is done the room is marked for
                  cleaning.
                </span>
              </span>
            </label>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="tk-detail">
              Details <span className="font-normal text-pos-muted">(optional)</span>
            </Label>
            <textarea
              id="tk-detail"
              value={detail}
              maxLength={1000}
              rows={3}
              onChange={(e) => setDetail(e.target.value)}
              className="rounded-md border border-pos-line px-3 py-2 text-base sm:text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {existing && !cancelling ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 gap-1.5 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setCancelling(true)}
              >
                <X size={15} /> Cancel task
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              disabled={save.isPending || title.trim().length < 2}
              className="h-11 gap-2 bg-pos-ocean px-6 text-white hover:bg-pos-ocean/90"
            >
              {save.isPending && <LoaderCircle size={16} className="animate-spin" />}
              {isNew ? "Add task" : "Save"}
            </Button>
          </div>
        </form>
        {existing && cancelling && (
          <form
            className="grid gap-2 rounded-lg border border-red-200 bg-red-50/60 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              cancel.mutate(undefined, {
                onSuccess: () => {
                  toast.success(`${existing.task_no} cancelled`);
                  onClose();
                },
                onError: (err) => toast.error(posError(err)),
              });
            }}
          >
            <Label htmlFor="tk-reason" className="text-red-900">
              Why cancel it?
            </Label>
            <Input
              id="tk-reason"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Not needed any more"
              className="h-10 bg-white text-base sm:text-sm"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1"
                onClick={() => setCancelling(false)}
              >
                Keep it
              </Button>
              <Button
                type="submit"
                disabled={cancel.isPending || reason.trim().length < 3}
                className="h-10 flex-1 bg-red-700 text-white hover:bg-red-800"
              >
                Cancel task
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
