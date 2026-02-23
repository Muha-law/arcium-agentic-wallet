import { MultiAgentOrchestrator } from "./agents/multi-agent-orchestrator";
import { Logger } from "./utils/logger";

const logger = new Logger("Main");

const BANNER = `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🔐  ARCIUM AGENTIC WALLET                                 ║
║                                                              ║
║   Autonomous AI Agent Wallets on Solana                      ║
║   Powered by Claude AI + Arcium MPC Privacy                  ║
║                                                              ║
║   • MPC-distributed keys — no single point of failure        ║
║   • Encrypted trade execution — no front-running             ║
║   • Multi-agent autonomous trading                           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  const orchestrator = new MultiAgentOrchestrator();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    await orchestrator.stopAll();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    // Initialize all agents, wallets, and Arcium connections
    await orchestrator.initialize();

    // Start autonomous decision loops
    await orchestrator.startAll();

    // Keep the process alive and periodically log status
    setInterval(() => {
      const states = orchestrator.getAllStates();
      logger.info("--- Agent Status ---");
      for (const state of states) {
        logger.info(
          `  ${state.agentId}: ${state.balanceSol.toFixed(4)} SOL | ` +
          `Trades: ${state.tradeCount} | ` +
          `Active: ${state.isActive ? "✓" : "✗"}`
        );
      }

      const events = orchestrator.getRecentEvents(5);
      if (events.length > 0) {
        logger.info("--- Recent Events ---");
        for (const event of events) {
          logger.info(`  [${event.type}] ${event.agentId}: ${JSON.stringify(event.data)}`);
        }
      }
    }, 60_000); // Log every minute

  } catch (error) {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  }
}

main().catch(console.error);
