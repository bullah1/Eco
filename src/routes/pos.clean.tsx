import { createFileRoute } from "@tanstack/react-router";
import { CleanerList } from "@/components/pos/housekeeping-page";

export const Route = createFileRoute("/pos/clean")({
  head: () => ({ meta: [{ title: "পরিষ্কারের তালিকা | Front Desk" }] }),
  component: CleanerList,
});
