import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export function formatDate(timestamp: number | string | Date): string {
  const date = new Date(
    typeof timestamp === "number" && timestamp < 1e12
      ? timestamp * 1000
      : timestamp
  );
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(timestamp: number | string | Date): string {
  const date = new Date(
    typeof timestamp === "number" && timestamp < 1e12
      ? timestamp * 1000
      : timestamp
  );
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isExpired(expiryDate: number | string | Date): boolean {
  const d = new Date(
    typeof expiryDate === "number" && expiryDate < 1e12
      ? expiryDate * 1000
      : expiryDate
  );
  return d < new Date();
}

export function roleName(role: number | string): string {
  const roles: Record<string, string> = {
    "0": "None",
    "1": "Manufacturer",
    "2": "Distributor",
    "3": "Wholesaler",
    "4": "Pharmacy",
  };
  return roles[String(role)] ?? String(role);
}

export function roleColor(role: number | string): string {
  const colors: Record<string, string> = {
    "1": "text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400",
    "2": "text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400",
    "3": "text-violet-600 bg-violet-50 dark:bg-violet-950 dark:text-violet-400",
    "4": "text-rose-600 bg-rose-50 dark:bg-rose-950 dark:text-rose-400",
  };
  return colors[String(role)] ?? "text-gray-600 bg-gray-50";
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function getEtherscanUrl(txHash: string, chainId = 11155111): string {
  if (chainId === 11155111) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
