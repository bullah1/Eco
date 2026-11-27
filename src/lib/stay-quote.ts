// Stay prices with seasonal / weekend rules (database function quote_stay).
// Until the rules are set up, or if the call fails, the normal nightly price is used,
// which is also what the database charges when there are no rules.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StayQuote = { total_cents: number; base_cents: number; nights: number };

/** Total for one room of each type for these dates. Missing types fall back to rate × nights. */
export function useStayQuotes(
  typeIds: string[],
  checkIn: string,
  checkOut: string,
  enabled = true,
) {
  const ids = [...new Set(typeIds)].sort();
  return useQuery({
    queryKey: ["stay-quotes", ids.join(","), checkIn, checkOut],
    enabled: enabled && ids.length > 0 && checkOut > checkIn,
    staleTime: 60_000,
    queryFn: async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const { data, error } = await supabase.rpc("quote_stay", {
            p_room_type: id,
            p_check_in: checkIn,
            p_check_out: checkOut,
          });
          if (error || !data) return null;
          return [id, data as StayQuote] as const;
        }),
      );
      return new Map(entries.filter((e): e is readonly [string, StayQuote] => e !== null));
    },
  });
}

/** Price of one room of a type: the quote when there is one, else rate × nights. */
export function roomPrice(
  quotes: Map<string, StayQuote> | undefined,
  typeId: string,
  rateCents: number,
  nights: number,
) {
  return quotes?.get(typeId)?.total_cents ?? rateCents * nights;
}

/** True when the dates include nights at a different price from normal. */
export function isSeasonal(quotes: Map<string, StayQuote> | undefined, typeId: string) {
  const q = quotes?.get(typeId);
  return Boolean(q && q.total_cents !== q.base_cents);
}
