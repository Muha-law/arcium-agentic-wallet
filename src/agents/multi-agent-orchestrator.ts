import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { config } from "../config";
import { AgentState, AgentEvent, TradeExecution } from "../config/types";
import { WalletService } from "../wallet/wallet-service";
import { ArciumPrivacyService } from "../arcium/arcium-service";
import { SolanaExecutor } from "../executor/solana-executor";
import {
  ClaudeAgentBrain,
  AGENT_PROFILES,
  generateMarketContext,
} from "./claude-agent";
import { Logger } from "../utils/logger";

const logger = new Logger("Orchestrator");

/**
 * MultiAgentOrchestrator manages multiple AI trading agents, each with
 * its own wallet, strategy, and decision loop.
 * 
 * Each agent:
 * 1. Has an independent MPC-distributed wallet (via Arcium)
 * 2. Uses Claude API with a unique strategy system prompt
 * 3. Makes autonomous trading decisions at regular intervals
 * 4. Executes trades through the Arcium privacy layer
 */
export class MultiAgentOrchestrator {
  private connection: Connection;
  private walletService: WalletService;
  private arciumService: ArciumPrivacyService;
  private executor: SolanaExecutor;
  private agents: Map<string, ClaudeAgentBrain> = new Map();
  private agentStates: Map<string, AgentState> = new Map();
  private eventLog: AgentEvent[] = [];
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, "confirmed");
    this.walletService = new WalletService(this.connection);
    this.arciumService = new ArciumPrivacyService(this.connection);
    this.executor = new SolanaExecutor(this.walletService, this.arciumService, this.connection);
  }

  // ============================================
  // Initialization
  // ============================================

  async initialize(): Promise<void> {
    logger.info("=== Initializing Multi-Agent Orchestrator ===");

    // Initialize Arcium privacy service
    await this.arciumService.initialize();

    // Set up each agent
    const profilesToUse = AGENT_PROFILES.slice(0, config.agent.count);

    for (const profile of profilesToUse) {
      logger.info(`Setting up agent: ${profile.name} (${profile.strategy})`);

      // 1. Create wallet
      const wallet = await this.walletService.createWallet(profile.id);
      logger.info(`  Wallet: ${wallet.publicKey.toBase58()}`);

      // 2. Distribute key to Arcium MPC (if service is ready)
      if (this.arciumService.isReady()) {
        const distributed = await this.arciumService.distributeKeyToMpc(
          wallet.keypair!,
          profile.id
        );
        if (distributed) {
          this.walletService.markAsMpcDistributed(profile.id);
          logger.info(`  Key distributed to MPC nodes ✓`);
        }
      }

      // 3. Create agent brain
      const brain = new ClaudeAgentBrain(profile);
      this.agents.set(profile.id, brain);

      // 4. Initialize agent state
      this.agentStates.set(profile.id, {
        agentId: profile.id,
        walletAddress: wallet.publicKey.toBase58(),
        balanceSol: 0,
        balanceTokens: new Map(),
        totalPnl: 0,
        tradeCount: 0,
        lastDecisionTimestamp: 0,
        isActive: false,
      });

      this.emitEvent({
        type: "wallet_created",
        agentId: profile.id,
        data: { walletAddress: wallet.publicKey.toBase58(), strategy: profile.strategy },
        timestamp: Date.now(),
      });
    }

    logger.info(`=== ${this.agents.size} agents initialized ===`);
  }

  // ============================================
  // Agent Decision Loop
  // ============================================

  async startAll(): Promise<void> {
    logger.info("Starting all agent decision loops...");
    this.isRunning = true;

    for (const [agentId, brain] of this.agents) {
      await this.startAgent(agentId);
    }
  }

  private async startAgent(agentId: string): Promise<void> {
    const state = this.agentStates.get(agentId)!;
    state.isActive = true;

    this.emitEvent({
      type: "agent_started",
      agentId,
      data: { strategy: this.agents.get(agentId)!.getProfile().strategy },
      timestamp: Date.now(),
    });

    // Initial balance check
    try {
      state.balanceSol = await this.executor.getAgentBalance(agentId);
    } catch {
      state.balanceSol = 0;
    }

    // Run first decision immediately
    await this.runDecisionCycle(agentId);

    // Set up recurring decision loop
    const interval = setInterval(
      () => this.runDecisionCycle(agentId),
      config.agent.decisionIntervalMs
    );
    this.intervals.set(agentId, interval);

    logger.info(`Agent ${agentId} decision loop started (interval: ${config.agent.decisionIntervalMs}ms)`);
  }

  private async runDecisionCycle(agentId: string): Promise<void> {
    if (!this.isRunning) return;

    const brain = this.agents.get(agentId);
    const state = this.agentStates.get(agentId);
    if (!brain || !state) return;

    try {
      // Update balance
      try {
        state.balanceSol = await this.executor.getAgentBalance(agentId);
      } catch {
        // Keep last known balance on RPC error
      }

      // Generate market context
      const marketContext = generateMarketContext();

      // Get Claude's decision
      const decision = await brain.makeDecision(state, marketContext);

      this.emitEvent({
        type: "trade_decision",
        agentId,
        data: {
          action: decision.action,
          token: decision.token,
          amount: decision.amountSol,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        },
        timestamp: Date.now(),
      });

      // Execute the trade
      const execution = await this.executor.executeTrade(agentId, decision);

      if (execution.status === "confirmed") {
        state.tradeCount++;
        this.emitEvent({
          type: "trade_executed",
          agentId,
          data: {
            signature: execution.transactionSignature,
            action: decision.action,
            amount: decision.amountSol,
          },
          timestamp: Date.now(),
        });
      } else if (execution.status === "failed") {
        this.emitEvent({
          type: "trade_failed",
          agentId,
          data: { error: execution.error, action: decision.action },
          timestamp: Date.now(),
        });
      }

      state.lastDecisionTimestamp = Date.now();
    } catch (error) {
      logger.error(`Decision cycle failed for agent ${agentId}: ${error}`);
    }
  }

  // ============================================
  // Control
  // ============================================

  async stopAll(): Promise<void> {
    logger.info("Stopping all agents...");
    this.isRunning = false;

    for (const [agentId, interval] of this.intervals) {
      clearInterval(interval);
      const state = this.agentStates.get(agentId);
      if (state) state.isActive = false;

      this.emitEvent({
        type: "agent_stopped",
        agentId,
        data: {},
        timestamp: Date.now(),
      });
    }

    this.intervals.clear();
    logger.info("All agents stopped.");
  }

  // ============================================
  // Event System
  // ============================================

  private emitEvent(event: AgentEvent): void {
    this.eventLog.push(event);
    // Keep last 500 events
    if (this.eventLog.length > 500) {
      this.eventLog = this.eventLog.slice(-500);
    }
  }

  getEventLog(): AgentEvent[] {
    return [...this.eventLog];
  }

  getRecentEvents(count: number = 20): AgentEvent[] {
    return this.eventLog.slice(-count);
  }

  // ============================================
  // State Queries
  // ============================================

  getAgentState(agentId: string): AgentState | undefined {
    return this.agentStates.get(agentId);
  }

  getAllStates(): AgentState[] {
    return Array.from(this.agentStates.values());
  }

  getAgentProfiles() {
    return Array.from(this.agents.entries()).map(([id, brain]) => ({
      ...brain.getProfile(),
      state: this.agentStates.get(id),
    }));
  }
}
