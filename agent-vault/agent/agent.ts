import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs";

async function main() {
  console.log("🤖 Agent Booting...");

  // =============================
  // Load environment
  // =============================

  const walletPath = process.env.ANCHOR_WALLET;
  const rpcUrl = process.env.ANCHOR_PROVIDER_URL;

  if (!walletPath || !rpcUrl) {
    throw new Error("Missing ANCHOR_WALLET or ANCHOR_PROVIDER_URL");
  }

  // =============================
  // Load wallet
  // =============================

  const secret = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const wallet = new Wallet(keypair);

  // =============================
  // Provider
  // =============================

  const connection = new Connection(rpcUrl, "confirmed");

  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: "confirmed" }
  );

  anchor.setProvider(provider);

  // =============================
  // Load IDL + Program
  // =============================

  const idl = JSON.parse(
    fs.readFileSync("./target/idl/agent_vault.json", "utf8")
  );

  const program = new anchor.Program(
    idl as anchor.Idl,
    provider
  );

  console.log("✅ Program ID:", program.programId.toBase58());
  console.log("✅ Agent Wallet:", wallet.publicKey.toBase58());

  // =============================
  // Create Vault
  // =============================

  const vault = Keypair.generate();

  console.log("🪙 Vault Address:", vault.publicKey.toBase58());

  await program.methods
    .initializeVault()
    .accounts({
      vault: vault.publicKey,
      owner: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([vault])
    .rpc();

  console.log("✅ Vault initialized");

  // =============================
  // Deposit 0.5 SOL
  // =============================

  const depositAmount = 0.5 * LAMPORTS_PER_SOL;

  await program.methods
    .deposit(new anchor.BN(depositAmount))
    .accounts({
      vault: vault.publicKey,
      owner: wallet.publicKey,
    })
    .rpc();

  console.log("✅ Deposited 0.5 SOL into vault");

  // =============================
  // Autonomous Decision
  // =============================

  const walletBalance = await connection.getBalance(wallet.publicKey);
  console.log(
    "💰 Wallet Balance:",
    walletBalance / LAMPORTS_PER_SOL,
    "SOL"
  );

  const withdrawAmount = 0.01 * LAMPORTS_PER_SOL;

  console.log("🤖 Decision → Withdraw 0.01 SOL");

  await program.methods
    .withdraw(new anchor.BN(withdrawAmount))
    .accounts({
      vault: vault.publicKey,
      owner: wallet.publicKey,
    })
    .rpc();

  console.log("✅ Withdrawal successful");

  // =============================
  // Final Vault State
  // =============================

  const vaultAccount = await program.account["vault"].fetch(vault.publicKey);

  console.log(
    "🏦 Vault Stored Balance:",
    vaultAccount.balance.toNumber() / LAMPORTS_PER_SOL,
    "SOL"
  );

  console.log("🏁 Agent execution complete");
}

main().catch((err) => {
  console.error("❌ Fatal Error:", err);
});
