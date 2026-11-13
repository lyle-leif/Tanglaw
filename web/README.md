# Tanglaw web app

Next.js (App Router) + wagmi/viem. Tulong (the AI) runs on free tiers: Gemini first, Groq as fallback, Claude optional. Same design and demo story as `design/prototype.html`. All buttons and labels are in English; only Tulong's replies follow the student's language setting (Taglish by default, or English, or Filipino).

| Route | Who | Sign-in | What they see |
|---|---|---|---|
| `/` | Everyone | none | Pick: student, scholarship officer, or public record. |
| `/student` → `/student/chat` | Maria (student) | **Case code** from the scholarship officer (`TGL-XXX-XXX`), saved on her phone | Chat with Tulong, program and checklist cards, her own case's status and the paid card. Only her case. ⚙ Settings: Tulong's language, clear chat, leave case. No wallet. |
| `/staff` | Scholarship officer | **MetaMask**: the officer signs a free one-time message; the server checks the wallet is the contract's `officer` and sets an 8-hour cookie | Opens cases (types the assessment, optional memo) and gets the student code to give Maria, asks Tulong to draft, edits amounts, signs `approveAndPay`. |
| `/activity` | Public | none | Counter ("₱X paid · Y refused by the rules"), every `Paid` event, every refused payment with the contract's reason and its failed tx, budgets left per program, BscScan links. No names. |
| `/receipt/[tx]` | Public (Maria's "View receipt") | none | One payment: lines, school, time, printable. **✓ Plan matches the blockchain**: the browser reads the receipt straight from BSC testnet and compares the on-chain `planHash` with the fingerprint of the approved plan. |

Only the scholarship officer has a wallet because only the officer approves payments, and the contract checks that address. The student never signs anything. Old paths `/chat`, `/review` and `/family` redirect to the new ones.

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

1. MetaMask: Approver account (the `OFFICER_ADDRESS` from deploy), BSC testnet.
2. `/staff` → **Connect MetaMask** → **Sign in** (free message signature).
3. **+ Open a case** → ₱38,000, no memo → sign. This is **Case A** (Maria's case). Note the **student code** shown after it opens.
4. **+ Open a case** → ₱38,000, **Use demo memo** → sign. This is **Case B**.
5. On each case, **Draft with Tulong**. Case B's draft should show the amber "ignored an instruction" box.
6. On the phone (or another browser): `/student` → enter Case A's code → send Maria's message once so the chat is preloaded (kept in that browser).

On stage: student chat → staff Case A (TES ₱20,000 + City ₱10,000 + Alumni ₱8,000) → Sign → Case B, set Alumni to 15000 (total ₱45,000 on a ₱38,000 assessment) → Sign → refused (`OverBill`, no double-funding) → `/activity`.

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
- Off-chain data (case salts, memos, student codes, plans by hash) is in `web/.data/store.json` (gitignored).
- Staff-only APIs (`/api/cases`, `/api/plans?caseId`, Tulong drafts) need the sign-in cookie. Sign-in nonces are single-use and expire in 5 minutes. Set `SESSION_SECRET` in `.env` so sign-ins survive a restart.
- The student view (`/api/student/case?code=`) returns only that case's assessment, covered, remaining and payments: no case ID, salt or memo. Codes skip look-alike characters (0/O, 1/I/L).
