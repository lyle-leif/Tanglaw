# Tanglaw — UI/UX spec

> Design source for the web build (`web/`). Follows MIGRATION.md §4–§7, PRD UI-1 to UI-5 and the Pitch deck visual identity. If this file and MIGRATION.md disagree, MIGRATION.md wins. Items marked **[PENDING]** wait for a team decision.
>
> Clickable prototype: [`design/prototype.html`](prototype.html) (open it in a browser; no build step).

---

## 1. Principles

1. **Pesos, people, proof.** Every amount is in pesos. tBNB appears only in the wallet prompt itself, never in our UI for Ana or the public.
2. **The AI drafts, a human signs, the contract decides.** The UI shows those three roles visibly on every money screen: a "Drafted by Tulong" tag, a "Sign with wallet" button, and contract results in their own panel.
3. **Honest by default.** The honesty banner is fixed on every screen. Refusals, warnings and limits are shown, not hidden.
4. **Nothing to scroll in the demo.** Each demo screen fits a 1280 × 720 CSS-pixel viewport, which is what a 1920 × 1080 projector shows at 150% zoom.
5. **Ana never sees crypto.** No wallet, address, hash, gas, chain or token words on `/chat`.

---

## 2. Visual system

### Color tokens

| Token | Hex | Use | Contrast note |
|---|---|---|---|
| `--navy` | #13233F | Text, header, banner, primary dark | 14.97:1 on paper |
| `--paper` | #FFF9F0 | Page background | — |
| `--card` | #FFFFFF | Cards, chat bubbles from Tulong | — |
| `--amber` | #F2A93B | **Fills only**: primary button, highlights, logo | Navy text on amber is 7.85:1. **Never amber text on paper (1.91:1)** |
| `--amber-ink` | #8A5A00 | Amber-toned text (warnings, labels) | 5.66:1 |
| `--amber-wash` | #FDECC8 | Warning panel background | Navy on it is 13.4:1 |
| `--green` | #2E9E5B | Paid fills, progress bars, icons | White on green is 3.41:1, so **only large or bold text (≥ 19px bold)** |
| `--green-ink` | #1E7B44 | Green text | 5.05:1 on paper |
| `--green-wash` | #E6F4EC | Paid panel background | Green ink on it is 4.66:1 |
| `--red` | #D64545 | **Only the blocked moment**: refused panel edge and icon | White on red is 4.38:1, so large text only |
| `--red-ink` | #B3261E | Refusal text | 6.24:1 on paper |
| `--red-wash` | #FBE9E9 | Refused panel background | Red ink on it is 5.58:1 |
| `--muted` | #5B6578 | Secondary text, labels | 5.61:1 on paper |
| `--line` | #E8DFD0 | Borders, dividers | Decorative |

Red appears **nowhere else**: no red badges, no red delete buttons, no red validation, so the refusal stands out on stage.

### Type

- Titles: **Poppins** 600/700. Body and UI: **Inter** 400/500/600. Both load from Google Fonts, with a system-ui fallback.
- Amounts use `font-variant-numeric: tabular-nums` so columns line up.
- Base size: 16px for staff and public screens; 17px for chat (mobile reading). Minimum 13px for any text (only metadata such as timestamps and hashes).
- Scale: 13 · 14 · 16 · 17 · 20 · 24 · 32 · 40 (big balances).

### Shape and spacing

- Radius 12px for cards, 999px for pills and chips, 16px (18px corner) for chat bubbles.
- 8px spacing grid. Cards use a 1px `--line` border and a soft shadow (`0 1px 2px rgba(19,35,63,.06)`).

### Iconography

- Inline SVG strokes, 1.75px, no icon font. The logo is a lamp/sun mark: an amber circle with short rays.

---

## 3. Shared elements (every screen)

| Element | Spec |
|---|---|
| **Honesty banner** | Fixed at the very top, full width, 32px tall, navy background, warm-white 13px/600 text, amber dot before it: **"Simulated program rules · Testnet demo funds · Not a real government disbursement"**. Not dismissible. On `/chat` it wraps to two lines at phone width rather than truncating |
| **App header** | Logo + "Tanglaw" (Poppins 700) + tagline "Liwanag sa bawat piso" (muted). Right side depends on the screen: language note on chat, wallet status on review, "Public record" pill on activity |
| **Peso format** | `₱80,000` (no decimals for whole pesos), `₱25,000.50` only if needed. Built by `lib/peso.ts`; contract values are converted at the edge (₱1 = 1e11 wei) |
| **Receipt link** | Staff and public: "View on BscScan ↗". Ana: "Tingnan ang resibo ↗" (opens the same BscScan page; the label avoids crypto words) |
| **Case IDs** | Shortened `0x7f3a…c9e1` with a copy button (staff/public only). Never shown to Ana; she sees "Kaso #A" |

---

## 4. Screen 1 — Family chat (`/chat`)

**User:** Ana, the patient's daughter, on her phone at the hospital. **Goal:** know which programs can help, what to bring (one list), and when the bill is paid. **Language:** plain Taglish. **Never:** wallets, addresses, hashes, error codes, tBNB.

### Layout (mobile-first, 360–430px)

```
┌───────────────────────────────┐
│ ● Simulated program rules ·…  │  honesty banner (2 lines at 360px)
├───────────────────────────────┤
│ (lamp) Tulong                 │  header: avatar, "Tulong · katulong sa medical aid"
│ Kaso #A · Hinihintay ang apruba│  status pill (changes per state)
├───────────────────────────────┤
│  [Tulong bubble]              │
│            [Ana bubble]       │  messages
│  [Program card]               │
│  [Checklist card]             │
│  [Case status card]           │
├───────────────────────────────┤
│ (chip) Ano ang dadalhin? (chip)│  quick replies
│ [ Mag-type dito…        ] (➤) │  composer
└───────────────────────────────┘
```

On desktop and projector the chat is a centered 420px column with a soft phone frame, so it reads as a phone app on stage.

### Components

| Component | Content |
|---|---|
| Tulong bubble | White card, navy text, avatar on the first bubble of a group |
| Ana bubble | Navy fill, warm-white text, right aligned |
| **Program card** | Title "Mga programang puwedeng tumulong". One row per program: name, one-line plain explanation, a small "simulated rule" note. Order follows the priority PhilHealth → DOH MAIFIP → PCSO IMAP |
| **Checklist card** | Title "Isang listahan para sa lahat ng programa". Checkboxes Ana can tick (local only). No duplicates across programs. Footer: "Ang social worker ng ospital lang ang puwedeng mag-apruba ng tulong." |
| **Case status card** | Big remaining balance (`Natitira: ₱80,000`), a progress bar (green fill = covered), a status line, and payment rows with receipt links once paid |
| Quick replies | "Ano ang dadalhin?", "Nasaan na ang kaso ko?", "Sino ang mag-aapruba?" |

### States

| State | What Ana sees |
|---|---|
| **Empty** | Tulong greeting: "Hello po! Ako si Tulong. Ikuwento lang po ninyo ang sitwasyon at ang bill, at sasabihin ko kung anong tulong ang puwede." Plus the 3 quick replies. Note below the composer: "Huwag ilagay ang buong pangalan o diagnosis." |
| **Ana sends** | Her bubble appears immediately |
| **AI thinking** | Three-dot typing bubble + "Tinitingnan ni Tulong ang mga programa…" After 8s: "Medyo matagal, sandali lang po." |
| **Programs + checklist** | Tulong reply → program card → checklist card → status card "Bukas ang kaso · Hinihintay ang apruba ni Ma'am Liza" |
| **Waiting** | Status pill amber: "Hinihintay ang apruba" |
| **Paid** | New Tulong bubble with a green check: **"Bayad na po!"** "₱80,000 ang naibayad diretso sa ospital. Wala na po kayong babayaran sa bill na ito." Status card: `Natitira: ₱0`, full green bar, two rows (PhilHealth ₱25,000, DOH MAIFIP ₱55,000), each with "Tingnan ang resibo ↗". Status pill green: "Bayad na" |
| **Partially paid** | "May bayad na pong ₱25,000 mula sa PhilHealth. Natitira: ₱55,000." |
| **AI error / invalid plan** | "Pasensya na po, may problema sa sagot ko. Pakisubukan ulit, o lumapit sa social worker." No technical detail |
| **Offline** | Banner under the header: "Walang internet. Susubukan ulit." |

**Ana never sees refusals.** A refused staff transaction (e.g. the ₱200,000 edit) changes nothing on chain, so the chat stays on "Hinihintay ang apruba". Refusals are staff-only information.

---

## 5. Screen 2 — Social worker review (`/review`)

**User:** Ma'am Liza, hospital social worker, desktop, MetaMask on BNB Smart Chain Testnet (chain 97). **Goal:** check Tulong's plan against the case, then sign once. **Language:** plain English. Error names may appear small, after the plain sentence.

### Layout (desktop, fits 1280 × 720 without scrolling)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ● Simulated program rules · Testnet demo funds · Not a real government…  │
├──────────────────────────────────────────────────────────────────────────┤
│ (lamp) Tanglaw · Social worker review          [● BSC Testnet] [0xA9…3F] │
├────────────┬───────────────────────────────────────────┬─────────────────┤
│ CASES      │ Case A · 0x7f3a…c9e1   DOH Hospital·Batangas│ SIGN            │
│ ▸ Case A   │ Bill ₱80,000 │ Covered ₱0 │ Remaining ₱80,000│ Payee (locked) │
│   Case B ⚠ │ [■■■■□□□□□□□□ progress]                    │ DOH Hospital…   │
│            │ ┌ Tulong's draft · not signed · no wallet ┐ │ Plan total      │
│            │ │ Program  Amount  Reason        Source   │ │ ₱80,000         │
│            │ │ PhilH.  ₱25,000  …            rules.…   │ │ After: ₱0       │
│            │ │ DOH     ₱55,000  …            rules.…   │ │ [Sign with      │
│            │ │ PCSO not needed: balance already ₱0     │ │  wallet]        │
│            │ └─────────────────────────────────────────┘ │ result panel    │
│            │ [⚠ warnings panel, case B only]            │                 │
└────────────┴───────────────────────────────────────────┴─────────────────┘
```

Columns: 200px case list · flexible main · 300px sign panel. Below 1100px the sign panel drops under the plan (not used on stage).

### Components

| Component | Spec |
|---|---|
| **Wallet chip** (header) | `● BSC Testnet` (green dot) + short address of the connected account. Not connected: amber "Connect wallet" button. Wrong network: amber-wash chip "Wrong network · Switch to BSC Testnet" |
| **Case list** | Case label, short ID, remaining amount, status chip (Open / Paid / Needs review ⚠). Case B shows the ⚠ because Tulong raised a warning |
| **Case header** | Case label + short ID (copy button), hospital label, **Bill (entered by social worker)**, Covered, Remaining, progress bar. The bill shows a small lock and "Set by you in openCase · Tulong can't change it" |
| **Plan card** | Header tag in amber-wash: "Drafted by Tulong · Not signed · Tulong has no wallet". Columns: Program · Amount (editable) · Room left · Reason · Rule source (monospace chip, e.g. `rules.philhealth.case-cap`). Footer: planHash chip `0x4e1d…a72b` with a tooltip "Fingerprint of this exact plan, stored with the payment". If a staff member edits a line: the row gets an "Edited by you" tag and the footer shows "Plan edited · new fingerprint" |
| **Inline line warning** | When an edited amount exceeds that program's room: amber-ink text under the field, "Above PhilHealth's room for this case (₱25,000). The contract will refuse this." It **does not block signing** (see §8) |
| **Warnings panel** (case B) | Amber-wash panel, amber left edge, shield icon. Title: "Tulong ignored an instruction in a document". Body: quote of the memo text in a muted box, then "Treated as document text, not as an order. It is not in the plan. Payments can only go to this case's hospital." |
| **Sign panel** | "Payee (fixed by the contract)": hospital label + short address, a lock icon, no input. Plan total, Remaining after this plan. Primary button **"Sign with wallet"** (amber fill, navy text, 48px tall). Under it: "You are approving this exact plan. The contract checks every rule before paying." |
| **Result panel** | Sits under the Sign button: pending, paid or refused (below) |
| **Draft with Tulong** button **[PENDING]** | Secondary button at the top of the plan card. Calls the AI route live and streams the plan in. If no valid plan within **8 seconds**, it loads the plan pre-drafted that morning and shows a muted note: "Showing the plan Tulong drafted earlier (live draft was slow)." Awaiting team approval of the live-AI demo step |

### States

| State | Shown |
|---|---|
| **Wallet not connected** | Sign button replaced by "Connect wallet". Plan stays readable |
| **Wrong network** | Sign button disabled; amber-wash notice in the sign panel: "Your wallet is on another network. Switch to BNB Smart Chain Testnet (97)." + "Switch network" button |
| **Wrong account** (not the social worker) | Notice: "This wallet isn't the registered social worker. Switch to the Approver account." Sign disabled. (Checked client-side by reading `socialWorker`; the contract would revert `NotSocialWorker` anyway) |
| **Empty (no plan yet)** | Plan card shows "No plan yet" + **Draft with Tulong** button |
| **Drafting** | Skeleton rows with a shimmer + "Tulong is reading the case and the rules table…" + step ticks: Read case ✓ · Checked program room ✓ · Drafting plan… |
| **Plan drafted** | Table filled; PCSO shown as a muted footnote "PCSO IMAP not needed: balance already ₱0" |
| **Plan invalid** (validator rejected AI output) | Muted panel: "Tulong's draft failed our checks (unknown rule source). It wasn't shown. Draft again." No partial plan |
| **Signing** | Button shows a spinner + "Confirm in your wallet…". Plan becomes read-only |
| **Rejected in wallet** | Muted note: "You cancelled the signature. Nothing was sent." Button returns |
| **Pending** | "Waiting for the network… (usually a few seconds)" + tx short hash with "View on BscScan ↗". After 10s: "Still confirming. The money can only go to this case's hospital." |
| **Paid** | Green-wash panel, green check, **"Paid. Remaining ₱0"** (24px bold green-ink), rows per line, "View on BscScan ↗". Case header updates: Covered ₱80,000, Remaining ₱0, full green bar; case list chip "Paid" |
| **Refused** | Red-wash panel with a red left edge and stop icon: **"Refused by the contract. Nothing was paid."** Then the plain sentence from the error table, e.g. "PhilHealth can pay at most ₱25,000 for this case. This line asked for ₱200,000." Then small muted: `Contract error: OverProgramCap · failed tx 0x91c4…7e02 ↗`. Button: "Reset to Tulong's plan" |
| **Paused** | Top notice across main: "Payments are paused by the admin." Sign disabled |
| **RPC/network down** | "Can't reach the network. Check the connection and try again." Retry button |

---

## 6. Screen 3 — Public activity (`/activity`)

**User:** anyone (judges, journalists, the public). **Goal:** see every payment and each program's budget, with no names. **Language:** plain English.

### Layout (desktop; stacks on mobile)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ● Simulated program rules · Testnet demo funds · Not a real gov…     │
├──────────────────────────────────────────────────────────────────────┤
│ (lamp) Tanglaw · Public activity                    [Public record]  │
│ Every peso, in public.  ₱80,000 paid · 1 case · 1 hospital · No names│
├──────────────────────────────────────────────────────────────────────┤
│ [PhilHealth card] [DOH MAIFIP card] [PCSO IMAP card]                 │
│  paid ₱25,000       paid ₱55,000       paid ₱0                       │
│  left ₱475,000      left ₱445,000      left ₱500,000   (bars)        │
├──────────────────────────────────────────────────────────────────────┤
│ RECEIPTS                                                             │
│ Time   Case          Program     Amount    Hospital         Receipt  │
│ 2:14   0x7f3a…c9e1   DOH MAIFIP  ₱55,000   DOH Hosp·Batangas  ↗      │
│ 2:14   0x7f3a…c9e1   PhilHealth  ₱25,000   DOH Hosp·Batangas  ↗      │
├──────────────────────────────────────────────────────────────────────┤
│ ▸ What this record proves, and what it doesn't                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Components and states

| Item | Spec |
|---|---|
| Summary line | Total paid, number of cases, number of hospitals, "No names. Case IDs are random." |
| **Program cards** | Name, "Paid so far" (green-ink), "Budget left" (navy, 24px), a bar (green = paid share of the ₱500,000 budget), per-case cap in muted text. Read from `programs` |
| **Receipts table** | One row per `Paid` event, newest first: time, short case ID, program, amount (₱), hospital label, "View on BscScan ↗". A new row slides in with a 2s amber-wash highlight |
| Proves / doesn't prove | Collapsible two-column box with the MIGRATION.md §5 table. Collapsed during the demo |
| **Empty** | "No payments yet. Every approved payment will appear here, with no names." |
| **Loading** | Skeleton cards and rows |
| **Error** | "Can't read the public record right now. Try again." |
| Refused attempts | Not listed: the contract emits no event when it refuses, so nothing is recorded. A muted footnote says so |

No patient names, no diagnoses, no wallet addresses of people. The hospital shows as its label (the address is behind the BscScan link).

---

## 7. Contract error messages

Ana never triggers a transaction, so her column is only for status explanations if Tulong is asked about a case. Staff see the plain English sentence first, then the error name in small muted text.

| Error | Staff (English) | Ana (Taglish) |
|---|---|---|
| `NotSocialWorker` | "Only the registered social worker wallet can do this. Switch to the Approver account." | "Ang social worker lang ang puwedeng mag-apruba nito." |
| `OverProgramCap` | "{Program} can pay at most {room} more for this case. This line asked for {amount}. Nothing was paid." | "Lampas sa limit ng {Program} para sa kasong ito." |
| `OverBudget` | "{Program} has only {budgetLeft} budget left. Nothing was paid." | "Kulang na ang natitirang pondo ng {Program}." |
| `OverBill` | "This would pay more than the bill. Only {remaining} is left. Nothing was paid." | "Lampas na po ito sa natitirang bill." |
| `UnknownHospital` | "This hospital isn't on the approved list. Ask the admin to add it." | "Hindi pa kasama sa listahan ang ospital na ito." |
| `CaseNotFound` | "This case isn't open on-chain yet. Open the case first." | "Hindi pa po bukas ang kasong ito." |
| `Paused` | "Payments are paused by the admin. Try again later." | "Pansamantalang nakahinto ang bayad. Susubukan ulit." |
| `InactiveProgram` | "{Program} isn't active right now. Remove that line." | "Hindi aktibo ngayon ang {Program}." |
| `ZeroAmount` | "Every line needs an amount above ₱0." | "Kailangang may halaga ang bawat linya." |
| `BadArrays` | "The plan is malformed (lines don't match). Draft it again." | "May mali sa plano. Gagawa ulit si Tulong." |
| Wallet: user rejected | "You cancelled the signature. Nothing was sent." | — |
| Wallet: wrong network | "Switch to BNB Smart Chain Testnet (97)." | — |
| Wallet: not enough gas | "The wallet needs a little tBNB for the network fee." | — |
| RPC unreachable | "Can't reach the network. Try again." | "Walang koneksiyon. Susubukan ulit." |

Values in `{}` come from the plan and from `programRoom` / `remaining`.

---

## 8. Design decisions that touch the build

1. **The UI warns but does not block an over-cap edit.** If the UI stopped the ₱200,000 line, the contract would never get to refuse it, and the demo's key moment would disappear. So the review screen shows an inline amber warning and still lets her sign; the contract's refusal is the real guard. (Validation of **AI** output stays strict: invalid AI plans are never shown.)
2. **Send with a fixed gas limit** on `approveAndPay`, so MetaMask doesn't stop at gas estimation and the refusal lands on-chain as a failed transaction (MIGRATION.md §10). Fallback: show the same refused panel from an `eth_call` pre-check, labeled "Checked against the contract".
3. **Payee is display-only.** There is no address input anywhere in the app.
4. **Edited plans get a new fingerprint.** If staff edit a line, the app recomputes `planHash` over the edited plan and labels it "Edited by you", so the chain records what a human actually approved.
5. **Ana's chat reads chain status, not staff actions.** It changes only on `Paid` events, so refusals and edits stay staff-side.

---

## 9. Demo readiness

### Exact screens in demo order (1:00)

| Time | Tab | Pre-set state | Action |
|---|---|---|---|
| 0:00 | `/chat` (phone frame) | Ana's conversation already loaded: programs, checklist, "Hinihintay ang apruba" | None |
| 0:10 | `/review` Case A | Wallet connected on chain 97 (Approver). Plan drafted, or **[PENDING]** click **Draft with Tulong** | Point at reasons and rule sources |
| 0:20 | `/review` Case A | — | Click **Sign with wallet** → confirm in MetaMask → Paid panel → "View on BscScan ↗" |
| 0:35 | `/review` Case B | Plan drafted with the warnings panel visible | Click the PhilHealth amount, type 200000, **Sign with wallet** → confirm → Refused panel |
| 0:50 | `/activity` | — | New rows highlighted; PhilHealth/DOH budgets updated |

### Projector rules

- Every demo screen fits **1280 × 720 CSS px** with no scrolling (1920 × 1080 at 150%, or 1600 × 900 at 125%).
- Key numbers ≥ 24px; table text ≥ 16px; nothing important below 14px.
- Paid and refused panels appear **in the sign panel, right where the presenter just clicked**, so judges' eyes don't have to travel.
- Motion is limited to: typing dots, skeleton shimmer, the new-row highlight, and a 200ms panel fade. `prefers-reduced-motion` turns all of them off.
- Browser chrome: one window, tabs in demo order, notifications off.

---

## 10. Accessibility

- Contrast: all text meets WCAG AA (≥ 4.5:1) using the `-ink` tokens. Amber, green and red fills only carry navy text, large bold white text, or icons.
- Status is never color alone: Paid has a check icon and the word "Paid"; Refused has a stop icon and the word "Refused"; warnings have a shield icon.
- Focus: 3px amber outline + 2px navy offset ring on every interactive element; never removed.
- Keyboard: the whole review flow works with Tab/Enter; the editable amount is a real `<input inputmode="numeric">`.
- Screen readers: result panels are `role="status"` (paid, pending) or `role="alert"` (refused); the honesty banner is a `role="note"` landmark at the top.
- Touch targets ≥ 44px on `/chat`.
- `lang="fil"` on chat content, `lang="en"` on staff/public screens.

---

## 11. Copy tone

| Audience | Tone | Do | Don't |
|---|---|---|---|
| Ana | Warm, respectful Taglish with "po". Short sentences. One idea per bubble | "Bayad na po!", "Isang listahan para sa lahat ng programa" | Crypto words (wallet, token, blockchain, hash, gas), error codes, medical advice, promises of approval |
| Ma'am Liza | Plain, direct English. Say what happened, then what to do | "Refused by the contract. Nothing was paid." | Jargon without explanation ("execution reverted"), blame |
| Public | Neutral, factual | "Every peso, in public." | Names, political language, claims beyond §5 "what the chain proves" |

Tulong always says: "Ang social worker lang ang puwedeng mag-apruba ng tulong." It never says aid is guaranteed.

---

## 12. Open questions for the team

1. **[PENDING]** Approve the live **Draft with Tulong** step in the demo (8-second fallback to the pre-drafted plan)?
2. Hospital label for the demo: "DOH Hospital · Batangas (demo)" is used here. Keep it generic, or use a fictional name?
3. Should Ana's chat show a short "Natanggap na ng social worker ang kaso" step when the case is opened, or only "Hinihintay ang apruba"?
4. Track wording (Payments vs AI Agents) may change the activity page headline; current headline "Every peso, in public." works for both.
