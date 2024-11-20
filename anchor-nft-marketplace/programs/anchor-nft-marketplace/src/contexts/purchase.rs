use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::state::{Listing, Marketplace};

#[derive(Accounts)]
pub struct Purchase<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub maker: SystemAccount<'info>,
    #[account(
    init_if_needed,
    payer = taker,
    associated_token::authority = taker,
    associated_token::mint = maker_mint,
  )]
    pub taker_ata: InterfaceAccount<'info, TokenAccount>,
    #[account(
    mut,
    associated_token::authority = listing,
    associated_token::mint = maker_mint,
  )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub maker_mint: InterfaceAccount<'info, Mint>,
    #[account(
    mut,
    close = maker,
    seeds = [marketplace.key().as_ref(), maker_mint.key().as_ref()],
    bump = listing.bump
  )]
    pub listing: Account<'info, Listing>,
    #[account(
    seeds = [b"treasury", marketplace.key().as_ref()],
    bump = marketplace.treasury_bump
  )]
    pub treasury: SystemAccount<'info>,
    #[account(
    seeds = [b"marketplace", marketplace.name.as_str().as_bytes()],
    bump = marketplace.bump
  )]
    pub marketplace: Account<'info, Marketplace>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> Purchase<'info> {
    pub fn send_sol(&mut self) -> Result<()> {
        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.taker.to_account_info(),
            to: self.maker.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        let amount = self
            .listing
            .price
            .checked_mul(self.marketplace.fee as u64)
            .unwrap()
            .checked_div(10000)
            .unwrap();

        transfer(cpi_ctx, self.listing.price - amount)?;

        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
            from: self.taker.to_account_info(),
            to: self.treasury.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn send_nft(&mut self) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = TransferChecked {
            from: self.vault.to_account_info(),
            to: self.taker_ata.to_account_info(),
            mint: self.maker_mint.to_account_info(),
            authority: self.listing.to_account_info(),
        };

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

    pub fn close_mint_vault(&mut self) -> Result<()> {
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.listing.to_account_info(),
        };

        let seeds = &[
            self.marketplace.to_account_info().key.as_ref(),
            self.maker_mint.to_account_info().key.as_ref(),
            &[self.listing.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);

        close_account(cpi_ctx)?;

        Ok(())
    }
}
