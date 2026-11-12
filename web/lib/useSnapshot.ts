"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChainSnapshot } from "./chain";

/** Live chain state from /api/chain, refreshed every few seconds. */
export function useSnapshot(intervalMs = 6000) {
  return useQuery<ChainSnapshot>({
    queryKey: ["snapshot"],
    queryFn: async () => {
      const r = await fetch("/api/chain", { cache: "no-store" });
      if (!r.ok) throw new Error("Couldn't load chain data");
      return r.json();
    },
    refetchInterval: intervalMs,
  });
}
