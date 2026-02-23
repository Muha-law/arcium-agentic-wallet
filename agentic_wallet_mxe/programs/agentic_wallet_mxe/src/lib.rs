use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

const COMP_DEF_OFFSET_SIGN_TRANSACTION: u32 = comp_def_offset("sign_transaction");
const COMP_DEF_OFFSET_VERIFY_AGENT_SIGNATURE: u32 = comp_def_offset("verify_agent_signature");

declare_id!("EvuXy5xNCSiR1AwPyU3Laz8mtaiyK7xnsPpA115UNoXN");

#[arcium_program]
pub mod agentic_wallet_mxe {
    use super::*;

    pub fn init_sign_transaction_comp_def(
        ctx: Context<InitSignTransactionCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn sign_transaction(
        ctx: Context<SignTransaction>,
        computation_offset: u64,
        message: [u8; 32],
    ) -> Result<()> {
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        let mut builder = ArgBuilder::new();
        for byte in message {
            builder = builder.plaintext_u8(byte);
        }
        queue_computation(
            ctx.accounts,
            computation_offset,
            builder.build(),
            vec![SignTransactionCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "sign_transaction")]
    pub fn sign_transaction_callback(
        ctx: Context<SignTransactionCallback>,
        output: SignedComputationOutputs<SignTransactionOutput>,
    ) -> Result<()> {
        let signature = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(SignTransactionOutput {
                field_0:
                    SignTransactionOutputStruct0 {
                        field_0: r_encoded,
                        field_1: s,
                    },
            }) => {
                let mut signature = [0u8; 64];
                signature[..32].copy_from_slice(&r_encoded);
                signature[32..].copy_from_slice(&s);
                signature
            }
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(TransactionSignedEvent { signature });
        Ok(())
    }

    pub fn init_verify_agent_signature_comp_def(
        ctx: Context<InitVerifyAgentSignatureCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn verify_agent_signature(
        ctx: Context<VerifyAgentSignature>,
        computation_offset: u64,
        one_time_pub_key: [u8; 32],
        one_time_nonce: u128,
        verifying_key_enc_lo: [u8; 32],
        verifying_key_enc_hi: [u8; 32],
        message: [u8; 32],
        signature: [u8; 64],
        observer_pub_key: [u8; 32],
        observer_nonce: u128,
    ) -> Result<()> {
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        let mut builder = ArgBuilder::new()
            .x25519_pubkey(one_time_pub_key)
            .plaintext_u128(one_time_nonce)
            .encrypted_u128(verifying_key_enc_lo)
            .encrypted_u128(verifying_key_enc_hi);
        for byte in message {
            builder = builder.plaintext_u8(byte);
        }
        let args = builder
            .arcis_ed25519_signature(signature)
            .x25519_pubkey(observer_pub_key)
            .plaintext_u128(observer_nonce)
            .build();
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![VerifyAgentSignatureCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "verify_agent_signature")]
    pub fn verify_agent_signature_callback(
        ctx: Context<VerifyAgentSignatureCallback>,
        output: SignedComputationOutputs<VerifyAgentSignatureOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(VerifyAgentSignatureOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(SignatureVerifiedEvent {
            is_valid: o.ciphertexts[0],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }
}

#[queue_computation_accounts("sign_transaction", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct SignTransaction<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SIGN_TRANSACTION))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("sign_transaction")]
#[derive(Accounts)]
pub struct SignTransactionCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SIGN_TRANSACTION))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("sign_transaction", payer)]
#[derive(Accounts)]
pub struct InitSignTransactionCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("verify_agent_signature", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct VerifyAgentSignature<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: mempool_account
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: executing_pool
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VERIFY_AGENT_SIGNATURE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("verify_agent_signature")]
#[derive(Accounts)]
pub struct VerifyAgentSignatureCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VERIFY_AGENT_SIGNATURE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: computation_account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions_sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

#[init_computation_definition_accounts("verify_agent_signature", payer)]
#[derive(Accounts)]
pub struct InitVerifyAgentSignatureCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct TransactionSignedEvent {
    pub signature: [u8; 64],
}

#[event]
pub struct SignatureVerifiedEvent {
    pub is_valid: [u8; 32],
    pub nonce: [u8; 16],
}

#[error_code]
pub enum ErrorCode {
    #[msg("The computation was aborted")]
    AbortedComputation,
    #[msg("Cluster not set")]
    ClusterNotSet,
}
