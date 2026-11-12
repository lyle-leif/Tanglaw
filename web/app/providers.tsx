"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN } from "@/lib/chain";

// MetaMask (injected) on BSC testnet only. The wallet belongs to the social worker;
// the app never holds a key.
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  transports: { [CHAIN.id]: http() },
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
