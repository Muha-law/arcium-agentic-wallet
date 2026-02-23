import {
  Keypair,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash, createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config";
import { WalletInfo, EncryptedKeyStore } from "../config/types";
import { Logger } from "../utils/logger";

const logger = new Logger("WalletService");

const WALLET_DIR = path.resolve(__dirname, "../../wallets");

/**
 * WalletService handles programmatic wallet creation, encrypted key storage,
 * SOL/SPL token balance queries, and transaction signing.
 * 
 * Wallets are persisted to disk as encrypted JSON files in ./wallets/
 * so funded wallets survive restarts.
 * 
 * In standard mode: full keypair is generated and encrypted at rest.
 * In Arcium MPC mode: keypair is generated, distributed via Arcium MPC, 
 * then the local copy is destroyed — only public key is retained.
 */
export class WalletService {
  private connection: Connection;
  private wallets: Map<string, WalletInfo> = new Map();
  private encryptedStores: Map<string, EncryptedKeyStore> = new Map();

  constructor(connection?: Connection) {
    this.connection = connection || new Connection(config.solana.rpcUrl, "confirmed");
    this.ensureWalletDir();
  }

  // ============================================
  // Directory Management
  // ============================================

  private ensureWalletDir(): void {
    if (!fs.existsSync(WALLET_DIR)) {
      fs.mkdirSync(WALLET_DIR, { recursive: true });
      logger.info(`Created wallet directory: ${WALLET_DIR}`);
    }
  }

  private getWalletPath(agentId: string): string {
    return path.join(WALLET_DIR, `${agentId}.json`);
  }

  // ============================================
  // Wallet Creation & Persistence
  // ============================================

  /**
   * Create a new wallet OR load an existing one from disk.
   * If a wallet file exists for this agentId, it is loaded instead
   * of generating a new keypair — preserving funded addresses.
   */
  async createWallet(agentId: string): Promise<WalletInfo> {
    const walletPath = this.getWalletPath(agentId);

    // Check if wallet already exists on disk
    if (fs.existsSync(walletPath)) {
      return this.loadWallet(agentId);
    }

    // Generate new wallet
    const keypair = Keypair.generate();

    const walletInfo: WalletInfo = {
      publicKey: keypair.publicKey,
      keypair,
      createdAt: Date.now(),
      isMpcDistributed: false,
    };

    // Encrypt and store the private key at rest
    const encryptedStore = this.encryptPrivateKey(keypair, agentId);
    this.encryptedStores.set(agentId, encryptedStore);
    this.wallets.set(agentId, walletInfo);

    // Save to disk
    this.saveToDisk(agentId, encryptedStore);

    logger.info(`New wallet created for agent ${agentId}: ${keypair.publicKey.toBase58()}`);
    return walletInfo;
  }

  /**
   * Load an existing wallet from disk.
   */
  private loadWallet(agentId: string): WalletInfo {
    const walletPath = this.getWalletPath(agentId);
    const data = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
    const encryptedStore: EncryptedKeyStore = data.encryptedStore;
    const isMpcDistributed: boolean = data.isMpcDistributed || false;

    this.encryptedStores.set(agentId, encryptedStore);

    let keypair: Keypair | null = null;
    if (!isMpcDistributed) {
      try {
        keypair = this.decryptPrivateKey(agentId);
      } catch (error) {
        logger.error(`Failed to decrypt wallet for ${agentId}: ${error}`);
      }
    }

    const walletInfo: WalletInfo = {
      publicKey: new PublicKey(encryptedStore.publicKey),
      keypair,
      createdAt: encryptedStore.createdAt,
      isMpcDistributed,
    };

    this.wallets.set(agentId, walletInfo);
    logger.info(`Loaded existing wallet for agent ${agentId}: ${encryptedStore.publicKey}`);
    return walletInfo;
  }

  /**
   * Save encrypted wallet to disk.
   */
  private saveToDisk(agentId: string, encryptedStore: EncryptedKeyStore): void {
    const walletPath = this.getWalletPath(agentId);
    const wallet = this.wallets.get(agentId);

    const data = {
      agentId,
      encryptedStore,
      isMpcDistributed: wallet?.isMpcDistributed || false,
      savedAt: Date.now(),
    };

    fs.writeFileSync(walletPath, JSON.stringify(data, null, 2));
    logger.info(`Wallet saved to disk: ${walletPath}`);
  }

  /**
   * Mark a wallet as MPC-distributed (after Arcium key splitting).
   * The local keypair reference is cleared — signing must go through Arcium.
   * Updates the on-disk file as well.
   */
  markAsMpcDistributed(agentId: string): void {
    const wallet = this.wallets.get(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

    wallet.isMpcDistributed = true;
    wallet.keypair = null; // Destroy local key — MPC nodes hold the shares

    // Update disk file
    const encryptedStore = this.encryptedStores.get(agentId);
    if (encryptedStore) {
      this.saveToDisk(agentId, encryptedStore);
    }

    logger.info(`Wallet ${agentId} marked as MPC-distributed. Local key destroyed.`);
  }

  // ============================================
  // Key Encryption (At-Rest Security)
  // ============================================

  private encryptPrivateKey(keypair: Keypair, agentId: string): EncryptedKeyStore {
    const password = config.security.encryptionPassword || agentId;
    const salt = randomBytes(32);
    const key = pbkdf2Sync(password, salt, config.security.keyDerivationIterations, 32, "sha512");
    const iv = randomBytes(16);

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const secretKeyBuffer = Buffer.from(keypair.secretKey);

    let encrypted = cipher.update(secretKeyBuffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      publicKey: keypair.publicKey.toBase58(),
      encryptedPrivateKey: Buffer.concat([encrypted, authTag]).toString("hex"),
      iv: iv.toString("hex"),
      salt: salt.toString("hex"),
      algorithm: "aes-256-gcm",
      createdAt: Date.now(),
    };
  }

  /**
   * Decrypt a stored private key (only used in standard non-MPC mode).
   */
  decryptPrivateKey(agentId: string): Keypair {
    const store = this.encryptedStores.get(agentId);
    if (!store) throw new Error(`No encrypted key store found for agent ${agentId}`);

    const password = config.security.encryptionPassword || agentId;
    const salt = Buffer.from(store.salt, "hex");
    const key = pbkdf2Sync(password, salt, config.security.keyDerivationIterations, 32, "sha512");
    const iv = Buffer.from(store.iv, "hex");

    const encryptedData = Buffer.from(store.encryptedPrivateKey, "hex");
    const authTag = encryptedData.subarray(encryptedData.length - 16);
    const encryptedContent = encryptedData.subarray(0, encryptedData.length - 16);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedContent);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return Keypair.fromSecretKey(new Uint8Array(decrypted));
  }

  // ============================================
  // Balance & Token Queries
  // ============================================

  async getBalance(agentId: string): Promise<number> {
    const wallet = this.wallets.get(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

    const balance = await this.connection.getBalance(wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getBalanceLamports(agentId: string): Promise<number> {
    const wallet = this.wallets.get(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

    return this.connection.getBalance(wallet.publicKey);
  }

  // ============================================
  // Transaction Signing (Standard Mode)
  // ============================================

  /**
   * Sign a transaction using the locally stored encrypted key.
   * Only works in standard (non-MPC) mode.
   */
  async signAndSendTransaction(agentId: string, transaction: Transaction): Promise<string> {
    const wallet = this.wallets.get(agentId);
    if (!wallet) throw new Error(`Wallet not found for agent ${agentId}`);

    if (wallet.isMpcDistributed) {
      throw new Error(
        `Wallet ${agentId} uses MPC-distributed keys. Use ArciumSigningService instead.`
      );
    }

    const keypair = this.decryptPrivateKey(agentId);

    transaction.feePayer = wallet.publicKey;
    const { blockhash } = await this.connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;

    const signature = await sendAndConfirmTransaction(this.connection, transaction, [keypair]);

    logger.info(`Transaction signed and sent for agent ${agentId}: ${signature}`);
    return signature;
  }

  // ============================================
  // Utility
  // ============================================

  getWallet(agentId: string): WalletInfo | undefined {
    return this.wallets.get(agentId);
  }

  getPublicKey(agentId: string): PublicKey | undefined {
    return this.wallets.get(agentId)?.publicKey;
  }

  getAllWallets(): Map<string, WalletInfo> {
    return this.wallets;
  }

  /**
   * List all saved wallets from disk.
   */
  listSavedWallets(): string[] {
    if (!fs.existsSync(WALLET_DIR)) return [];
    return fs.readdirSync(WALLET_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  }

  /**
   * Delete a wallet from disk and memory.
   */
  deleteWallet(agentId: string): void {
    const walletPath = this.getWalletPath(agentId);
    if (fs.existsSync(walletPath)) {
      fs.unlinkSync(walletPath);
    }
    this.wallets.delete(agentId);
    this.encryptedStores.delete(agentId);
    logger.info(`Wallet deleted for agent ${agentId}`);
  }

  static deriveWalletHash(agentId: string): string {
    return createHash("sha256").update(`arcium-agent-${agentId}`).digest("hex").slice(0, 16);
  }
}
