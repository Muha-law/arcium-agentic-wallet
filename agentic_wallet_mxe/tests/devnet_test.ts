import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { AgenticWalletMxe } from "../target/types/agentic_wallet_mxe";
import { randomBytes } from "crypto";
import {
  arcisEd25519,
  awaitComputationFinalization,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgramId,
  getArciumProgram,
  uploadCircuit,
  getMXEPublicKey,
  getMXEAccAddress,
  getMXEArcisEd25519VerifyingKey,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  getClusterAccAddress,
  getLookupTableAddress,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";

const CLUSTER_OFFSET = 456;

async function main() {
  console.log("=== ARCIUM AGENTIC WALLET — DEVNET TEST ===\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const keypairFile = fs.readFileSync(`${os.homedir()}/.config/solana/id.json`);
  const owner = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairFile.toString())));

  console.log("Wallet:", owner.publicKey.toString());
  const balance = await connection.getBalance(owner.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");

  // Setup Anchor
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program
  const idl = JSON.parse(fs.readFileSync("target/idl/agentic_wallet_mxe.json", "utf8"));
  const programId = new PublicKey("EvuXy5xNCSiR1AwPyU3Laz8mtaiyK7xnsPpA115UNoXN");
  const program = new anchor.Program(idl, provider) as Program<AgenticWalletMxe>;
  const arciumProgram = getArciumProgram(provider);

  const clusterAccount = getClusterAccAddress(CLUSTER_OFFSET);
  console.log("Program ID:", programId.toString());
  console.log("Cluster offset:", CLUSTER_OFFSET);
  console.log("Cluster account:", clusterAccount.toString());

  // Step 1: Initialize sign_transaction comp def
  console.log("\n--- Step 1: Initialize Computation Definition ---");
  try {
    const baseSeed = getArciumAccountBaseSeed("ComputationDefinitionAccount");
    const offset = getCompDefAccOffset("sign_transaction");
    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeed, programId.toBuffer(), offset],
      getArciumProgramId(),
    )[0];

    console.log("Comp def PDA:", compDefPDA.toString());

    const mxeAccount = getMXEAccAddress(programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(programId, mxeAcc.lutOffsetSlot);

    const sig = await program.methods
      .initSignTransactionCompDef()
      .accounts({
        compDefAccount: compDefPDA,
        payer: owner.publicKey,
        mxeAccount,
        addressLookupTable: lutAddress,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });
    console.log("Init comp def tx:", sig);

    // Upload circuit
    console.log("Uploading sign_transaction circuit...");
    const rawCircuit = fs.readFileSync("build/sign_transaction.arcis");
    await uploadCircuit(
      provider,
      "sign_transaction",
      programId,
      rawCircuit,
      true,
      500,
      { skipPreflight: true, preflightCommitment: "confirmed", commitment: "confirmed" },
    );
    console.log("Circuit uploaded successfully!");
  } catch (err: any) {
    if (err.toString().includes("already in use")) {
      console.log("Comp def already initialized — skipping.");
    } else {
      console.log("Init error (may already exist):", err.message || err);
    }
  }

  // Step 2: Sign a message
  console.log("\n--- Step 2: MPC Sign Transaction ---");
  const message = randomBytes(32);
  console.log("Message (hex):", Buffer.from(message).toString("hex"));

  // Listen for event
  const signEventPromise = new Promise<{ signature: number[] }>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for signature event")), 120000);
    const listenerId = program.addEventListener("transactionSignedEvent", (event: any) => {
      clearTimeout(timeout);
      program.removeEventListener(listenerId);
      resolve(event);
    });
  });

  const computationOffset = new anchor.BN(randomBytes(8), "hex");
  console.log("Submitting to Arcium devnet MPC network...");

  const queueSig = await program.methods
    .signTransaction(computationOffset, Array.from(message))
    .accountsPartial({
      computationAccount: getComputationAccAddress(CLUSTER_OFFSET, computationOffset),
      clusterAccount,
      mxeAccount: getMXEAccAddress(programId),
      mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET),
      executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
      compDefAccount: getCompDefAccAddress(
        programId,
        Buffer.from(getCompDefAccOffset("sign_transaction")).readUInt32LE(),
      ),
    })
    .rpc({ skipPreflight: true, preflightCommitment: "confirmed", commitment: "confirmed" });
  console.log("Queue tx:", queueSig);

  console.log("Waiting for MPC computation to finalize...");
  const finSig = await awaitComputationFinalization(
    provider,
    computationOffset,
    programId,
    "confirmed",
  );
  console.log("Finalized:", finSig);

  const signEvent = await signEventPromise;
  const signature = new Uint8Array(signEvent.signature);
  console.log("\nMPC Signature (hex):", Buffer.from(signature).toString("hex"));

  // Step 3: Verify
  console.log("\n--- Step 3: Verify Signature ---");
  const verifyingKey = await getMXEArcisEd25519VerifyingKey(provider, programId);
  console.log("MXE Verifying Key:", Buffer.from(verifyingKey).toString("hex"));

  const isValid = arcisEd25519.verify(signature, message, verifyingKey);
  console.log("Signature valid:", isValid);

  console.log("\n=== DEVNET MPC SIGNING " + (isValid ? "PASSED ✓" : "FAILED ✗") + " ===");
  console.log("Explorer: https://explorer.solana.com/tx/" + queueSig + "?cluster=devnet");
  
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
