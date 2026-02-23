# SKILLS.md — Arcium Agentic Wallet

> This file is designed to be read by AI agents. It describes the capabilities,
> interfaces, and usage patterns of the Arcium Agentic Wallet system.

## What This System Does

This is an autonomous AI agent wallet system built on Solana with Arcium privacy
infrastructure. It enables AI agents to:

1. **Create and control wallets programmatically** without human intervention
2. **Sign transactions via MPC threshold signing** — private keys are split
   across Arcium's MPC nodes and never exist in a single location
3. **Execute trades with encrypted parameters** — trading decisions are encrypted
   before on-chain submission, preventing front-running and strategy leaking
4. **Operate autonomously** using Claude AI for decision-making with configurable
   trading strategies

## Architecture Overview

```
Claude AI Brain → Encrypted Decision → Arcium MPC Layer → Signed Tx → Solana Devnet
```

### Components

| Component | Path | Purpose |
|-----------|------|---------|
| WalletService | `src/wallet/wallet-service.ts` | Wallet creation, encrypted key storage, balance queries |
| ArciumPrivacyService | `src/arcium/arcium-service.ts` | MPC key distribution, threshold signing, encrypted trade execution |
| ClaudeAgentBrain | `src/agents/claude-agent.ts` | AI decision-making via Claude API with strategy prompts |
| SolanaExecutor | `src/executor/solana-executor.ts` | Transaction construction and broadcast to Solana devnet |
| MultiAgentOrchestrator | `src/agents/multi-agent-orchestrator.ts` | Manages multiple agents with independent wallets and strategies |
| Arcis Circuits | `circuits/src/lib.rs` | Rust MPC circuits for threshold signing and encrypted trade execution |

## How to Use This System as an AI Agent

### 1. Create a Wallet

```typescript
import { WalletService } from "./src/wallet/wallet-service";
const walletService = new WalletService();
const wallet = await walletService.createWallet("my-agent-id");
// wallet.publicKey — your Solana address
// wallet.keypair — available until MPC distribution
```

### 2. Distribute Key to MPC (Privacy Mode)

```typescript
import { ArciumPrivacyService } from "./src/arcium/arcium-service";
const arcium = new ArciumPrivacyService();
await arcium.initialize();
await arcium.distributeKeyToMpc(wallet.keypair, "my-agent-id");
walletService.markAsMpcDistributed("my-agent-id");
// Local key is now destroyed. Signing goes through Arcium MPC.
```

### 3. Make a Trading Decision

```typescript
import { ClaudeAgentBrain, AGENT_PROFILES } from "./src/agents/claude-agent";
const brain = new ClaudeAgentBrain(AGENT_PROFILES[0]); // aggressive strategy
const decision = await brain.makeDecision(agentState, marketContext);
// decision: { action, token, amountSol, reasoning, confidence }
```

### 4. Execute a Trade

```typescript
import { SolanaExecutor } from "./src/executor/solana-executor";
const executor = new SolanaExecutor(walletService, arcium);
const result = await executor.executeTrade("my-agent-id", decision);
// Automatically routes through Arcium MPC if wallet is MPC-distributed
```

## Agent Strategies

| Strategy | Risk | Behavior |
|----------|------|----------|
| `aggressive` | HIGH | Momentum trades, large positions, frequent trading |
| `conservative` | LOW | Capital preservation, small positions, high cash reserves |
| `liquidity_provider` | MEDIUM | DEX liquidity provision, fee generation, IL monitoring |

## Security Model

- **Key-at-rest**: AES-256-GCM encryption with PBKDF2 key derivation
- **Key-in-use**: MPC threshold signing via Arcium (2-of-3 by default)
- **Trade privacy**: x25519 ECDH encryption of trade parameters before on-chain submission
- **Agent isolation**: Each agent has independent wallet, strategy, and decision loop

## Environment Requirements

- Node.js >= 18
- Solana CLI (devnet)
- Arcium CLI (`arcup`)
- Anthropic API key (Claude)
- Solana devnet SOL for gas

## Network

- Solana: devnet (`https://api.devnet.solana.com`)
- Arcium: public testnet (on Solana devnet)
