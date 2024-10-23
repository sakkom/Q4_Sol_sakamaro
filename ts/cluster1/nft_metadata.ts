import wallet from "../wba-wallet.json";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";

// Create a devnet connection
const umi = createUmi("https://api.devnet.solana.com");

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader());
umi.use(signerIdentity(signer));

(async () => {
  try {
    // Follow this JSON structure
    // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure

    // const image: string = "https://arweave.net/BGWc9m2ZLKP32THqnrvAHNnz46VtVFQEosr1wPr7ELue";
    const image: string =
      "https://devnet.irys.xyz/D55xq6oR9XhS7ChHLB8sXisQK1imx6473gyhSeWTWW5m";

    const metadata = {
      name: "rugmaro",
      symbol: "MARO",
      description: "Turbin is best to catch skill",
      image: image,
      attributes: [{ trait_type: "background", value: "skateboarding" }],
      properties: {
        files: [
          {
            type: "image/png",
            uri: image,
          },
        ],
      },
      creators: [],
    };

    const myUri = await umi.uploader.uploadJson(metadata);

    console.log("Your metadata URI: ", myUri);
    // https://devnet.irys.xyz/9Kh7NYwey4wJAkDNhX74A9EZEkHsyVKffBb7mxsJv1b1
  } catch (error) {
    console.log("Oops.. Something went wrong", error);
  }
})();
