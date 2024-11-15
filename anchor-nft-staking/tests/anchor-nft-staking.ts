import * as anchor from "@coral-xyz/anchor";
import { NftStaking } from "../target/types/nft_staking";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import {
  KeypairSigner,
  PublicKey,
  createSignerFromKeypair,
  generateSigner,
  keypairIdentity,
  percentAmount,
} from "@metaplex-foundation/umi";
import { Program } from "@coral-xyz/anchor";
import {
  createNft,
  findMasterEditionPda,
  findMetadataPda,
  mplTokenMetadata,
  verifySizedCollectionItem,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";

describe("nft-staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftStaking as Program<NftStaking>;

  const umi = createUmi(provider.connection);

  const payer = provider.wallet as NodeWallet;

  let nftMint: KeypairSigner = generateSigner(umi);
  let collectionMint: KeypairSigner = generateSigner(umi);

  const creatorWallet = umi.eddsa.createKeypairFromSecretKey(
    new Uint8Array(payer.payer.secretKey)
  );
  const creator = createSignerFromKeypair(umi, creatorWallet);
  umi.use(keypairIdentity(creator));
  umi.use(mplTokenMetadata());

  const collection: anchor.web3.PublicKey = new anchor.web3.PublicKey(
    collectionMint.publicKey.toString()
  );

  const config = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  )[0];

  const rewardsMint = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("rewards"), config.toBuffer()],
    program.programId
  )[0];

  const userAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user"), provider.publicKey.toBuffer()],
    program.programId
  )[0];

  const stakeAccount = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("stake"),
      new anchor.web3.PublicKey(nftMint.publicKey as PublicKey).toBuffer(),
      config.toBuffer(),
    ],
    program.programId
  )[0];

  it("Mint Collection NFT", async () => {
    await createNft(umi, {
      mint: collectionMint,
      name: "MARO",
      symbol: "MARO",
      uri: "https://image",
      sellerFeeBasisPoints: percentAmount(6.0),
      creators: null,
      collectionDetails: {
        __kind: "V1",
        size: 10,
      },
    }).sendAndConfirm(umi);
  });

  it("Mint NFT", async () => {
    await createNft(umi, {
      mint: nftMint,
      name: "MARO",
      symbol: "MARO",
      uri: "https://image",
      collection: { verified: false, key: collectionMint.publicKey },
      sellerFeeBasisPoints: percentAmount(6),
      creators: null,
    }).sendAndConfirm(umi);
  });

  it("Verify Collection NFT", async () => {
    const collectionMetadata = findMetadataPda(umi, {
      mint: collectionMint.publicKey,
    });
    const collectionMasterEdition = findMasterEditionPda(umi, {
      mint: collectionMint.publicKey,
    });

    const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });
    await verifySizedCollectionItem(umi, {
      metadata: nftMetadata,
      collectionAuthority: creator,
      collectionMint: collectionMint.publicKey,
      collection: collectionMetadata,
      collectionMasterEditionAccount: collectionMasterEdition,
    }).sendAndConfirm(umi);
  });

  it("Initialize Config Account", async () => {
    await program.methods
      .initializeConfig(10, 10, 0)
      .accountsPartial({
        admin: provider.wallet.publicKey,
        config,
        rewardsMint,
        systeyProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID, //It require to make seeds mint
      })
      .rpc();
  });

  it("Initialize User Account", async () => {
    await program.methods
      .initializeUser()
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount: userAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
  });

  it("Stake NFT", async () => {
    const mintAta = getAssociatedTokenAddressSync(
      new anchor.web3.PublicKey(nftMint.publicKey as PublicKey),
      provider.wallet.publicKey
    );

    const nftMetadata = findMetadataPda(umi, { mint: nftMint.publicKey });
    const nftEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });

    await program.methods
      .stake()
      .accountsPartial({
        user: provider.wallet.publicKey,
        mint: nftMint.publicKey,
        collectionMint: collectionMint.publicKey,
        mintAta,
        metadata: new anchor.web3.PublicKey(nftMetadata[0]),
        edition: new anchor.web3.PublicKey(nftEdition[0]), //not collection edition, check verified with desighed nft edition.
        config, //config has check variable, and function for seeds
        stakeAccount,
        userAccount,
      })
      .rpc();
  });

  it("Unstake NFT", async () => {
    const mintAta = getAssociatedTokenAddressSync(
      new anchor.web3.PublicKey(nftMint.publicKey as PublicKey),
      provider.wallet.publicKey
    );
    const nftEdition = findMasterEditionPda(umi, { mint: nftMint.publicKey });

    await program.methods
      .unstake()
      .accountsPartial({
        user: provider.wallet.publicKey,
        mint: nftMint.publicKey,
        mintAta,
        edition: new anchor.web3.PublicKey(nftEdition[0]), //remove delegater.
        config,
        stakeAccount,
        userAccount,
      })
      .rpc();
  });

  it("Claim", async () => {
    const rewardsAta = getAssociatedTokenAddressSync(
      rewardsMint,
      provider.wallet.publicKey
    );

    await program.methods
      .claim()
      .accountsPartial({
        user: provider.wallet.publicKey,
        userAccount,
        rewardsMint,
        config,
        rewardsAta, //init_if_needed,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
  });
});
