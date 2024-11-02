import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorEscrow } from "../target/types/anchor_escrow";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  transfer,
  createAccount,
  Account,
} from "@solana/spl-token";
import { expect } from "chai";

describe("anchor_escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorEscrow as Program<AnchorEscrow>;

  const seed = new anchor.BN(10);
  const decimals = 10 ** 9;
  const initialNumber = 100 * decimals;
  const deposit = new anchor.BN(3 * decimals);
  const receive = new anchor.BN(3 * decimals);

  const maker = anchor.web3.Keypair.generate();
  const taker = anchor.web3.Keypair.generate();
  let mintA: anchor.web3.PublicKey;
  let mintB: anchor.web3.PublicKey;
  let makerAtaA: Account;
  let makerAtaB: anchor.web3.PublicKey;
  let takerAtaA: anchor.web3.PublicKey;
  let takerAtaB: Account;
  let vault: anchor.web3.PublicKey;

  const [escrow] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), maker.publicKey.toBytes(), seed.toBuffer("le", 8)],
    program.programId
  );

  before(async () => {
    const airdrop_maker = await provider.connection.requestAirdrop(
      maker.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop_maker);

    const airdrop_taker = await provider.connection.requestAirdrop(
      taker.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop_taker);

    // console.log(
    //   "maker balance check:",
    //   await provider.connection.getBalance(maker.publicKey)
    // );

    mintA = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      9
    );

    mintB = await createMint(
      provider.connection,
      taker,
      taker.publicKey,
      null,
      9
    );

    [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [escrow.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintA.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  });

  it("Is initialized!", async () => {
    makerAtaA = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      maker,
      mintA,
      maker.publicKey,
      false,
      null,
      null,
      TOKEN_PROGRAM_ID
    );

    await mintTo(
      provider.connection,
      maker,
      mintA,
      makerAtaA.address,
      maker,
      initialNumber
    );

    await program.methods
      .initialize(seed, deposit, receive)
      .accounts({
        maker: maker.publicKey,
        mintA: mintA,
        mintB: mintB,
        makerAtaA: makerAtaA.address,
        escrow: escrow,
        vault: vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([maker])
      .rpc();

    const vaultBalance = await provider.connection.getTokenAccountBalance(
      vault
    );

    expect(vaultBalance.value.amount).to.equal(deposit.toString());
  });

  before(async () => {
    [makerAtaB] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        maker.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintB.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    [takerAtaA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        taker.publicKey.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        mintA.toBuffer(),
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    takerAtaB = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      taker,
      mintB,
      taker.publicKey,
      false,
      null,
      null,
      TOKEN_PROGRAM_ID
    );

    await mintTo(
      provider.connection,
      taker,
      mintB,
      takerAtaB.address,
      taker,
      initialNumber
    );
  });

  it("Is Withdraw!", async () => {
    // const vaultBefore = await provider.connection.getTokenAccountBalance(vault);
    // console.log(vaultBefore);

    await program.methods
      .depositAndWithdraw()
      .accounts({
        taker: taker.publicKey,
        maker: maker.publicKey,
        takerAtaA: takerAtaA,
        takerAtaB: takerAtaB.address,
        makerAtaB: makerAtaB,
        escrow: escrow,
        vault: vault,
        mintA: mintA,
        mintB: mintB,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([taker])
      .rpc();

    const vaultAfter = await provider.connection.getAccountInfo(vault);
    expect(vaultAfter).to.be.null;
  });
});
