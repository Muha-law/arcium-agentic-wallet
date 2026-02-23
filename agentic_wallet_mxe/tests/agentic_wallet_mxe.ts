import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AgenticWalletMxe } from "../target/types/agentic_wallet_mxe";
import { randomBytes } from "crypto";
import {
  arcisEd25519,
  awaitComputationFinalization,
  getArciumEnv,
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
import { expect } from "chai";

describe("AgenticWalletMxe", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace
    .AgenticWalletMxe as Program<AgenticWalletMxe>;
  const provider = anchor.getProvider();
  const arciumProgram = getArciumProgram(provider as anchor.AnchorProvider);

  type Event = anchor.IdlEvents<(typeof program)["idl"]>;
  const awaitEvent = async <E extends keyof Event>(
    eventName: E,
  ): Promise<Event[E]> => {
    let listenerId: number;
    const event = await new Promise<Event[E]>((res) => {
      listenerId = program.addEventListener(eventName, (event) => {
        res(event);
      });
    });
    await program.removeEventListener(listenerId);
    return event;
  };

  const arciumEnv = getArciumEnv();
  const clusterAccount = getClusterAccAddress(arciumEnv.arciumClusterOffset);

  it("Signs a transaction with MPC Ed25519", async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);

    // Initialize the sign_transaction computation definition
    console.log("Initializing sign_transaction computation definition");
    const initSig = await initSignTransactionCompDef(program, owner);
    console.log("sign_transaction comp def initialized:", initSig);

    const mxePublicKey = await getMXEPublicKeyWithRetry(
      provider as anchor.AnchorProvider,
      program.programId,
    );
    console.log("MXE x25519 pubkey:", mxePublicKey);

    // Create a 32-byte message (simulating a transaction hash)
    const message = randomBytes(32);
    console.log("\nSigning message with MPC Ed25519...");
    console.log("Message (hex):", Buffer.from(message).toString("hex"));

    const signEventPromise = awaitEvent("transactionSignedEvent");
    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    const queueSig = await program.methods
      .signTransaction(
        computationOffset,
        Array.from(message),
      )
      .accountsPartial({
        computationAccount: getComputationAccAddress(
          arciumEnv.arciumClusterOffset,
          computationOffset,
        ),
        clusterAccount,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(arciumEnv.arciumClusterOffset),
        executingPool: getExecutingPoolAccAddress(
          arciumEnv.arciumClusterOffset,
        ),
        compDefAccount: getCompDefAccAddress(
          program.programId,
          Buffer.from(getCompDefAccOffset("sign_transaction")).readUInt32LE(),
        ),
      })
      .rpc({ skipPreflight: true, preflightCommitment: "confirmed", commitment: "confirmed" });
    console.log("Queue signature tx:", queueSig);

    await awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      computationOffset,
      program.programId,
      "confirmed",
    );

    const signEvent = await signEventPromise;
    const mxeSignature = new Uint8Array(signEvent.signature);
    console.log("MPC Signature (hex):", Buffer.from(mxeSignature).toString("hex"));

    // Verify the signature using the MXE's public verifying key
    const mxeVerifyingKey = await getMXEArcisEd25519VerifyingKey(
      provider as anchor.AnchorProvider,
      program.programId,
    );
    console.log("MXE Verifying Key (hex):", Buffer.from(mxeVerifyingKey).toString("hex"));

    const isValid = arcisEd25519.verify(mxeSignature, message, mxeVerifyingKey);
    console.log("Signature valid:", isValid);
    expect(isValid).to.equal(true);

    console.log("\n=== MPC WALLET SIGNING TEST PASSED ===");
    console.log("The MPC network collectively signed a transaction");
    console.log("without any single node having the full private key.");
  });

  async function initSignTransactionCompDef(
    program: Program<AgenticWalletMxe>,
    owner: anchor.web3.Keypair,
  ): Promise<string> {
    const baseSeedCompDefAcc = getArciumAccountBaseSeed(
      "ComputationDefinitionAccount",
    );
    const offset = getCompDefAccOffset("sign_transaction");

    const compDefPDA = PublicKey.findProgramAddressSync(
      [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
      getArciumProgramId(),
    )[0];

    console.log("Comp def PDA:", compDefPDA.toString());

    const mxeAccount = getMXEAccAddress(program.programId);
    const mxeAcc = await arciumProgram.account.mxeAccount.fetch(mxeAccount);
    const lutAddress = getLookupTableAddress(program.programId, mxeAcc.lutOffsetSlot);

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
    console.log("Init sign_transaction comp def tx:", sig);

    const rawCircuit = fs.readFileSync("build/sign_transaction.arcis");
    await uploadCircuit(
      provider as anchor.AnchorProvider,
      "sign_transaction",
      program.programId,
      rawCircuit,
      true,
      500,
      {
        skipPreflight: true,
        preflightCommitment: "confirmed",
        commitment: "confirmed",
      },
    );

    return sig;
  }
});

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries: number = 20,
  retryDelayMs: number = 500,
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mxePublicKey = await getMXEPublicKey(provider, programId);
      if (mxePublicKey) {
        return mxePublicKey;
      }
    } catch (error) {
      console.log(`Attempt ${attempt} failed to fetch MXE public key:`, error);
    }
    if (attempt < maxRetries) {
      console.log(
        `Retrying in ${retryDelayMs}ms... (attempt ${attempt}/${maxRetries})`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error(
    `Failed to fetch MXE public key after ${maxRetries} attempts`,
  );
}

function readKpJson(path: string): anchor.web3.Keypair {
  const file = fs.readFileSync(path);
  return anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(file.toString())),
  );
}
