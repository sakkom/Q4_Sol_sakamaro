use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct Delist<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(
      seeds = [b"marketplace", marketplace.name.as_str().as_bytes()],
      bump = marketplace.bump
    )]
    pub marketplace: Account<'info, Marketplace>,
    #[account(
      mut,
      close = maker,
      seeds = [marketplace.key().as_ref(), maker_mint.key().as_ref()],
      bump = listing.bump
    )]
    pub listing: Account<'info, Listing>,
    pub maker_mint: InterfaceAccount<'info, Mint>,
    #[account(
    mut,
    associated_token::authority = maker,
    associated_token::mint = maker_mint,
  )]
    pub maker_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
      mut,
    associated_token::authority = listing,
    associated_token::mint = maker_mint,
  )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Delist<'info> {
    pub fn withdraw_nft(&mut self) -> Result<()> {
        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.maker_mint.to_account_info(),
            to: self.maker_ata.to_account_info(),
            authority: self.listing.to_account_info(),
        };

        let cpi_program = self.token_program.to_account_info();

        let seeds = &[
            self.marketplace.to_account_info().key.as_ref(),
            self.maker_mint.to_account_info().key.as_ref(),
            &[self.listing.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, 1, self.maker_mint.decimals)?;

        Ok(())
    }
}
