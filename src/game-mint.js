import { HoneycombProject } from "@honeycomb-protocol/edge-client";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";

dotenv.config();

// Game configuration
const connection = new Connection(
  "https://rpc.test.honeycombprotocol.com",
  "confirmed"
);
const secretKey = Uint8Array.from(JSON.parse(process.env.PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(secretKey);

// Car metadata URIs from our upload
const carMetadata = {
  blue: "https://arweave.net/HHpgC2RFxQMoLn1uJAwUfDxqLVn65FhZnxgbvnbyt7xg",
  green: "https://arweave.net/J2rP4y974EqvuLEZxE2QoTHtLhRfCdcwLgun918Zj4f",
  purple: "https://arweave.net/9EfVmqK2nwyAqWQuvXTSeJYDHWvQhuTqGPHveb7yFaow",
};

// Initialize Honeycomb project
const project = new HoneycombProject(connection);

async function mintCarForPlayer(playerWallet, carType = "blue") {
  try {
    console.log(`Minting ${carType} car for player: ${playerWallet}`);

    // Get the metadata URI for the requested car type
    const metadataUri = carMetadata[carType];
    if (!metadataUri) {
      throw new Error(`Invalid car type: ${carType}`);
    }

    // Get project address from environment
    const projectAddress = process.env.VITE_PUBLIC_HONEYCOMB_PROJECT_ADDRESS;
    
    if (!projectAddress) {
      throw new Error("Honeycomb project not set up. Please create a project first using the Project Creator.");
    }

    // Create NFT mint transaction
    const { createCreateNftTransaction: txResponse } =
      await project.client.createCreateNftTransaction({
        project: projectAddress,
        authority: wallet.publicKey.toString(),
        payer: wallet.publicKey.toString(),
        owner: playerWallet, // The player who will own the NFT car
        metadata: {
          name: `Racing Car #${Date.now()}`,
          symbol: "CAR",
          uri: metadataUri,
          sellerFeeBasisPoints: 500, // 5% royalty
        },
      });

    // Sign and send transaction
    const signedTx = await wallet.signTransaction(txResponse.transactions[0]);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature);

    console.log("✅ Car NFT minted successfully!");
    console.log("Transaction signature:", signature);
    console.log("Mint address:", txResponse.mint);

    return {
      signature,
      mintAddress: txResponse.mint,
      metadataUri,
      carType,
    };
  } catch (error) {
    console.error("❌ Error minting car:", error.message);
    throw error;
  }
}

// Example usage - mint a random car for a player
async function mintRandomCar(playerWallet) {
  const carTypes = ["blue", "green", "purple"];
  const randomCar = carTypes[Math.floor(Math.random() * carTypes.length)];
  return await mintCarForPlayer(playerWallet, randomCar);
}

// Export functions for use in game
export { mintCarForPlayer, mintRandomCar };

// CLI usage example
if (import.meta.url === `file://${process.argv[1]}`) {
  const playerAddress = process.argv[2] || wallet.publicKey.toString();
  const carType = process.argv[3] || "blue";

  console.log("🏎️  Racing Car NFT Minter");
  console.log("========================");

  mintCarForPlayer(playerAddress, carType)
    .then((result) => {
      console.log("\n🎉 Minting completed!");
      console.log("Details:", result);
    })
    .catch((error) => {
      console.error("\n💥 Minting failed:", error);
      process.exit(1);
    });
}
