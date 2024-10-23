import {
  Commitment,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import wallet from "../wba-wallet.json";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// We're going to import our keypair from the wallet file
const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

//Create a Solana devnet connection
const commitment: Commitment = "confirmed";
const connection = new Connection("https://api.devnet.solana.com", commitment);
const token_decimals = 1_000_000n;

// Mint address
const mint = new PublicKey("71XHKSR1LcxVNisrTPwsBXw2iD5E5JbpDBRvt63TP2pC");

// Recipient address
const to = new PublicKey("AbVh32GTzzBuUYQEgZ2LjpX17StgxN5aPzqaYaxbLvB4");

(async () => {
  try {
    // Get the token account of the fromWallet address, and if it does not exist, create it
    const fromATA = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      keypair.publicKey,
    );
    // Get the token account of the toWallet address, and if it does not exist, create it
    const toATA = await getOrCreateAssociatedTokenAccount(
      connection,
      keypair,
      mint,
      to,
    );

    // Transfer the new token to the "toTokenAccount" we just created
    const tx = await transfer(
      connection,
      keypair,
      fromATA.address,
      toATA.address,
      keypair,
      5n * token_decimals,
    );
    console.log(`Transfer to ${to}:  ${tx}`);
  } catch (e) {
    console.error(`Oops, something went wrong: ${e}`);
  }
})();
