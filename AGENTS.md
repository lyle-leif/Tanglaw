# Instructions for coding agents (Codex, Claude, others)

1. Read `MIGRATION.md` first. It is the build spec and wins over every other doc.
2. Start from **MIGRATION.md §0 "Build status (handoff)"**: what is done, what is next, and the open decisions. Continue with the first unfinished "Next" item.
3. After every milestone, update §0 (done, next steps, open decisions, gotchas) so the next agent can pick up from there.
4. UI work follows `design/DESIGN.md` and matches `design/prototype.html`.

Hard rules:
- Never handle, request or write private keys or seed phrases. Only `.env` (gitignored) holds secrets, and only the repo owner fills it.
- Testnet only (BSC testnet, chain 97). No tokens, no real funds.
- The AI in the app (Tulong) never gets a wallet, key or signing ability.
- No personal data on-chain or in the AI plan.
- Do not commit unless the owner asks. Never add AI co-author or attribution lines (no `Co-Authored-By`). The repo owner is the sole author.
- Contract changes must keep all tests passing: `cd contracts && npm install && forge test`.
