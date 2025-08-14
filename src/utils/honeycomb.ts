// lib/honeycomb.ts - FIXED CLIENT INITIALIZATION
import { createEdgeClient } from "@honeycomb-protocol/edge-client";

// 🔥 FIX: Use the correct API URL format
const apiUrl =
  import.meta.env.VITE_PUBLIC_HONEYCOMB_API_URL ||
  "https://edge.test.honeycombprotocol.com/";

// 🔥 FIX: Create client with proper configuration
const client = createEdgeClient(apiUrl, true); // true for testnet

console.log("🍯 Honeycomb client initialized with:", {
  apiUrl,
  testnet: true,
});

export { client };
