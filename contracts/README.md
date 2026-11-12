# TanglawVault (contracts)

One contract that pays a case's hospital from aid programs, only within each program's per-case cap, its budget and the bill. Only the social worker's wallet can open cases and approve payments. The AI never signs. Spec: [`../MIGRATION.md`](../MIGRATION.md) §5.

## Setup (fresh clone)

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation) and Node.js.

```bash
cd contracts
npm install        # OpenZeppelin 5.6.1 and forge-std v1.9.7 into node_modules (git-ignored)
forge build
forge test -vv     # all 13 required tests
```

Dependencies are managed by `package.json`, not git submodules, and are mapped in `foundry.toml`.

## Deploy and verify (BSC testnet, chain 97)

Fill in `../.env` from `../.env.example` on your own laptop. Then, from `contracts/`:

```bash
set -a; source ../.env; set +a
forge script script/Deploy.s.sol:Deploy --rpc-url bsc_testnet --broadcast --verify -vvvv
```

The script refuses to run on any chain other than 97. It deploys the vault, seeds PhilHealth (0), DOH MAIFIP (1) and PCSO IMAP (2) with demo caps, allowlists `HOSPITAL_ADDRESS`, sets `SOCIAL_WORKER_ADDRESS` and funds the vault with `VAULT_FUNDING_WEI` (default 0.02 tBNB).

If verification fails during the deploy, verify afterwards:

```bash
forge verify-contract <VAULT_ADDRESS> src/TanglawVault.sol:TanglawVault \
  --chain 97 --constructor-args $(cast abi-encode "constructor(address)" <DEPLOYER_ADDRESS>) --watch
```

Demo rate: ₱1 = 1e11 wei (₱1,000,000 = 0.1 tBNB). Simulated program rules · Testnet demo funds.
