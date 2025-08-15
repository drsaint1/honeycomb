// Global type declarations for polyfills
declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: typeof globalThis;
  }
}

export {};