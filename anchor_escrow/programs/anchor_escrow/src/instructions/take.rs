use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TokenInterface,
        TransferChecked,
    },
};

use crate::Escrow;

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub maker: SystemAccount<'info>,
    #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = mint_a,
    associated_token::authority = taker,
    associated_token::token_program = token_program
   )]
    pub taker_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,
    // pub taker_ata_a: InterfaceAccount<'info, TokenAccount>,
    #[account(
    mut,
    associated_token::mint = mint_b,
    associated_token::authority = taker,
    associated_token::token_program = token_program
   )]
    pub taker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,
    // pub taker_ata_b: InterfaceAccount<'info, TokenAccount>,
    #[account(
    init_if_needed,
    payer = taker,
    associated_token::mint = mint_b,
    associated_token::authority = maker,
    associated_token::token_program = token_program
   )]
    pub maker_ata_b: Box<InterfaceAccount<'info, TokenAccount>>,
    // pub maker_ata_b: InterfaceAccount<'info, TokenAccount>,
    #[account(
    mut,
    seeds = [b"escrow", maker.key().as_ref(), escrow.seed.to_le_bytes().as_ref()],
    bump = escrow.bump,
    close = maker,
    has_one = mint_a,
    has_one = mint_b,
    has_one = maker,
  )]
    pub escrow: Account<'info, Escrow>,
    #[account(
    mut,
    associated_token::mint = mint_a,
    associated_token::authority = escrow,
    associated_token::token_program = token_program,
  )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(
    mint::token_program = token_program
  )]
    pub mint_a: InterfaceAccount<'info, Mint>,
    #[account(
    mint::token_program = token_program
  )]
    pub mint_b: InterfaceAccount<'info, Mint>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> Take<'info> {
    pub fn deposit(&mut self) -> Result<()> {
        let transfer_accounts = TransferChecked {
            from: self.taker_ata_b.to_account_info(),
            mint: self.mint_b.to_account_info(),
            to: self.maker_ata_b.to_account_info(),
            authority: self.taker.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), transfer_accounts);

        transfer_checked(cpi_ctx, self.escrow.recieve, self.mint_b.decimals)
    }

    pub fn withdraw_and_close_vault(&mut self) -> Result<()> {
        let seeds = [
            b"escrow",
            self.maker.to_account_info().key.as_ref(),
            &self.escrow.seed.to_le_bytes()[..],
            &[self.escrow.bump],
        ];

        let signer_seeds = &[&seeds[..]];

        let transfer_acconts = TransferChecked {
            from: self.vault.to_account_info(),
            mint: self.mint_a.to_account_info(),
            to: self.taker_ata_a.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            transfer_acconts,
            signer_seeds,
        );

        transfer_checked(
            cpi_ctx,
            self.vault.amount,
            self.mint_a.decimals, //escorw.mint_b,
        )?;

        let close_accounts = CloseAccount {
            account: self.vault.to_account_info(),
            destination: self.maker.to_account_info(),
            authority: self.escrow.to_account_info(),
        };

        let close_cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            close_accounts,
            signer_seeds,
        );

        close_account(close_cpi_ctx)
    }
}