import type { Eip1193Provider } from "ethers";

// MetaMask's injected provider (EIP-1193), including its event methods.
export type InjectedProvider = Eip1193Provider & {
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}
