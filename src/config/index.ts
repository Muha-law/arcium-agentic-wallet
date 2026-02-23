import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
export interface AppConfig {
  solana: { rpcUrl: string; wsUrl: string; network: "devnet" | "testnet" | "mainnet-beta"; };
  anthropic: { apiKey: string; model: string; };
  arcium: { clusterOffset: number; mxeProgramId: string; };
  agent: { count: number; decisionIntervalMs: number; maxTradeSol: number; initialFundSol: number; };
  security: { encryptionPassword: string; keyDerivationIterations: number; };
  logging: { level: string; file: string; };
}
export function loadConfig(): AppConfig {
  return {
    solana: { rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", wsUrl: process.env.SOLANA_WS_URL || "wss://api.devnet.solana.com", network: (process.env.SOLANA_NETWORK as any) || "devnet" },
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY || "", model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514" },
    arcium: { clusterOffset: parseInt(process.env.ARCIUM_CLUSTER_OFFSET || "69069069"), mxeProgramId: process.env.ARCIUM_MXE_PROGRAM_ID || "" },
    agent: { count: parseInt(process.env.AGENT_COUNT || "3"), decisionIntervalMs: parseInt(process.env.AGENT_DECISION_INTERVAL_MS || "30000"), maxTradeSol: parseFloat(process.env.AGENT_MAX_TRADE_SOL || "0.5"), initialFundSol: parseFloat(process.env.AGENT_INITIAL_FUND_SOL || "2.0") },
    security: { encryptionPassword: process.env.WALLET_ENCRYPTION_PASSWORD || "", keyDerivationIterations: parseInt(process.env.KEY_DERIVATION_ITERATIONS || "100000") },
    logging: { level: process.env.LOG_LEVEL || "info", file: process.env.LOG_FILE || "./logs/agent.log" },
  };
}
export const config = loadConfig();
