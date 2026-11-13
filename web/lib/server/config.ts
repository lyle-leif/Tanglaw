import "server-only";
import fs from "node:fs";
import path from "node:path";
import { isAddress } from "viem";

// Vault address and deploy block come from .env, or, on the builder's laptop, from the
// Foundry broadcast file written by `forge script ... --broadcast`. No keys are read here.

export interface VaultConfig {
  vault: `0x${string}` | null;
  deployBlock: bigint | null;
  rpc: string;
  schoolLabel: string;
}

const BROADCAST = path.join(process.cwd(), "..", "contracts", "broadcast", "Deploy.s.sol", "97", "run-latest.json");

function fromBroadcast(): { vault?: `0x${string}`; block?: bigint } {
  try {
    const run = JSON.parse(fs.readFileSync(BROADCAST, "utf8"));
    const create = (run.transactions ?? []).find(
      (t: { transactionType?: string; contractName?: string }) =>
        t.transactionType === "CREATE" && t.contractName === "TanglawVault",
    );
    if (!create?.contractAddress) return {};
    const receipt = (run.receipts ?? []).find((r: { transactionHash?: string }) => r.transactionHash === create.hash);
    return {
      vault: create.contractAddress,
      block: receipt?.blockNumber ? BigInt(receipt.blockNumber) : undefined,
    };
  } catch {
    return {};
  }
}

export function getConfig(): VaultConfig {
  const b = fromBroadcast();
  const envVault = process.env.VAULT_ADDRESS || process.env.NEXT_PUBLIC_VAULT_ADDRESS;
  const vault = envVault && isAddress(envVault) ? (envVault as `0x${string}`) : (b.vault ?? null);
  const envBlock = process.env.VAULT_DEPLOY_BLOCK;
  const deployBlock = envBlock && /^\d+$/.test(envBlock) ? BigInt(envBlock) : (b.block ?? null);
  return {
    vault,
    deployBlock,
    rpc: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    schoolLabel: process.env.SCHOOL_LABEL || "State University · Cashier (demo)",
  };
}
