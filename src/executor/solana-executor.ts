import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import { config } from "../config";
import { TradeDecision, TradeExecution } from "../config/types";
import { WalletService } from "../wallet/wallet-service";
import { ArciumPrivacyService } from "../arcium/arcium-service";
import { Logger } from "../utils/logger";

const logger = new Logger("SolanaExecutor");

/**
 * SolanaExecutor translates TradeDecisions into actual Solana devnet
 * transactions. Supports both standard signing and MPC-based signing
 * through Arcium.
 */
export class SolanaExecutor {
  private connection: Connection;
  private walletService: WalletService;
  private arciumService: ArciumPrivacyService;

  constructor(
    walletService: WalletService,
    arciumService: ArciumPrivacyService,
    connection?: Connection
  ) {
    this.connection = connection || new Connection(config.solana.rpcUrl, "confirmed");
    this.walletService = walletService;
    this.arciumService = arciumService;
  }

  /**
   * Execute a trade decision on Solana devnet.
   * Routes through Arcium MPC signing if the wallet is MPC-distributed.
   */
  async executeTrade(agentId: string, decision: TradeDecision): Promise<TradeExecution> {
    const execution: TradeExecution = {
      decision,
      agentId,
      transactionSignature: null,
      status: "pending",
      executedAt: Date.now(),
    };

    try {
      if (decision.action === "hold") {
        execution.status = "confirmed";
        logger.info(`Agent ${agentId}: HOLD — no transaction needed.`);
        return execution;
      }

      const wallet = this.walletService.getWallet(agentId);
      if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

      // Check balance before trading
      const balance = await this.walletService.getBalance(agentId);
      if (decision.action === "buy" && decision.amountSol > balance * 0.9) {
        throw new Error(
          `Insufficient balance: ${balance.toFixed(4)} SOL, tried to use ${decision.amountSol} SOL`
        );
      }

      // Route based on privacy mode
      if (wallet.isMpcDistributed && this.arciumService.isReady()) {
        return await this.executeWithArcium(agentId, decision, execution);
      } else {
        return await this.executeStandard(agentId, decision, execution);
      }
    } catch (error) {
      execution.status = "failed";
      execution.error = String(error);
      logger.error(`Trade execution failed for agent ${agentId}: ${error}`);
      return execution;
    }
  }

  // ============================================
  // Standard Execution (Direct Signing)
  // ============================================

  private async executeStandard(
    agentId: string,
    decision: TradeDecision,
    execution: TradeExecution
  ): Promise<TradeExecution> {
    logger.info(`Executing trade (standard mode) for agent ${agentId}...`);

    const wallet = this.walletService.getWallet(agentId)!;

    switch (decision.action) {
      case "buy":
      case "sell": {
        // On devnet, simulate trades as SOL transfers to a "protocol" address
        // In production, this would integrate with Jupiter/Raydium
        const protocolAddress = this.getProtocolAddress(decision.token);
        const lamports = Math.floor(decision.amountSol * LAMPORTS_PER_SOL);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: protocolAddress,
            lamports,
          })
        );

        execution.status = "submitted";
        const signature = await this.walletService.signAndSendTransaction(agentId, transaction);
        execution.transactionSignature = signature;
        execution.status = "confirmed";

        logger.info(
          `Trade confirmed for agent ${agentId}: ${decision.action} ${decision.amountSol} SOL → ${signature}`
        );
        break;
      }
      case "provide_liquidity": {
        // Simulate LP provision
        logger.info(`Agent ${agentId}: Simulating liquidity provision for ${decision.token}`);
        execution.status = "confirmed";
        execution.transactionSignature = `sim_lp_${Date.now()}`;
        break;
      }
    }

    return execution;
  }

  // ============================================
  // Arcium MPC Execution (Privacy-Preserving)
  // ============================================

  private async executeWithArcium(
    agentId: string,
    decision: TradeDecision,
    execution: TradeExecution
  ): Promise<TradeExecution> {
    logger.info(`Executing trade (Arcium MPC mode) for agent ${agentId}...`);

    // Step 1: Encrypt the trade decision
    const encryptedPayload = await this.arciumService.encryptTradeDecision(decision, agentId);

    // Step 2: Execute through encrypted compute
    const result = await this.arciumService.executeEncryptedTrade(encryptedPayload);

    if (result.success) {
      execution.status = "confirmed";
      execution.transactionSignature = `arcium_${result.computationOffset}`;
      logger.info(
        `Arcium trade confirmed for agent ${agentId}: ${decision.action} → computation ${result.computationOffset}`
      );
    } else {
      execution.status = "failed";
      execution.error = result.error;
    }

    return execution;
  }

  // ============================================
  // Protocol Addresses (Devnet Simulation)
  // ============================================

  /**
   * Get a simulated protocol address for devnet testing.
   * In production, these would be real DEX/AMM program addresses.
   */
  private getProtocolAddress(token: string): PublicKey {
    // Deterministic "protocol" addresses for devnet simulation
    const seeds: Record<string, string> = {
      SOL: "11111111111111111111111111111112",
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    };

    try {
      return new PublicKey(seeds[token] || seeds["SOL"]);
    } catch {
      return new PublicKey(seeds["SOL"]);
    }
  }

  // ============================================
  // Balance Check
  // ============================================

  async getAgentBalance(agentId: string): Promise<number> {
    return this.walletService.getBalance(agentId);
  }
}
