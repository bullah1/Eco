import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/components/pos/tasks-page";

export const Route = createFileRoute("/pos/tasks")({
  head: () => ({ meta: [{ title: "Tasks | Front Desk" }] }),
  component: TasksPage,
});
