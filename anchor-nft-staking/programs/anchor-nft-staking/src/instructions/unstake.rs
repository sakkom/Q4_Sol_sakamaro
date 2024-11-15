use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{
        mpl_token_metadata::instructions::{
            ThawDelegatedAccountCpi, ThawDelegatedAccountCpiAccounts,
        },
        MasterEditionAccount, Metadata,
    },
    token::{revoke, Mint, Revoke, Token, TokenAccount},
};

use crate::{
    error::StakeError,
    state::{StakeAccount, StakeConfig, UserAccount},
};

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
      seeds = [b"config"],
      bump = config_account.bump
    )]
    pub config_account: Account<'info, StakeConfig>,
    #[account( //why not use mut?
      seeds = [
        b"metadata",
        mint.key().as_ref(),
        metadata_program.key().as_ref(),
        b"edition"
      ],
      seeds::program = metadata_program.key(),
      bump
    )]
    pub edition: Account<'info, MasterEditionAccount>,
    #[account(
      mut,
      associated_token::mint = mint,
      associated_token::authority = user,
    )]
    pub mint_ata: Account<'info, TokenAccount>,
    #[account(
      mut,
      close = user,
      seeds = [b"stake", config_account.key().as_ref(), mint.key().as_ref()],
      bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
      mut,
      seeds = [b"user".as_ref(), user.key().as_ref()],
      bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub metadata_program: Program<'info, Metadata>,
}

impl<'info> Unstake<'info> {
    pub fn unstake(&mut self) -> Result<()> {
        let time_elapsed =
            ((Clock::get()?.unix_timestamp - self.stake_account.staked_at) / 86400) as u32;

        require!(
            time_elapsed >= self.config_account.freeze_period,
            StakeError::FreezePeriodNotPassed
        );

        self.user_account.points +=
            time_elapsed as u32 * self.config_account.points_per_stake as u32;

        let seeds = &[
            b"stake",
            self.mint.to_account_info().key.as_ref(),
            self.config_account.to_account_info().key.as_ref(),
            &[self.config_account.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let delegate = &self.stake_account.to_account_info();
        let token_account = &self.mint_ata.to_account_info();
        let edition = &self.edition.to_account_info();
        let mint = &self.mint.to_account_info();
        let token_program = &self.token_program.to_account_info();

        ThawDelegatedAccountCpi::new(
            &self.metadata_program.to_account_info(),
            ThawDelegatedAccountCpiAccounts {
                delegate,
                token_account,
                edition,
                mint,
                token_program,
            },
        )
        .invoke_signed(signer_seeds)?;

        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = Revoke {
            source: self.mint_ata.to_account_info(),
            authority: self.stake_account.to_account_info(),
        };

        let cpi_context = CpiContext::new(cpi_program, cpi_accounts);

        revoke(cpi_context)?;

        self.user_account.amount_staked -= 1;

        Ok(())
    }
}
