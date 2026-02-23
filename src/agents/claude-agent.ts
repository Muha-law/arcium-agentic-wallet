import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import {
  AgentProfile,
  AgentStrategy,
  TradeDecision,
  TradeAction,
  AgentState,
} from "../config/types";
import { Logger } from "../utils/logger";

const logger = new Logger("ClaudeAgent");

// ============================================
// Agent Strategy Definitions
// ============================================

const STRATEGY_PROMPTS: Record<AgentStrategy, string> = {
  aggressive: `You are an aggressive AI trading agent on Solana devnet. Your strategy:
- You favor high-conviction momentum trades
- You're willing to allocate larger portions of your balance to single trades
- You actively look for breakout opportunities
- You trade frequently, always looking for alpha
- Risk tolerance: HIGH
- Target: Maximize short-term gains even at the cost of higher volatility`,

  conservative: `You are a conservative AI trading agent on Solana devnet. Your strategy:
- You prioritize capital preservation above all
- You only trade when there's a clear, well-supported thesis
- You keep large cash reserves (at least 60% in SOL)
- You take small position sizes and use stop-losses mentally
- Risk tolerance: LOW
- Target: Steady, consistent returns with minimal drawdown`,

  liquidity_provider: `You are a liquidity-providing AI agent on Solana devnet. Your strategy:
- You focus on providing liquidity to DEX pools
- You analyze trading volume and fee generation potential
- You prefer stable, high-volume pairs
- You monitor impermanent loss and rebalance accordingly
- Risk tolerance: MEDIUM
- Target: Generate yield from trading fees with controlled IL exposure`,
};

// ============================================
// Agent Profiles
// ============================================

export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "agent-alpha",
    name: "Alpha Hunter",
    strategy: "aggressive",
    systemPrompt: STRATEGY_PROMPTS.aggressive,
  },
  {
    id: "agent-sentinel",
    name: "Sentinel",
    strategy: "conservative",
    systemPrompt: STRATEGY_PROMPTS.conservative,
  },
  {
    id: "agent-flow",
    name: "Flow Provider",
    strategy: "liquidity_provider",
    systemPrompt: STRATEGY_PROMPTS.liquidity_provider,
  },
];

// ============================================
// Claude Agent Brain
// ============================================

export class ClaudeAgentBrain {
  private client: Anthropic;
  private profile: AgentProfile;
  private decisionHistory: TradeDecision[] = [];

  constructor(profile: AgentProfile) {
    this.client = new Anthropic({ apiKey: config.anthropic.apiKey });
    this.profile = profile;
  }

  /**
   * Make a trading decision based on current state and market conditions.
   * Claude analyzes the agent's portfolio, recent trades, and simulated
   * market data to produce a structured trading decision.
   */
  async makeDecision(state: AgentState, marketContext: string): Promise<TradeDecision> {
    logger.info(`Agent ${this.profile.name} (${this.profile.strategy}) making decision...`);

    const recentDecisions = this.decisionHistory.slice(-5).map((d) => 
      `${d.action} ${d.amountSol} SOL on ${d.token} (confidence: ${d.confidence}) — ${d.reasoning}`
    ).join("\n");

    const userMessage = `
CURRENT STATE:
- Wallet balance: ${state.balanceSol.toFixed(4)} SOL
- Total P&L: ${state.totalPnl >= 0 ? "+" : ""}${state.totalPnl.toFixed(4)} SOL
- Trade count: ${state.tradeCount}
- Max trade size: ${config.agent.maxTradeSol} SOL

MARKET CONTEXT (Devnet Simulation):
${marketContext}

RECENT DECISIONS:
${recentDecisions || "No previous decisions."}

Based on your strategy and the current state, what is your next trading decision?

Respond ONLY with a JSON object in this exact format:
{
  "action": "buy" | "sell" | "hold" | "provide_liquidity",
  "token": "SOL" | "USDC" | "BONK",
  "amountSol": <number between 0 and ${config.agent.maxTradeSol}>,
  "reasoning": "<brief explanation of your decision>",
  "confidence": <number between 0 and 1>
}`;

    try {
      const response = await this.client.messages.create({
        model: config.anthropic.model,
        max_tokens: 500,
        system: this.profile.systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Claude");
      }

      // Parse the JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in Claude response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const decision: TradeDecision = {
        action: this.validateAction(parsed.action),
        token: parsed.token || "SOL",
        amountSol: Math.min(Math.max(0, parsed.amountSol || 0), config.agent.maxTradeSol),
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: Math.min(Math.max(0, parsed.confidence || 0.5), 1),
        timestamp: Date.now(),
      };

      this.decisionHistory.push(decision);
      
      logger.info(
        `Agent ${this.profile.name} decided: ${decision.action} ${decision.amountSol} SOL ` +
        `on ${decision.token} (confidence: ${decision.confidence.toFixed(2)})`
      );
      logger.info(`Reasoning: ${decision.reasoning}`);

      return decision;
    } catch (error) {
      logger.error(`Decision-making failed for ${this.profile.name}: ${error}`);
      
      // Fallback to hold on error
      return {
        action: "hold",
        token: "SOL",
        amountSol: 0,
        reasoning: `Error in decision-making: ${error}. Defaulting to hold.`,
        confidence: 0,
        timestamp: Date.now(),
      };
    }
  }

  private validateAction(action: string): TradeAction {
    const valid: TradeAction[] = ["buy", "sell", "hold", "provide_liquidity"];
    return valid.includes(action as TradeAction) ? (action as TradeAction) : "hold";
  }

  getProfile(): AgentProfile {
    return this.profile;
  }

  getDecisionHistory(): TradeDecision[] {
    return [...this.decisionHistory];
  }
}

// ============================================
// Market Context Generator (Devnet Simulation)
// ============================================

export function generateMarketContext(): string {
  // Simulated market data for devnet testing
  const solPrice = 120 + Math.random() * 40 - 20; // $100-$140
  const volume24h = Math.floor(Math.random() * 500_000_000) + 100_000_000;
  const trend = Math.random() > 0.5 ? "bullish" : "bearish";
  const volatility = Math.random() > 0.6 ? "high" : "moderate";

  return `
SOL/USD: $${solPrice.toFixed(2)} (${trend} trend)
24h Volume: $${(volume24h / 1_000_000).toFixed(1)}M
Volatility: ${volatility}
Network TPS: ${Math.floor(Math.random() * 3000) + 1000}
Gas (priority fee): ${(Math.random() * 0.001).toFixed(6)} SOL
Note: This is a devnet simulation. All trades use test tokens.`;
}
