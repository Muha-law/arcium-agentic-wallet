# 🔐 Arcium Agentic Wallet

**Autonomous AI Agent Wallets on Solana with Arcium MPC Privacy + On-Chain Risk Governance**

AI-powered wallet system where autonomous agents create wallets, make trading decisions via Claude AI, and execute transactions through Arcium's Multi-Party Computation network — with on-chain risk gating that prevents rogue agent behavior at the program level.

> **Hackathon Bounty**: Solana Agentic Wallet Infrastructure with Arcium MPC

---

## ✅ What We Built & Proved

### 1. MPC Ed25519 Signing — Tested & Verified

Two Arcis circuits deployed on Arcium's MPC network:

**`sign_transaction`** — Distributed Ed25519 signing. The private key is split across MPC nodes. No single node ever holds the full key.

```rust
#[instruction]
pub fn sign_transaction(message: [u8; 32]) -> ArcisEd25519Signature {
    let signature = MXESigningKey::sign(&message);
    signature.reveal()
}
```

**`verify_agent_signature`** — Confidential signature verification. The public key stays encrypted; only the boolean result is revealed.

**Test Output (Real MPC — Not Simulated):**
```
Signing message with MPC Ed25519...
Message (hex): 4954be8e683e0562dbec189595ce3a...
MPC Signature (hex): b1233c9e9f8da0c496b096cc961133...
MXE Verifying Key (hex): b00de34e725e75a7c8ba2028ee4f25...
Signature valid: true

=== MPC WALLET SIGNING TEST PASSED ===
✔ Signs a transaction with MPC Ed25519 (24856ms)
1 passing (25s)
```

### 2. Agent Vault — On-Chain Risk-Gated Execution (6/6 Tests Passing on Devnet)

```
✔ Initializes vault (2595ms)
✔ Deposits SOL (1355ms)
✔ Initializes agent state (2210ms)
✔ Updates risk score (1531ms)
✔ Gated withdraw succeeds with low risk (2033ms)
✔ Blocks withdraw when risk is high (1763ms)
6 passing (11s)
```

### 3. Multi-Agent AI System — Running

3 Claude AI agents with independent strategies, encrypted wallets, and autonomous decision loops.

---

## 🏗 Architecture — Three Security Layers

```
┌──────────────────────────────────────────────────────┐
│                 Claude AI Agent Brain                  │
│   Agent 1: Aggressive  Agent 2: Conservative          │
│   Agent 3: Liquidity Provider                         │
└──────────────────┬───────────────────────────────────┘
                   │ trading decisions
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 0 — Arcium MPC (Key Security)                  │
│  Private key split across MPC nodes                   │
│  MXESigningKey::sign() — collective Ed25519           │
│  No single node holds the full key                    │
└──────────────────┬───────────────────────────────────┘
                   │ MPC-signed transactions
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 1 — Agent Vault (Fund Security)                │
│  SOL locked in program-controlled vault               │
│  Owner auth required for all operations               │
│  Safe arithmetic (checked_add/sub)                    │
└──────────────────┬───────────────────────────────────┘
                   │ withdrawal request
                   ▼
┌──────────────────────────────────────────────────────┐
│  LAYER 2 — Gated Execution (Behavioral Security)      │
│  On-chain risk score evaluation (0-100)               │
│  risk_score <= 80 required                            │
│  execution_enabled must be true                       │
│  Time-based constraint (1hr timeout)                  │
│  Balance safety checks                                │
└──────────────────┬───────────────────────────────────┘
                   │ approved withdrawal
                   ▼
┌──────────────────────────────────────────────────────┐
│              Solana Devnet Execution                   │
└──────────────────────────────────────────────────────┘
```

**Why three layers matter:** Traditional wallets have one lock (private key). Our system has three independent locks that all must pass before capital moves. A rogue AI agent would need to compromise the MPC network, bypass vault ownership, AND manipulate the on-chain risk score — simultaneously.

---

## 🔧 Deployed Programs (Solana Devnet)

| Program | ID | Explorer |
|---------|-----|---------|
| **Agentic Wallet MXE** | `EvuXy5xNCSiR1AwPyU3Laz8mtaiyK7xnsPpA115UNoXN` | [View](https://explorer.solana.com/address/EvuXy5xNCSiR1AwPyU3Laz8mtaiyK7xnsPpA115UNoXN?cluster=devnet) |
| **Agent Vault** | `2RaQkqGn8wyMfLEWBRjbz76ZwqrXUJyxvgiKrmMjUtn7` | [View](https://explorer.solana.com/address/2RaQkqGn8wyMfLEWBRjbz76ZwqrXUJyxvgiKrmMjUtn7?cluster=devnet) |

MXE initialized on Arcium devnet cluster (offset 456, 2 active nodes).

---

## 🧠 Evolution of the Project

### Upgrade 1 — Agent Governance Layer
Added `AgentState` account storing owner, risk_score, execution_enabled, and last_action_timestamp. The wallet no longer executes blindly — execution depends on risk_score <= 80 and execution_enabled == true.

### Upgrade 2 — Gated Withdraw (Core Innovation)
Replaced direct withdraw with `gated_withdraw` which checks risk score threshold, execution enabled flag, time-based constraint, and balance safety. This is the shift from **passive wallet → autonomous governed wallet**.

### Upgrade 3 — Safe Arithmetic + Security
Added checked_add/checked_sub, custom error codes, ownership verification, and clean CPI transfers. Moved from hackathon prototype to production-safe logic.

---

## ✨ Feature Status

| Feature | Status | Description |
|---------|--------|-------------|
| **MPC Ed25519 Signing** | ✅ Tested | Distributed signing across MPC nodes — key never reconstructed |
| **Confidential Verification** | ✅ Built | Verify signatures with encrypted public keys |
| **Agent Vault** | ✅ Devnet | Program-controlled SOL vault with owner auth |
| **Risk-Gated Execution** | ✅ Devnet | On-chain risk scoring blocks high-risk withdrawals |
| **x25519 Trade Encryption** | ✅ Integrated | Trade decisions encrypted via ECDH before submission |
| **Multi-Agent AI** | ✅ Running | 3 Claude AI agents with independent strategies |
| **Persistent Wallets** | ✅ Working | AES-256-GCM encrypted storage survives restarts |
| **Auto-Fallback** | ✅ Working | Detects live Arcium connection; simulates when unavailable |

## 🔧 Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Brain | Claude API (Anthropic) — TypeScript |
| MPC Circuits | Arcium Arcis (Rust) — sign_transaction, verify_agent_signature |
| On-Chain Vault | Anchor — agent-vault program with risk gating |
| Arcium Client | @arcium-hq/client (x25519, RescueCipher, arcisEd25519) |
| Solana | @solana/web3.js — devnet |
| Wallet Encryption | AES-256-GCM + PBKDF2 (100K iterations, SHA-512) |

## 📁 Project Structure

```
arcium-agentic-wallet/
├── src/                                    # TypeScript agent system
│   ├── index.ts                            # Main entry — banner + startup
│   ├── agents/
│   │   ├── claude-agent.ts                 # Claude AI brain per agent
│   │   └── multi-agent-orchestrator.ts     # Agent lifecycle management
│   ├── wallet/
│   │   └── wallet-service.ts              # Wallet creation, AES encryption
│   ├── arcium/
│   │   └── arcium-service.ts              # Real Arcium MPC integration
│   ├── executor/
│   │   └── solana-executor.ts             # Solana transaction builder
│   └── config/
│       ├── index.ts                       # Environment configuration
│       └── types.ts                       # Shared type definitions
│
├── agentic_wallet_mxe/                    # Arcium MXE project
│   ├── encrypted-ixs/src/lib.rs           # Arcis circuits (MPC logic)
│   ├── programs/agentic_wallet_mxe/
│   │   └── src/lib.rs                     # Anchor program (on-chain)
│   └── tests/agentic_wallet_mxe.ts        # MPC signing test
│
├── agent-vault/                           # On-chain vault + governance
│   ├── programs/agent-vault/
│   │   └── src/lib.rs                     # Vault + AgentState + GatedWithdraw
│   └── tests/agent-vault.ts              # 6 devnet tests
│
├── wallets/                               # Encrypted wallet storage
├── package.json
└── tsconfig.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Rust (via rustup)
- Solana CLI 2.2.x
- Anchor CLI 0.32.1
- Arcium CLI 0.8.4
- Docker Desktop (for Arcium localnet MPC test)
- Anthropic API key

### Run the Agent System

```bash
npm install
cp .env.example .env  # add ANTHROPIC_API_KEY
npx ts-node src/index.ts
```

### Test MPC Signing (Arcium Localnet)

```bash
cd agentic_wallet_mxe
arcium build
arcium test  # Spins up 2 MPC nodes, signs message, verifies — "1 passing"
```

### Test Agent Vault (Solana Devnet)

```bash
cd agent-vault
anchor test --provider.cluster devnet --skip-deploy  # "6 passing"
```

## 🔒 Security Model

**Layer 0 — MPC Key Security:** Private keys never exist in one place. Arcium MPC nodes collectively produce Ed25519 signatures via MXESigningKey::sign(). Even if one node is compromised, the key remains safe.

**Layer 1 — Vault Fund Security:** SOL sits in a program-controlled vault, not a raw wallet. Only the owner can interact with it. All arithmetic uses checked operations to prevent overflow/underflow.

**Layer 2 — Behavioral Gating:** The gated_withdraw instruction enforces on-chain rules before any capital moves: risk score must be ≤ 80, execution must be enabled, last action must be within 1 hour, and vault must have sufficient balance. The AI agent cannot bypass these constraints regardless of what it decides.

## 📚 Resources

- [Arcium Developer Docs](https://docs.arcium.com/developers)
- [Arcium Ed25519 Example](https://github.com/arcium-hq/examples/tree/main/ed25519)
- [Arcis Primitives Reference](https://docs.arcium.com/developers/arcis/primitives)
- [Solana Web3.js](https://solana.com/docs/rpc)
- [Claude API](https://docs.anthropic.com)

## 📄 License

MIT
