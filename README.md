# 🔐 Arcium Agentic Wallet

**Autonomous AI Agent Wallets on Solana with Arcium MPC Privacy Infrastructure**

AI-powered wallet system where autonomous agents create wallets, make trading decisions via Claude AI, and execute transactions through Arcium's Multi-Party Computation network — ensuring private keys never exist in a single location and trading strategies remain encrypted on-chain.

> **Hackathon Bounty**: Solana Agentic Wallet Infrastructure with Arcium MPC

---

## ✅ What We Built & Proved

### MPC Ed25519 Signing — Tested & Working

We built and deployed two Arcis circuits on the Arcium MPC network:

**1. `sign_transaction`** — Distributed Ed25519 signing where the private key is split across MPC nodes. No single node ever holds the full key.

```rust
// encrypted-ixs/src/lib.rs — just 5 lines of MPC logic
#[instruction]
pub fn sign_transaction(message: [u8; 32]) -> ArcisEd25519Signature {
    let signature = MXESigningKey::sign(&message);
    signature.reveal()
}
```

**2. `verify_agent_signature`** — Confidential signature verification where the public key remains encrypted throughout the process. Only the boolean result is revealed.

### Test Output (Real MPC, Not Simulated)

```
Initializing sign_transaction computation definition
Comp def PDA: 2rt1ZSPqjoabKtZw7Dro27T7dVD8VucKnKoEv1SVVe72
Init sign_transaction comp def tx: 2MV2JDt...

Signing message with MPC Ed25519...
Message (hex): 4954be8e683e0562dbec189595ce3a705a8836dc650c5f56be594c89a56eb364
Queue signature tx: c9ivbjqfK4sBe3fuSvsan4qBRNLJdX22x1EuEXr565u...
MPC Signature (hex): b1233c9e9f8da0c496b096cc9611335d968b23d5214b8ef1...
MXE Verifying Key (hex): b00de34e725e75a7c8ba2028ee4f259462851abe537154ef...
Signature valid: true

=== MPC WALLET SIGNING TEST PASSED ===
The MPC network collectively signed a transaction
without any single node having the full private key.
  ✔ Signs a transaction with MPC Ed25519 (24856ms)
  1 passing (25s)
```

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────┐
│              Claude AI Agent Brain                │
│    (Claude API — strategy-based decisions)        │
│    Agent 1: Aggressive  Agent 2: Conservative     │
│    Agent 3: Liquidity Provider                    │
└───────────────────┬──────────────────────────────┘
                    │ trading decisions
                    ▼
┌──────────────────────────────────────────────────┐
│          Arcium MPC Privacy Layer                 │
│                                                   │
│  Arcis Circuit: sign_transaction                  │
│    → MXESigningKey::sign() across MPC nodes       │
│    → Ed25519 signature without key reconstruction │
│                                                   │
│  Arcis Circuit: verify_agent_signature            │
│    → Encrypted public key verification            │
│    → Only boolean result revealed to observer     │
│                                                   │
│  x25519 ECDH Encryption                          │
│    → Trade params encrypted before submission     │
│    → Front-running and copy-trading prevention    │
│                                                   │
└───────────────────┬──────────────────────────────┘
                    │ MPC-signed transactions
                    ▼
┌──────────────────────────────────────────────────┐
│            Solana Devnet Executor                  │
│    • Transaction broadcast & confirmation          │
│    • Balance monitoring per agent                  │
└──────────────────────────────────────────────────┘
```

## ✨ Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| **MPC Ed25519 Signing** | ✅ Tested | Private keys distributed across Arcium MPC nodes. Collective signing produces valid Ed25519 signatures without key reconstruction. |
| **Confidential Verification** | ✅ Built | Verify signatures against encrypted public keys — identity remains private. |
| **x25519 Trade Encryption** | ✅ Integrated | Trade decisions encrypted via ECDH with MXE public key before on-chain submission. |
| **Multi-Agent Autonomy** | ✅ Running | 3 independent AI agents with unique strategies, wallets, and decision loops. |
| **Claude AI Brain** | ✅ Running | Each agent uses Claude API with strategy-specific prompts for autonomous trading. |
| **Persistent Wallets** | ✅ Working | AES-256-GCM encrypted wallet storage that survives restarts. |
| **Auto-Fallback** | ✅ Working | System auto-detects live Arcium connection; falls back to simulation when unavailable. |

## 🔧 Tech Stack

| Component | Technology |
|-----------|-----------|
| Agent Brain | Claude API (Anthropic) — TypeScript |
| MPC Circuits | Arcium Arcis (Rust) — `sign_transaction`, `verify_agent_signature` |
| On-Chain Program | Anchor + `arcium-anchor` macros |
| Arcium Client | `@arcium-hq/client` (x25519, RescueCipher, arcisEd25519) |
| Solana | `@solana/web3.js` — devnet |
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
│   │   └── wallet-service.ts              # Wallet creation, AES encryption, persistence
│   ├── arcium/
│   │   └── arcium-service.ts              # Real Arcium MPC integration
│   ├── executor/
│   │   └── solana-executor.ts             # Solana transaction builder
│   ├── config/
│   │   ├── index.ts                       # Environment configuration
│   │   └── types.ts                       # Shared type definitions
│   └── utils/
│       └── logger.ts                      # Timestamped logging
│
├── agentic_wallet_mxe/                    # Arcium MXE project
│   ├── encrypted-ixs/src/lib.rs           # Arcis circuits (MPC logic)
│   ├── programs/agentic_wallet_mxe/
│   │   └── src/lib.rs                     # Anchor program (on-chain)
│   ├── tests/agentic_wallet_mxe.ts        # MPC signing test
│   ├── Arcium.toml                        # Arcium config
│   └── Anchor.toml                        # Anchor config
│
├── wallets/                               # Encrypted wallet storage
├── .env.example                           # Environment template
├── package.json
└── tsconfig.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Rust (via rustup)
- Solana CLI 2.2.x (`solana --version`)
- Anchor CLI 0.32.1 (`anchor --version`)
- Arcium CLI 0.8.4 (`arcup install`)
- Docker Desktop (for Arcium localnet)
- An Anthropic API key

### Setup & Run

```bash
# Clone
git clone https://github.com/your-username/arcium-agentic-wallet.git
cd arcium-agentic-wallet

# Install TS dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env: add ANTHROPIC_API_KEY

# Run the multi-agent system
npx ts-node src/index.ts
```

### Test MPC Signing (Arcium Localnet)

```bash
# Ensure Docker Desktop is running
cd agentic_wallet_mxe

# Build the Arcis circuits + Anchor program
arcium build

# Run the full MPC signing test
arcium test
# → Spins up 2 MPC nodes + trusted dealer
# → Deploys sign_transaction circuit
# → Signs a message via distributed Ed25519
# → Verifies the signature: "1 passing"
```

## 🔒 How MPC Signing Works

### Traditional Wallet (Vulnerable)
```
[Private Key] → stored on one machine → single point of failure
```

### Arcium Agentic Wallet (This Project)
```
[Private Key] → NEVER exists in one place
  ↓
MPC Node 1: holds share_1  ─┐
MPC Node 2: holds share_2  ─┼→ collectively produce valid Ed25519 signature
MPC Node N: holds share_n  ─┘
  ↓
[Valid Signature] → broadcast to Solana
```

The Arcium `MXESigningKey::sign()` function handles all the distributed signing protocol internally. Each MPC node executes its portion of the signing algorithm using its key share. The partial signatures combine into a standard Ed25519 signature that anyone can verify against the MXE's public key.

### What This Prevents

- **Key Theft**: No single machine holds the complete private key
- **Front-Running**: Trade decisions are x25519-encrypted before submission
- **Copy-Trading**: Competitors cannot read strategy parameters on-chain
- **Identity Linking**: Confidential verification hides which key signed

## 🤖 Agent Strategies

| Agent | Strategy | Risk | Behavior |
|-------|----------|------|----------|
| Alpha Hunter | `aggressive` | HIGH | Momentum trades, large positions, high conviction |
| Sentinel | `conservative` | LOW | Capital preservation, small positions, risk-averse |
| Flow Provider | `liquidity_provider` | MED | DEX liquidity, fee generation, balanced approach |

Each agent receives a unique system prompt and makes independent decisions via Claude API. The orchestrator manages wallets, decision loops, and trade execution independently per agent.

## 📚 Resources

- [Arcium Developer Docs](https://docs.arcium.com/developers)
- [Arcium Ed25519 Example](https://github.com/arcium-hq/examples/tree/main/ed25519)
- [Arcium TypeScript SDK](https://ts.arcium.com/docs)
- [Arcis Primitives Reference](https://docs.arcium.com/developers/arcis/primitives)
- [Solana Web3.js](https://solana.com/docs/rpc)
- [Claude API](https://docs.anthropic.com)

## 📄 License

MIT
