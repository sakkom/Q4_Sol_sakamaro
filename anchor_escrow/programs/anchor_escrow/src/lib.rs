use anchor_lang::prelude::*;

declare_id!("3t514Jmqmea3zpd83onVGaLoA7QNvwkBbcq7JGMczqdr");

pub mod instructions;
pub use instructions::*;

pub mod state;
pub use state::*;

#[program]
pub mod anchor_escrow {
    use super::*;

    pub fn initialize(ctx: Context<Make>, seed: u64, deposit: u64, receive: u64) -> Result<()> {
        ctx.accounts.init_escrow(seed, receive, &ctx.bumps)?;
        ctx.accounts.deposit(deposit)?;

        Ok(())
    }

    // pub fn refund_and_close_vault(ctx: Context<Refund>) -> Result<()> {
    //     ctx.accounts.refund_and_close_vault()?;

    //     Ok(())
    // }

    pub fn deposit_and_withdraw(ctx: Context<Take>) -> Result<()> {
        ctx.accounts.deposit()?;
        ctx.accounts.withdraw_and_close_vault()?;

        Ok(())
    }
}
