import fs from "node:fs";
import os from "node:os";
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
  "SCHOOL_ADDRESS",
  "SCHOOL_LABEL",
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

// Phones on the same Wi-Fi open the dev server by the laptop's LAN IP (e.g. http://192.168.1.4:3000).
// Next.js blocks dev resources from other hostnames unless listed, which leaves the page half-loaded.
const lanIps = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanIps,
  // Old prototype paths -> the new per-user screens
  async redirects() {
    return [
      { source: "/chat", destination: "/student/chat", permanent: false },
      // Hospital-theme paths -> campus theme
      { source: "/family", destination: "/student", permanent: false },
      { source: "/family/:path*", destination: "/student/:path*", permanent: false },
      { source: "/review", destination: "/staff", permanent: false },
    ];
  },
};
export default nextConfig;
