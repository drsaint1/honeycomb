// utils/accessToken.ts - Real Honeycomb Protocol Access Token Authentication
import { createEdgeClient } from "@honeycomb-protocol/edge-client";
import base58 from "bs58";

/**
 * Get access token using proper Honeycomb Edge Client authentication
 */
export const getHoneycombAccessToken = async (
  userPublicKey: string,
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | any
): Promise<string> => {
  try {
    console.log("🔑 Authenticating with Honeycomb Protocol...");
    
    const client = createEdgeClient(
      import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL || "https://edge.test.honeycombprotocol.com/",
      true // testnet
    );

    // Step 1: Auth Request - get message to sign
    console.log("📝 Step 1: Requesting authentication message...");
    const { authRequest } = await client.authRequest({
      wallet: userPublicKey.toString() // Convert PublicKey to string
    });

    const authRequestMessage = (authRequest as any)?.message;
    if (!authRequestMessage) {
      throw new Error("No auth message received from Honeycomb Protocol");
    }

    console.log("📝 Auth message received:", authRequestMessage);

    // Step 2: Sign the message
    console.log("✍️ Step 2: Signing authentication message...");
    const encodedMessage = new TextEncoder().encode(authRequestMessage);
    console.log("🔍 Message to sign (first 50 chars):", authRequestMessage.substring(0, 50) + "...");
    console.log("🔍 Encoded message length:", encodedMessage.length);
    
    let signedResult;
    try {
      // Ensure signMessage is a function and handle different wallet types
      if (typeof signMessage !== 'function') {
        throw new Error("signMessage is not a function. Received: " + typeof signMessage);
      }
      
      // Try to call signMessage directly, but catch the 'emit' error and handle it
      try {
        signedResult = await signMessage(encodedMessage);
      } catch (emitError: any) {
        if (emitError?.message?.includes("Cannot read properties of undefined (reading 'emit')")) {
          // The wallet adapter is missing the emit method, let's try binding it
          console.log("🔧 Wallet adapter missing emit method, trying alternative approach...");
          
          // Create a dummy emit function if needed
          if (signMessage.bind && typeof signMessage === 'object') {
            const boundSignMessage = signMessage.bind({ emit: () => {} });
            signedResult = await boundSignMessage(encodedMessage);
          } else {
            // Try calling with .call to provide a context with emit
            signedResult = await signMessage.call({ emit: () => {} }, encodedMessage);
          }
        } else {
          throw emitError;
        }
      }
      
      console.log("✅ Wallet signing completed");
    } catch (signingError) {
      console.error("❌ Wallet signing failed:", signingError);
      console.error("❌ signMessage type:", typeof signMessage);
      console.error("❌ signMessage value:", signMessage);
      throw new Error("Failed to sign message with wallet: " + (signingError as Error).message);
    }
    
    if (signedResult === undefined || signedResult === null) {
      throw new Error("Wallet returned undefined/null signature - user may have cancelled the signing request");
    }
    
    console.log("🔍 Signature result type:", typeof signedResult);
    console.log("🔍 Signature result:", signedResult);
    console.log("🔍 Is Uint8Array:", signedResult instanceof Uint8Array);
    console.log("🔍 Has signature property:", !!(signedResult as any)?.signature);
    console.log("🔍 Is Array:", Array.isArray(signedResult));
    
    // Handle different signature formats from wallet adapters
    let signatureBytes: Uint8Array;
    if (signedResult instanceof Uint8Array) {
      console.log("✅ Using direct Uint8Array signature");
      signatureBytes = signedResult;
    } else if ((signedResult as any)?.signature instanceof Uint8Array) {
      console.log("✅ Using signature property from wallet response");
      signatureBytes = (signedResult as any).signature;
    } else if (Array.isArray(signedResult)) {
      console.log("✅ Converting array to Uint8Array");
      signatureBytes = new Uint8Array(signedResult);
    } else if (typeof signedResult === 'object' && signedResult && (signedResult as any).signature) {
      console.log("✅ Extracting signature from object and converting");
      const sig = (signedResult as any).signature;
      if (Array.isArray(sig)) {
        signatureBytes = new Uint8Array(sig);
      } else {
        throw new Error("Signature property is not an array or Uint8Array: " + typeof sig);
      }
    } else {
      console.error("❌ Unexpected signature format. Full object:", JSON.stringify(signedResult, null, 2));
      throw new Error("Unexpected signature format from wallet: " + typeof signedResult);
    }
    
    console.log("🔍 Final signature bytes length:", signatureBytes.length);
    console.log("🔍 Final signature bytes (first 10):", Array.from(signatureBytes.slice(0, 10)));
    
    // Convert signature to base58 encoded string (as required by Honeycomb)
    const signature = base58.encode(signatureBytes);

    // Step 3: Confirm authentication with signature
    console.log("🔐 Step 3: Confirming authentication with signature...");
    const { authConfirm } = await client.authConfirm({
      wallet: userPublicKey.toString(), // Convert PublicKey to string
      signature: signature
    });

    const accessToken = (authConfirm as any)?.accessToken;
    if (!accessToken) {
      throw new Error("No access token received from authentication confirmation");
    }

    console.log("✅ Access token obtained successfully");
    
    // Store token for future use
    storeAccessToken(userPublicKey, accessToken);
    
    return accessToken;
  } catch (error) {
    console.error("❌ Failed to get access token:", error);
    throw new Error("Failed to authenticate with Honeycomb Protocol");
  }
};

/**
 * Store access token in localStorage
 */
export const storeAccessToken = (walletAddress: string, token: string): void => {
  localStorage.setItem(`honeycomb_access_token_${walletAddress}`, token);
  localStorage.setItem(`honeycomb_token_timestamp_${walletAddress}`, Date.now().toString());
};

/**
 * Get stored access token from localStorage
 */
export const getStoredAccessToken = (walletAddress: string): string | null => {
  const token = localStorage.getItem(`honeycomb_access_token_${walletAddress}`);
  const timestamp = localStorage.getItem(`honeycomb_token_timestamp_${walletAddress}`);
  
  // Check if token is older than 23 hours (refresh before 24h expiry)
  if (token && timestamp) {
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 23 * 60 * 60 * 1000; // 23 hours in milliseconds
    
    if (tokenAge < maxAge) {
      console.log("🔑 Using cached access token");
      return token;
    } else {
      console.log("🔑 Access token expired, need to re-authenticate");
      clearStoredToken(walletAddress);
    }
  }
  
  return null;
};

/**
 * Clear stored access token
 */
export const clearStoredToken = (walletAddress: string): void => {
  localStorage.removeItem(`honeycomb_access_token_${walletAddress}`);
  localStorage.removeItem(`honeycomb_token_timestamp_${walletAddress}`);
};

/**
 * Get a valid access token (authenticate if needed)
 */
export const getOrCreateAccessToken = async (
  userPublicKey: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<string> => {
  // Check if we have a valid stored token
  const storedToken = getStoredAccessToken(userPublicKey);
  
  if (storedToken) {
    return storedToken;
  }
  
  // Need to authenticate
  console.log("🔑 No valid token found, authenticating...");
  return await getHoneycombAccessToken(userPublicKey, signMessage);
};