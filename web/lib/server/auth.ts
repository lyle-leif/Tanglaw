import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Staff sign-in: the social worker signs a one-time message with MetaMask. If the signing
// wallet is the `socialWorker` registered in the contract, she gets a signed session cookie.
// No passwords. The app never sees a private key, only a signature.

const COOKIE = "tanglaw_staff";
const SESSION_HOURS = 8;
// Shared across route bundles via globalThis (Next may load this module more than once).
// SESSION_SECRET is optional: without it a random one is made at start (sessions reset on restart).
const g = globalThis as unknown as { __tanglawAuth?: { secret: string; nonces: Map<string, number> } };
g.__tanglawAuth ??= { secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"), nonces: new Map() };
const SECRET = g.__tanglawAuth.secret;
const nonces = g.__tanglawAuth.nonces; // nonce -> expiry (ms)

export function signInMessage(address: string, nonce: string, issued: string) {
  return [
    "Tanglaw staff sign-in",
    "",
    "Sign this message to prove you control the social worker wallet.",
    "This does not send a transaction or cost any fee.",
    "",
    `Wallet: ${address.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `Issued: ${issued}`,
  ].join("\n");
}

export function issueNonce(): string {
  const now = Date.now();
  for (const [n, exp] of nonces) if (exp < now) nonces.delete(n);
  const nonce = crypto.randomBytes(16).toString("hex");
  nonces.set(nonce, now + 5 * 60_000);
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const exp = nonces.get(nonce);
  nonces.delete(nonce); // one use only
  return !!exp && exp > Date.now();
}

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function sessionToken(address: string): string {
  const payload = Buffer.from(JSON.stringify({ a: address.toLowerCase(), e: Date.now() + SESSION_HOURS * 3600_000 })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

export function setSessionCookie(res: NextResponse, address: string) {
  res.cookies.set(COOKIE, sessionToken(address), {
    httpOnly: true,
    sameSite: "lax",
    secure: !!process.env.VERCEL, // https on Vercel; plain http on the laptop or phone over Wi-Fi
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
}

/** The signed-in staff wallet, or null. */
export async function getStaff(): Promise<`0x${string}` | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const { a, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return e > Date.now() ? (a as `0x${string}`) : null;
  } catch {
    return null;
  }
}

export const notStaff = () => NextResponse.json({ error: "Social worker sign-in required." }, { status: 401 });
