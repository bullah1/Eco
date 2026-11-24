import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { posError, rpc, usePosAction } from "@/lib/pos";
import { LoadState, PageTitle, Panel, usePos } from "./pos-shell";

export function StaffPage() {
  const { isAdmin, user } = usePos();
  const list = useQuery({
    queryKey: ["pos", "staff"],
    enabled: isAdmin,
    queryFn: () => rpc(supabase.rpc("pos_list_staff")),
  });
  const [email, setEmail] = useState("");
  const set = usePosAction((v: { email: string; on: boolean }) =>
    rpc(supabase.rpc("pos_set_staff", { p_email: v.email, p_is_staff: v.on })),
  );

  if (!isAdmin)
    return (
      <Panel>
        <p className="text-sm">Only an admin can manage staff.</p>
      </Panel>
    );

  return (
    <>
      <PageTitle
        title="Staff"
        sub="Who can use the front desk. Staff can check guests in and out, add to bills and take payments. Only admins can remove a line."
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="People with access">
          <LoadState
            isLoading={list.isLoading}
            error={list.error}
            retry={() => void list.refetch()}
          />
          <ul className="divide-y divide-pos-line">
            {(list.data ?? []).map((p) => (
              <li
                key={`${p.user_id}-${p.role}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.display_name || p.email}</span>
                  <span className="block truncate text-xs text-pos-muted">{p.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${p.role === "admin" ? "bg-pos-ocean text-white" : "bg-pos-teal-soft text-[#1f5e5c]"}`}
                  >
                    {p.role === "admin" ? "Admin" : "Staff"}
                  </span>
                  {p.role === "staff" && p.user_id !== user.id && (
                    <button
                      type="button"
                      aria-label={`Remove ${p.email}`}
                      disabled={set.isPending}
                      onClick={() =>
                        set.mutate(
                          { email: p.email, on: false },
                          {
                            onSuccess: () => toast.success(`${p.email} removed`),
                            onError: (e) => toast.error(posError(e)),
                          },
                        )
                      }
                      className="grid size-9 place-items-center rounded-md text-pos-muted hover:bg-red-50 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Add a staff member">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              set.mutate(
                { email: email.trim(), on: true },
                {
                  onSuccess: () => {
                    toast.success(`${email.trim()} can now use the front desk`);
                    setEmail("");
                  },
                  onError: (err) => toast.error(posError(err)),
                },
              );
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="staff-email">Their email</Label>
              <Input
                id="staff-email"
                type="email"
                className="h-11 text-base sm:text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <p className="text-xs text-pos-muted">
              They must sign up on the website first with this email. Then they open /pos and sign
              in.
            </p>
            <Button
              type="submit"
              disabled={set.isPending || !email.trim()}
              className="h-11 gap-2 bg-pos-ocean text-white hover:bg-pos-ocean/90"
            >
              {set.isPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <UserPlus size={16} />
              )}{" "}
              Add as staff
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
