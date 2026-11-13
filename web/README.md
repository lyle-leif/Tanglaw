# Tanglaw web app

Next.js (App Router) + wagmi/viem. Tulong (the AI) runs on free tiers: Gemini first, Groq as fallback, Claude optional. Same design and demo story as `design/prototype.html`. All buttons and labels are in English; only Tulong's replies follow the family's language setting (Taglish by default, or English, or Filipino).

| Route | Who | Sign-in | What they see |
|---|---|---|---|
| `/` | Everyone | none | Pick: family, social worker, or public record. |
| `/family` → `/family/chat` | Ana (family) | **Case code** from the social worker (`TGL-XXX-XXX`), saved on her phone | Chat with Tulong, program and checklist cards, her own case's status and the paid card. Only her case. ⚙ Settings: Tulong's language, clear chat, leave case. No wallet. |
| `/staff` | Ma'am Liza (social worker) | **MetaMask**: she signs a free one-time message; the server checks the wallet is the contract's `socialWorker` and sets an 8-hour cookie | Opens cases (types the bill, optional memo) and gets the family code to give Ana, asks Tulong to draft, edits amounts, signs `approveAndPay`. |
| `/activity` | Public | none | Counter ("₱X paid · Y refused by the rules"), every `Paid` event, every refused payment with the contract's reason and its failed tx, budgets left per program, BscScan links. No names. |
| `/receipt/[tx]` | Public (Ana's "View receipt") | none | One payment: lines, hospital, time, printable. **✓ Plan matches the blockchain**: the browser reads the receipt straight from BSC testnet and compares the on-chain `planHash` with the fingerprint of the approved plan. |

Only the social worker has a wallet because only she approves payments, and the contract checks her address. The family never signs anything. Old paths `/chat` and `/review` redirect to the new ones.

## Run

```bash
# 1. Deploy the contract first (contracts/README.md). The app finds the vault address and
#    deploy block in contracts/broadcast/... automatically.
# 2. Add GEMINI_API_KEY (aistudio.google.com) and GROQ_API_KEY (console.groq.com) to the repo-root .env
cd web
npm install
npm run dev        # http://localhost:3000
```

## Demo setup (before going on stage)

1. MetaMask: Approver account (the social worker address from deploy), BSC testnet.
2. `/staff` → **Connect MetaMask** → **Sign in** (free message signature).
3. **+ Open a case** → ₱80,000, no memo → sign. This is **Case A** (Ana's case). Note the **family code** shown after it opens.
4. **+ Open a case** → ₱80,000, **Use demo memo** → sign. This is **Case B**.
5. On each case, **Draft with Tulong**. Case B's draft should show the amber "ignored an instruction" box.
6. On the phone (or another browser): `/family` → enter Case A's code → send Ana's message once so the chat is preloaded (kept in that browser).

On stage: family chat → staff Case A → Sign → Case B, set PhilHealth to 200000 → Sign → refused (`OverProgramCap`) → `/activity`.

## Tulong module (`lib/tulong/`)

The app calls only `chat()` and `draft()` from `lib/tulong/index.ts` (through `/api/assistant`).

| File | Job |
|---|---|
| `index.ts` | `chat(history, code, lang)`, `draft(caseId)`: the only entry points |
| `core.ts` | Tool loop (max 8 steps) and provider fallback |
| `tools.ts`, `prompts.ts` | Tool definitions and system prompts, shared by all providers |
| `providers/gemini.ts` | Main (free tier) |
| `providers/groq.ts` | Fallback (free tier) |
| `providers/claude.ts` | Optional, paid. Skipped unless `ANTHROPIC_API_KEY` is set |

Order: `TULONG_PROVIDERS=gemini,groq,claude`; providers without a key are skipped. On a rate limit, timeout, outage, refusal, malformed reply, more than 8 steps, or a draft that fails our checks twice, the whole request restarts on the next provider. The review screen shows which one drafted the plan.

## Safety notes

- Tulong has read-only tools (`lookup_programs`, `get_case`, `get_program_room`) and one output tool (`draft_payment_plan`). No wallet, no key, no tool that writes to the chain or changes the bill. Loop capped at 8 steps.
- Tulong's draft is validated in code (`lib/plan.ts`) before it is shown. Staff edits are warned about but not blocked, so the contract does the refusing.
- `approveAndPay` is sent with a fixed gas limit so a refused plan reverts on-chain. If the wallet still won't send it, the screen shows the contract's error from an `eth_call` pre-check.
- Off-chain data (case salts, memos, family codes, plans by hash) is in `web/.data/store.json` (gitignored).
- Staff-only APIs (`/api/cases`, `/api/plans?caseId`, Tulong drafts) need the sign-in cookie. Sign-in nonces are single-use and expire in 5 minutes. Set `SESSION_SECRET` in `.env` so sign-ins survive a restart.
- The family view (`/api/family/case?code=`) returns only that case's bill, covered, remaining and payments: no case ID, salt or memo. Codes skip look-alike characters (0/O, 1/I/L).
