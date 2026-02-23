import { PublicKey, Keypair } from "@solana/web3.js";

// ============================================
// Agent Types
// ============================================

export type AgentStrategy = "aggressive" | "conservative" | "liquidity_provider";

export interface AgentProfile {
  id: string;
  name: string;
  strategy: AgentStrategy;
  systemPrompt: string;
}

export interface AgentState {
  agentId: string;
  walletAddress: string;
  balanceSol: number;
  balanceTokens: Map<string, number>;
  totalPnl: number;
  tradeCount: number;
  lastDecisionTimestamp: number;
  isActive: boolean;
}

// ============================================
// Wallet Types
// ============================================

export interface WalletInfo {
  publicKey: PublicKey;
  /** 
   * In standard mode: the full keypair (for dev/testing).
   * In Arcium MPC mode: null — key is distributed across nodes.
   */
  keypair: Keypair | null;
  createdAt: number;
  isMpcDistributed: boolean;
}

export interface EncryptedKeyStore {
  publicKey: string;
  encryptedPrivateKey: string;
  iv: string;
  salt: string;
  algorithm: string;
  createdAt: number;
}

// ============================================
// Trading Types
// ============================================

export type TradeAction = "buy" | "sell" | "hold" | "provide_liquidity";

export interface TradeDecision {
  action: TradeAction;
  token: string;
  amountSol: number;
  reasoning: string;
  confidence: number; // 0-1
  timestamp: number;
}

export interface TradeExecution {
  decision: TradeDecision;
  agentId: string;
  transactionSignature: string | null;
  status: "pending" | "submitted" | "confirmed" | "failed";
  error?: string;
  executedAt: number;
}

// ============================================
// Arcium Privacy Types
// ============================================

export interface MpcSigningRequest {
  transactionData: Buffer;
  agentId: string;
  walletPublicKey: PublicKey;
  timestamp: number;
}

export interface MpcSigningResponse {
  signature: Buffer;
  computationOffset: string;
  finalizationSignature: string;
  signedAt: number;
}

export interface EncryptedTradePayload {
  encryptedDecision: Uint8Array;
  nonce: Uint8Array;
  clientPublicKey: Uint8Array;
  agentId: string;
}

export interface ArciumComputationResult {
  success: boolean;
  result?: Uint8Array;
  error?: string;
  computationOffset: string;
  gasUsed?: number;
}

// ============================================
// Observer / Dashboard Types
// ============================================

export interface AgentActivity {
  agentId: string;
  agentName: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface DashboardState {
  agents: AgentState[];
  recentActivities: AgentActivity[];
  totalTrades: number;
  totalPnl: number;
  uptime: number;
}

// ============================================
// Event Types
// ============================================

export type EventType =
  | "agent_started"
  | "agent_stopped"
  | "wallet_created"
  | "trade_decision"
  | "trade_executed"
  | "trade_failed"
  | "mpc_signing_requested"
  | "mpc_signing_completed"
  | "balance_updated";

export interface AgentEvent {
  type: EventType;
  agentId: string;
  data: Record<string, unknown>;
  timestamp: number;
}
