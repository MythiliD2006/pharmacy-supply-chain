/**
 * Web3 MetaMask client utilities for PharmaChain.
 * Handles account connection, chain verification, and transaction signing.
 */

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<any>;
      on?: (eventName: string, handler: (...args: any[]) => void) => void;
      removeListener?: (eventName: string, handler: (...args: any[]) => void) => void;
    };
  }
}

export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "31337");

const CHAIN_PARAMS: Record<number, { chainId: string; chainName: string; rpcUrls: string[]; nativeCurrency: { name: string; symbol: string; decimals: number } }> = {
  31337: {
    chainId: "0x7a69", // 31337 in hex
    chainName: "Hardhat Local",
    rpcUrls: ["http://127.0.0.1:8545"],
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  },
  11155111: {
    chainId: "0xaa36a7", // 11155111 in hex
    chainName: "Ethereum Sepolia",
    rpcUrls: ["https://rpc.sepolia.org"],
    nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
  },
};

export function hasMetaMask(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function getCurrentAddress(): Promise<string | null> {
  if (!hasMetaMask()) return null;
  try {
    const accounts = (await window.ethereum!.request({ method: "eth_accounts" })) as string[];
    return accounts[0] ? accounts[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function ensureCorrectChain(): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask is not installed.");

  const currentChainHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  const targetHex = "0x" + TARGET_CHAIN_ID.toString(16);

  if (currentChainHex.toLowerCase() === targetHex.toLowerCase()) {
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetHex }],
    });
  } catch (switchError: any) {
    // 4902 means the chain has not been added to MetaMask
    if (switchError.code === 4902 && CHAIN_PARAMS[TARGET_CHAIN_ID]) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [CHAIN_PARAMS[TARGET_CHAIN_ID]],
      });
    } else {
      throw switchError;
    }
  }
}

export async function requestWalletConnection(expectedAddress?: string): Promise<string> {
  if (!hasMetaMask()) {
    throw new Error("MetaMask was not detected. Please install the MetaMask browser extension to sign transactions.");
  }

  await ensureCorrectChain();

  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found in MetaMask.");
  }

  const active = accounts[0].toLowerCase();
  if (expectedAddress && active !== expectedAddress.toLowerCase()) {
    throw new Error(
      `Wallet mismatch: Your logged-in organization is registered with wallet ${expectedAddress}, but MetaMask is connected to ${accounts[0]}. Please switch to ${expectedAddress} in MetaMask.`
    );
  }

  return accounts[0];
}

export async function sendMetaMaskTransaction(
  tx: { to: string; data: string; value?: string },
  fromAddress: string
): Promise<string> {
  const connected = await requestWalletConnection(fromAddress);

  const txHash = (await window.ethereum!.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: connected,
        to: tx.to,
        data: tx.data,
        value: tx.value || "0x0",
      },
    ],
  })) as string;

  return txHash;
}
