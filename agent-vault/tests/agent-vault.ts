import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentVault } from "../target/types/agent_vault";
import { Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("agent-vault", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.AgentVault as Program<AgentVault>;
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const owner = provider.wallet;

  const vault = Keypair.generate();
  const agentState = Keypair.generate();

  it("Initializes vault", async () => {
    const tx = await program.methods
      .initializeVault()
      .accounts({
        vault: vault.publicKey,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([vault])
      .rpc({ commitment: "confirmed" });
    console.log("Init vault tx:", tx);

    const vaultAcc = await program.account.vault.fetch(vault.publicKey);
    expect(vaultAcc.owner.toString()).to.equal(owner.publicKey.toString());
    expect(vaultAcc.balance.toNumber()).to.equal(0);
    console.log("Vault owner:", vaultAcc.owner.toString());
  });

  it("Deposits SOL", async () => {
    const amount = 0.05 * LAMPORTS_PER_SOL;
    const tx = await program.methods
      .deposit(new anchor.BN(amount))
      .accounts({
        vault: vault.publicKey,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });
    console.log("Deposit tx:", tx);

    const vaultAcc = await program.account.vault.fetch(vault.publicKey);
    expect(vaultAcc.balance.toNumber()).to.equal(amount);
    console.log("Vault balance:", vaultAcc.balance.toNumber() / LAMPORTS_PER_SOL, "SOL");
  });

  it("Initializes agent state", async () => {
    const tx = await program.methods
      .initializeAgent()
      .accounts({
        agentState: agentState.publicKey,
        owner: owner.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentState])
      .rpc({ commitment: "confirmed" });
    console.log("Init agent tx:", tx);

    const state = await program.account.agentState.fetch(agentState.publicKey);
    expect(state.riskScore).to.equal(50);
    expect(state.executionEnabled).to.equal(true);
    console.log("Risk score:", state.riskScore, "Execution:", state.executionEnabled);
  });

  it("Updates risk score", async () => {
    const tx = await program.methods
      .evaluateAgentAction(30)
      .accounts({
        agentState: agentState.publicKey,
        owner: owner.publicKey,
      })
      .rpc({ commitment: "confirmed" });
    console.log("Update risk tx:", tx);

    const state = await program.account.agentState.fetch(agentState.publicKey);
    expect(state.riskScore).to.equal(30);
    expect(state.executionEnabled).to.equal(true);
    console.log("Risk score:", state.riskScore);
  });

  it("Gated withdraw succeeds with low risk", async () => {
    const amount = 0.02 * LAMPORTS_PER_SOL;
    const balBefore = await provider.connection.getBalance(owner.publicKey);

    const tx = await program.methods
      .gatedWithdraw(new anchor.BN(amount))
      .accounts({
        vault: vault.publicKey,
        agentState: agentState.publicKey,
        owner: owner.publicKey,
      })
      .rpc({ commitment: "confirmed" });
    console.log("Gated withdraw tx:", tx);

    const vaultAcc = await program.account.vault.fetch(vault.publicKey);
    console.log("Vault balance after:", vaultAcc.balance.toNumber() / LAMPORTS_PER_SOL, "SOL");
  });

  it("Blocks withdraw when risk is high", async () => {
    await program.methods
      .evaluateAgentAction(90)
      .accounts({
        agentState: agentState.publicKey,
        owner: owner.publicKey,
      })
      .rpc({ commitment: "confirmed" });

    try {
      await program.methods
        .gatedWithdraw(new anchor.BN(0.01 * LAMPORTS_PER_SOL))
        .accounts({
          vault: vault.publicKey,
          agentState: agentState.publicKey,
          owner: owner.publicKey,
        })
        .rpc({ commitment: "confirmed" });
      throw new Error("Should have failed");
    } catch (err: any) {
      console.log("Correctly blocked high-risk withdraw:", err.error?.errorMessage || "ExecutionBlocked");
      expect(err.error?.errorCode?.code).to.equal("ExecutionBlocked");
    }
  });
});
