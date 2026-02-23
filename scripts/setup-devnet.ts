import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { WalletService } from "../src/wallet/wallet-service";
import { config } from "../src/config";
import { Logger } from "../src/utils/logger";

const logger = new Logger("DevnetSetup");

/**
 * Setup script: creates agent wallets and airdrops devnet SOL.
 * Run with: npx ts-node scripts/setup-devnet.ts
 */
async function setup() {
  logger.info("=== Devnet Setup ===");
  
  const connection = new Connection(config.solana.rpcUrl, "confirmed");
  const walletService = new WalletService(connection);

  const agentIds = ["agent-alpha", "agent-sentinel", "agent-flow"];
  
  for (const agentId of agentIds.slice(0, config.agent.count)) {
    logger.info(`Creating wallet for ${agentId}...`);
    const wallet = await walletService.createWallet(agentId);
    logger.info(`  Address: ${wallet.publicKey.toBase58()}`);

    // Airdrop devnet SOL
    logger.info(`  Requesting airdrop of ${config.agent.initialFundSol} SOL...`);
    try {
      const sig = await connection.requestAirdrop(
        wallet.publicKey,
        config.agent.initialFundSol * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig, "confirmed");
      
      const balance = await connection.getBalance(wallet.publicKey);
      logger.success(`  Funded: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    } catch (error) {
      logger.warn(`  Airdrop failed (rate limited?). Try: solana airdrop 2 ${wallet.publicKey.toBase58()} -u devnet`);
    }
  }

  logger.info("=== Setup Complete ===");
}

setup().catch(console.error);
