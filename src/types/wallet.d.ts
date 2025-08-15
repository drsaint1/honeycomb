// Wallet type extensions
declare module '@solana/wallet-adapter-base' {
  interface Adapter {
    signMessage?(message: Uint8Array): Promise<Uint8Array>;
  }
  
  interface WalletAdapter {
    signMessage?(message: Uint8Array): Promise<Uint8Array>;
  }
}

export {};