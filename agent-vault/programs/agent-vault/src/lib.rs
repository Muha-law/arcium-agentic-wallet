use anchor_lang::prelude::*;
use anchor_lang::solana_program;

declare_id!("2RaQkqGn8wyMfLEWBRjbz76ZwqrXUJyxvgiKrmMjUtn7");

#[program]
pub mod agent_vault {
    use super::*;

    // =========================
    // VAULT INITIALIZATION
    // =========================
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.balance = 0;
        Ok(())
    }

    // =========================
    // DEPOSIT SOL
    // =========================
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault_owner = ctx.accounts.vault.owner;
        require!(
            vault_owner == ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );

        let transfer_ix = solana_program::system_instruction::transfer(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            amount,
        );

        solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
            ],
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.balance = vault
            .balance
            .checked_add(amount)
            .ok_or(ErrorCode::Overflow)?;

        Ok(())
    }

    // =========================
    // NORMAL WITHDRAW
    // =========================
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;

        require!(
            vault.owner == ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );

        require!(
            vault.balance >= amount,
            ErrorCode::InsufficientFunds
        );

        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

        vault.balance = vault
            .balance
            .checked_sub(amount)
            .ok_or(ErrorCode::Underflow)?;

        Ok(())
    }

    // =========================
    // INITIALIZE AGENT STATE
    // =========================
    pub fn initialize_agent(ctx: Context<InitializeAgent>) -> Result<()> {
        let state = &mut ctx.accounts.agent_state;

        state.owner = ctx.accounts.owner.key();
        state.risk_score = 50;
        state.execution_enabled = true;
        state.last_action_timestamp = Clock::get()?.unix_timestamp;

        Ok(())
    }

    // =========================
    // UPDATE RISK SCORE
    // =========================
    pub fn evaluate_agent_action(
        ctx: Context<UpdateAgent>,
        risk_score: u8,
    ) -> Result<()> {
        require!(risk_score <= 100, ErrorCode::InvalidRiskScore);

        let state = &mut ctx.accounts.agent_state;
        require!(
            state.owner == ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );

        state.risk_score = risk_score;
        state.execution_enabled = risk_score <= 80;

        Ok(())
    }

    // =========================
    // GATED WITHDRAW (FINAL BOSS)
    // =========================
    pub fn gated_withdraw(ctx: Context<GatedWithdraw>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.agent_state;
        let vault = &mut ctx.accounts.vault;

        require!(
            state.owner == ctx.accounts.owner.key(),
            ErrorCode::Unauthorized
        );

        require!(state.execution_enabled, ErrorCode::ExecutionBlocked);
        require!(state.risk_score <= 80, ErrorCode::HighRisk);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp - state.last_action_timestamp < 3600,
            ErrorCode::ExecutionTimeout
        );

        require!(vault.balance >= amount, ErrorCode::InsufficientFunds);

        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.owner.to_account_info().try_borrow_mut_lamports()? += amount;

        vault.balance = vault
            .balance
            .checked_sub(amount)
            .ok_or(ErrorCode::Underflow)?;

        state.last_action_timestamp = clock.unix_timestamp;

        Ok(())
    }
}

// =========================
// ACCOUNTS
// =========================

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub balance: u64,
}

#[account]
pub struct AgentState {
    pub owner: Pubkey,
    pub risk_score: u8,
    pub execution_enabled: bool,
    pub last_action_timestamp: i64,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 8)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeAgent<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 1 + 1 + 8)]
    pub agent_state: Account<'info, AgentState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(mut)]
    pub agent_state: Account<'info, AgentState>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct GatedWithdraw<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub agent_state: Account<'info, AgentState>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

// =========================
// ERRORS
// =========================

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient funds")]
    InsufficientFunds,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Invalid risk score")]
    InvalidRiskScore,

    #[msg("Execution blocked")]
    ExecutionBlocked,

    #[msg("Execution timeout")]
    ExecutionTimeout,

    #[msg("High risk detected")]
    HighRisk,

    #[msg("Overflow occurred")]
    Overflow,

    #[msg("Underflow occurred")]
    Underflow,
}
