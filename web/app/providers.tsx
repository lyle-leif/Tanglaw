"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { fallback } from "viem";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN, FALLBACK_RPC } from "@/lib/chain";

// MetaMask (injected) on BSC testnet only. The wallet belongs to the social worker;
// the app never holds a key.
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  // viem's default BSC testnet RPC first, then a backup if it fails or times out
  transports: { [CHAIN.id]: fallback([http(undefined, { timeout: 8_000 }), http(FALLBACK_RPC, { timeout: 8_000 })]) },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
