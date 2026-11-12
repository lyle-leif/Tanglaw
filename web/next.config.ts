import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// The app reads settings from the repo-root .env (one file for contracts and web).
// Only these keys are loaded; the deployer key in that file is never read by the app.
const ALLOWED = [
  "BSC_TESTNET_RPC",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "ANTHROPIC_API_KEY",
  "LLM_API_KEY",
  "CLAUDE_MODEL",
  "TULONG_PROVIDERS",
  "VAULT_ADDRESS",
  "NEXT_PUBLIC_VAULT_ADDRESS",
  "VAULT_DEPLOY_BLOCK",
  "HOSPITAL_ADDRESS",
  "HOSPITAL_LABEL",
  "SESSION_SECRET",
];
try {
  const text = fs.readFileSync(path.join(process.cwd(), "..", ".env"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || !ALLOWED.includes(m[1]) || process.env[m[1]]) continue;
    const v = m[2].replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
    if (v && !v.endsWith("...")) process.env[m[1]] = v;
  }
} catch {
  // no root .env (e.g. hosted): use the host's environment variables
}

const nextConfig: NextConfig = {
  // Old prototype paths -> the new per-user screens
  async redirects() {
    return [
      { source: "/chat", destination: "/family/chat", permanent: false },
      { source: "/review", destination: "/staff", permanent: false },
    ];
  },
};
export default nextConfig;
