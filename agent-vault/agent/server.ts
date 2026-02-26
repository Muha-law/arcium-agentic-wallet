import express from "express";
import cors from "cors";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

const RPC = process.env.ANCHOR_PROVIDER_URL!;
const WALLET_PATH = process.env.ANCHOR_WALLET!;

const connection = new Connection(RPC, "confirmed");

function loadWallet() {
  const secret = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));
  return secret;
}

app.get("/agent/status", async (_, res) => {
  try {
    const walletSecret = loadWallet();
    const pubkey = new PublicKey(walletSecret.publicKey ?? walletSecret[0]);

    const balance = await connection.getBalance(pubkey);

    res.json({
      wallet: pubkey.toBase58(),
      balance: balance / 1e9,
      status: "online",
    });
  } catch (err) {
    res.status(500).json({ error: "agent status failed" });
  }
});

app.listen(PORT, () => {
  console.log("🤖 Agent API running on port", PORT);
});
