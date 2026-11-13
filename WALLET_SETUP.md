# Wallet setup — Tanglaw (MetaMask on BSC Testnet)
 
> Never put a seed phrase or private key in this file, in code, in chat, or in any AI tool.
> Keys only go in a local `.env` file that is listed in `.gitignore`.
 
## Network (already added in MetaMask)
 
| Field | Value |
|---|---|
| Network name | BNB Smart Chain Testnet |
| RPC URL | https://data-seed-prebsc-1-s1.bnbchain.org:8545 |
| Chain ID | 97 |
| Currency symbol | tBNB (test coin, no real value) |
| Block explorer | https://testnet.bscscan.com |
| Faucet | BNB Chain testnet faucet on bnbchain.org |
 
Always check MetaMask shows **BNB Smart Chain Testnet (97)** before deploying or demoing. Mainnet is chain 56 and uses real money.
 
## Accounts and roles
 
| Account | Role | Used for | Address |
|---|---|---|---|
| Account 1 → **Deployer** | Team / admin (contract `owner`) | Deploy and verify TanglawVault, configure programs and allowlist, set the approver, fund the vault with tBNB | `0x…` (fill in; public address only) |
| Account 2 → **Approver** | Scholarship officer in the demo | Review the AI's plan and **sign** payouts in the MetaMask pop-up | `0x…` (fill in) |
| Tulong (AI) | — | **No wallet.** Only drafts payment plans | — |
 
Why two accounts: the demo shows that only the Approver can sign payouts and the contract rejects any other wallet.
 
## Rules (from the organizers and workshops)
 
| Rule | What we do |
|---|---|
| AI must not control wallets or authorize transactions | AI has no key; a human signs every transaction in MetaMask |
| No real funds | Fresh hackathon-only wallet; tBNB only |
| Keys stay secret | Deployer private key only in `.env` (for Foundry/Hardhat deploy); `.env` in `.gitignore` before the first commit |
| Don't run out of gas on Build Day | Claim tBNB early; give the Approver a little tBNB for gas |
| Verify the contract | Verify on testnet.bscscan.com right after deploying |
 
## Setup checklist
 
- [x] Install MetaMask from metamask.io (official extension)
- [x] Create a new hackathon-only wallet; recovery phrase saved on paper
- [x] Add BNB Smart Chain Testnet (chain 97)
- [ ] Rename Account 1 to **Deployer**
- [ ] Add Account 2, rename to **Approver**
- [ ] Get tBNB from the faucet for the Deployer
- [ ] Send a small amount (e.g. 0.01 tBNB) to the Approver for gas
- [ ] Check both balances on testnet.bscscan.com
- [ ] Test a tiny transfer Deployer → Approver and watch the MetaMask pop-up
- [ ] Fill in both public addresses in the table above
- [ ] (Later) Export the Deployer private key into `.env` only, for command-line deploys