// uploadNFTAssets.js - Helper script to prepare and upload NFT assets
// Run this script to upload your local car images and metadata to IPFS

const fs = require('fs');
const path = require('path');

/**
 * This script helps you upload your NFT car assets to IPFS or other hosting services
 * 
 * Before running this script:
 * 1. Put your car images in: ./assets/car-images/
 * 2. Put your metadata JSON files in: ./assets/car-metadata/
 * 
 * Supported methods:
 * - Pinata (IPFS) - Recommended
 * - NFT.Storage (Free IPFS)
 * - Arweave (Permanent storage)
 */

// Configuration - Replace with your actual API keys
const UPLOAD_CONFIG = {
  // Option 1: Pinata (IPFS) - https://pinata.cloud/
  pinata: {
    apiKey: 'YOUR_PINATA_API_KEY',
    secretKey: 'YOUR_PINATA_SECRET_KEY',
    baseUrl: 'https://api.pinata.cloud'
  },
  
  // Option 2: NFT.Storage (Free IPFS) - https://nft.storage/
  nftStorage: {
    apiKey: 'YOUR_NFT_STORAGE_API_KEY'
  },
  
  // Option 3: Web3.Storage (Free IPFS) - https://web3.storage/
  web3Storage: {
    apiKey: 'YOUR_WEB3_STORAGE_API_KEY'
  }
};

// Expected file structure
const ASSETS_STRUCTURE = {
  images: './assets/car-images/',
  metadata: './assets/car-metadata/',
  output: './assets/uploaded-urls.json'
};

/**
 * Upload using Pinata (IPFS)
 */
async function uploadToPinata(filePath, fileName) {
  const FormData = require('form-data');
  const axios = require('axios');
  
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('pinataMetadata', JSON.stringify({
      name: fileName,
      keyvalues: {
        type: 'nft-car-asset',
        project: 'honeycomb-racing'
      }
    }));
    
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'pinata_api_key': UPLOAD_CONFIG.pinata.apiKey,
          'pinata_secret_api_key': UPLOAD_CONFIG.pinata.secretKey
        }
      }
    );
    
    return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
  } catch (error) {
    console.error(`Failed to upload ${fileName} to Pinata:`, error.message);
    return null;
  }
}

/**
 * Upload using NFT.Storage
 */
async function uploadToNFTStorage(filePath, fileName) {
  const { NFTStorage, File } = require('nft.storage');
  
  try {
    const client = new NFTStorage({ token: UPLOAD_CONFIG.nftStorage.apiKey });
    const fileContent = fs.readFileSync(filePath);
    const file = new File([fileContent], fileName);
    
    const cid = await client.storeBlob(file);
    return `https://nftstorage.link/ipfs/${cid}`;
  } catch (error) {
    console.error(`Failed to upload ${fileName} to NFT.Storage:`, error.message);
    return null;
  }
}

/**
 * Main upload function
 */
async function uploadAssets() {
  console.log('🚗 Starting NFT Car Assets Upload...\n');
  
  // Check if directories exist
  if (!fs.existsSync(ASSETS_STRUCTURE.images)) {
    console.error(`❌ Images directory not found: ${ASSETS_STRUCTURE.images}`);
    console.log('Please create the directory and add your car images (PNG, JPG, GIF)');
    return;
  }
  
  if (!fs.existsSync(ASSETS_STRUCTURE.metadata)) {
    console.error(`❌ Metadata directory not found: ${ASSETS_STRUCTURE.metadata}`);
    console.log('Please create the directory and add your metadata JSON files');
    return;
  }
  
  const uploadResults = {
    images: {},
    metadata: {},
    timestamp: new Date().toISOString()
  };
  
  try {
    // Upload images first
    console.log('📸 Uploading car images...');
    const imageFiles = fs.readdirSync(ASSETS_STRUCTURE.images)
      .filter(file => /\.(png|jpg|jpeg|gif|webp)$/i.test(file));
    
    for (const imageFile of imageFiles) {
      console.log(`  Uploading: ${imageFile}`);
      const imagePath = path.join(ASSETS_STRUCTURE.images, imageFile);
      
      // Try Pinata first, fallback to NFT.Storage
      let imageUrl = await uploadToPinata(imagePath, imageFile);
      if (!imageUrl) {
        imageUrl = await uploadToNFTStorage(imagePath, imageFile);
      }
      
      if (imageUrl) {
        uploadResults.images[imageFile] = imageUrl;
        console.log(`  ✅ ${imageFile} -> ${imageUrl}`);
      } else {
        console.log(`  ❌ Failed to upload ${imageFile}`);
      }
    }
    
    console.log('\n📄 Uploading metadata files...');
    const metadataFiles = fs.readdirSync(ASSETS_STRUCTURE.metadata)
      .filter(file => file.endsWith('.json'));
    
    for (const metadataFile of metadataFiles) {
      console.log(`  Uploading: ${metadataFile}`);
      const metadataPath = path.join(ASSETS_STRUCTURE.metadata, metadataFile);
      
      // Read and update metadata with uploaded image URLs
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      // Try to find matching image
      const baseName = path.parse(metadataFile).name;
      const matchingImage = Object.keys(uploadResults.images)
        .find(img => path.parse(img).name === baseName);
      
      if (matchingImage) {
        metadata.image = uploadResults.images[matchingImage];
        console.log(`    Updated image URL in metadata: ${metadata.image}`);
      }
      
      // Write updated metadata to temp file
      const tempMetadataPath = path.join('./temp_metadata_' + metadataFile);
      fs.writeFileSync(tempMetadataPath, JSON.stringify(metadata, null, 2));
      
      // Upload metadata
      let metadataUrl = await uploadToPinata(tempMetadataPath, metadataFile);
      if (!metadataUrl) {
        metadataUrl = await uploadToNFTStorage(tempMetadataPath, metadataFile);
      }
      
      if (metadataUrl) {
        uploadResults.metadata[metadataFile] = {
          url: metadataUrl,
          imageUrl: metadata.image
        };
        console.log(`  ✅ ${metadataFile} -> ${metadataUrl}`);
      } else {
        console.log(`  ❌ Failed to upload ${metadataFile}`);
      }
      
      // Clean up temp file
      fs.unlinkSync(tempMetadataPath);
    }
    
    // Save results
    fs.writeFileSync(ASSETS_STRUCTURE.output, JSON.stringify(uploadResults, null, 2));
    
    console.log('\n🎉 Upload completed!');
    console.log(`📊 Results saved to: ${ASSETS_STRUCTURE.output}`);
    console.log(`📸 Images uploaded: ${Object.keys(uploadResults.images).length}`);
    console.log(`📄 Metadata uploaded: ${Object.keys(uploadResults.metadata).length}`);
    
    console.log('\n🔧 Next Steps:');
    console.log('1. Update your CAR_TEMPLATES in nftCarService.ts with the new URLs');
    console.log('2. Test the URLs to make sure they work');
    console.log('3. Update your environment variables if needed');
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
  }
}

/**
 * Generate example metadata files
 */
function generateExampleMetadata() {
  console.log('📝 Generating example metadata files...\n');
  
  const exampleMetadata = {
    speedster: {
      name: "Speedster",
      symbol: "HCAR",
      description: "Built for speed, light on handling. This aerodynamic machine cuts through the wind with precision.",
      image: "WILL_BE_UPDATED_AFTER_UPLOAD",
      external_url: "https://your-game.com",
      attributes: [
        { trait_type: "Speed", value: 9 },
        { trait_type: "Handling", value: 4 },
        { trait_type: "Acceleration", value: 8 },
        { trait_type: "Durability", value: 3 },
        { trait_type: "Rarity", value: "uncommon" },
        { trait_type: "Type", value: "speedster" },
        { trait_type: "Generation", value: 1 }
      ],
      properties: {
        files: [
          {
            uri: "WILL_BE_UPDATED_AFTER_UPLOAD",
            type: "image/png"
          }
        ],
        category: "image"
      }
    },
    
    handler: {
      name: "Handler",
      symbol: "HCAR", 
      description: "Perfect balance of control and speed. Engineered for drivers who demand precision in every turn.",
      image: "WILL_BE_UPDATED_AFTER_UPLOAD",
      external_url: "https://your-game.com",
      attributes: [
        { trait_type: "Speed", value: 6 },
        { trait_type: "Handling", value: 9 },
        { trait_type: "Acceleration", value: 6 },
        { trait_type: "Durability", value: 7 },
        { trait_type: "Rarity", value: "rare" },
        { trait_type: "Type", value: "handler" },
        { trait_type: "Generation", value: 1 }
      ],
      properties: {
        files: [
          {
            uri: "WILL_BE_UPDATED_AFTER_UPLOAD", 
            type: "image/png"
          }
        ],
        category: "image"
      }
    },
    
    tank: {
      name: "Tank",
      symbol: "HCAR",
      description: "Heavy and durable, slower but unstoppable. Built to withstand any collision and keep racing.",
      image: "WILL_BE_UPDATED_AFTER_UPLOAD", 
      external_url: "https://your-game.com",
      attributes: [
        { trait_type: "Speed", value: 4 },
        { trait_type: "Handling", value: 5 },
        { trait_type: "Acceleration", value: 3 },
        { trait_type: "Durability", value: 10 },
        { trait_type: "Rarity", value: "common" },
        { trait_type: "Type", value: "tank" },
        { trait_type: "Generation", value: 1 }
      ],
      properties: {
        files: [
          {
            uri: "WILL_BE_UPDATED_AFTER_UPLOAD",
            type: "image/png"
          }
        ],
        category: "image"
      }
    }
  };
  
  // Create directories
  if (!fs.existsSync('./assets')) fs.mkdirSync('./assets');
  if (!fs.existsSync(ASSETS_STRUCTURE.metadata)) fs.mkdirSync(ASSETS_STRUCTURE.metadata, { recursive: true });
  
  // Write example metadata files
  Object.entries(exampleMetadata).forEach(([carType, metadata]) => {
    const filePath = path.join(ASSETS_STRUCTURE.metadata, `${carType}.json`);
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
    console.log(`✅ Created: ${filePath}`);
  });
  
  console.log('\n📁 Example metadata files created!');
  console.log('🎨 Now add your car images to: ' + ASSETS_STRUCTURE.images);
  console.log('   - speedster.png (or .jpg/.gif)');
  console.log('   - handler.png');  
  console.log('   - tank.png');
  console.log('\n🚀 Then run: node uploadNFTAssets.js');
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'upload':
    uploadAssets();
    break;
  case 'generate':
    generateExampleMetadata();
    break;
  default:
    console.log('🚗 NFT Car Assets Upload Tool\n');
    console.log('Usage:');
    console.log('  node uploadNFTAssets.js generate  - Create example metadata files');
    console.log('  node uploadNFTAssets.js upload    - Upload images and metadata to IPFS\n');
    console.log('Setup:');
    console.log('1. Get API keys from Pinata.cloud or NFT.Storage');
    console.log('2. Update UPLOAD_CONFIG with your API keys');
    console.log('3. Run "generate" to create example metadata');
    console.log('4. Add your car images to ./assets/car-images/');
    console.log('5. Run "upload" to upload everything to IPFS');
    break;
}

module.exports = { uploadAssets, generateExampleMetadata };