"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard, truncateAddress } from "@/lib/utils";

interface HashChipProps {
  value: string;
  truncate?: boolean;
  chars?: number;
  href?: string;
  label?: string;
}

export function HashChip({
  value,
  truncate = true,
  chars = 8,
  href,
  label,
}: HashChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    await copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const display = truncate ? truncateAddress(value, chars) : value;

  const inner = (
    <span className="hash-chip group">
      <span className="select-all">{display}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-[var(--brand-to)]"
        aria-label={`Copy ${label ?? "value"}`}
        title="Copy to clipboard"
      >
        {copied ? (
          <Check size={11} className="text-emerald-500" />
        ) : (
          <Copy size={11} />
        )}
      </button>
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return inner;
}
