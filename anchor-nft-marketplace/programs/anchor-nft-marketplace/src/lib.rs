use anchor_lang::prelude::*;

declare_id!("CWFL8zCJYVALaQ8M88K5Ksr875E1VftWMqtDPSfrBZ1D");

pub mod contexts;
pub mod error;
pub mod state;

#[program]
pub mod anchor_nft_marketplace {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
