import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import { uploadCircuit } from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const kpFile = fs.readFileSync(os.homedir() + "/.config/solana/id.json");
  const owner = Keypair.fromSecretKey(new Uint8Array(JSON.parse(kpFile.toString())));
  const wallet = new anchor.Wallet(owner);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const programId = new PublicKey("EvuXy5xNCSiR1AwPyU3Laz8mtaiyK7xnsPpA115UNoXN");
  const rawCircuit = fs.readFileSync("build/sign_transaction.arcis");
  
  console.log("Uploading sign_transaction circuit to devnet...");
  console.log("Circuit size:", rawCircuit.length, "bytes");
  
  try {
    await uploadCircuit(
      provider,
      "sign_transaction",
      programId,
      rawCircuit,
      true,
      500,
      { skipPreflight: true, commitment: "confirmed" },
    );
    console.log("Upload complete!");
  } catch (err: any) {
    console.log("Upload error:", err.message || err);
    console.log("This may be partially uploaded. Continuing...");
  }
}

main().catch(console.error);
