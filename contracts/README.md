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

On your own laptop, fill in the repo-root `.env` using `.env.example` as a reference. Set `DEPLOYER_PRIVATE_KEY` to the dedicated testnet Deployer account's private key in `0x` plus 64 hexadecimal digits. Set `HOSPITAL_ADDRESS` and `SOCIAL_WORKER_ADDRESS` to the respective public addresses. Use a public BSC testnet URL for `BSC_TESTNET_RPC` so connection errors contain no RPC credential.

Run the deployment command from the **repo root**. Forge loads the local `.env` directly and the command uses normal log verbosity.

```bash
forge script contracts/script/Deploy.s.sol:Deploy --root contracts --rpc-url bsc_testnet --broadcast
```

Keep the key in the ignored `.env` only. Keep shell tracing and Forge debug or trace flags off for deployments. Git's ignore rules do not cover OneDrive sync, so use a local checkout outside synced folders for credentials.

The script refuses to run on any chain other than 97. It deploys the vault, seeds PhilHealth (0), DOH MAIFIP (1) and PCSO IMAP (2) with demo caps, allowlists `HOSPITAL_ADDRESS`, sets `SOCIAL_WORKER_ADDRESS` and funds the vault with `VAULT_FUNDING_WEI` (default 0.02 tBNB).

After deployment, verify separately with Sourcify from the repo root:

```bash
forge verify-contract <VAULT_ADDRESS> src/TanglawVault.sol:TanglawVault \
  --root contracts --chain 97 --verifier sourcify \
  --constructor-args $(cast abi-encode "constructor(address)" <DEPLOYER_ADDRESS>) --watch
```

Demo rate: ₱1 = 1e11 wei (₱1,000,000 = 0.1 tBNB). Simulated program rules · Testnet demo funds.
