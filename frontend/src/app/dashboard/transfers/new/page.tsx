"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Search, Hash, Package, Building2, Info
} from "lucide-react";
import Link from "next/link";
import { transferApi, participantApi, batchApi, transactionApi, Participant, Batch, getErrorMessage } from "@/lib/api";
import { sendMetaMaskTransaction, hasMetaMask } from "@/lib/web3";
import { HashChip } from "@/components/ui/HashChip";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function NewTransferPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const [batchId, setBatchId] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const userWallet = user?.participant?.walletAddress;
  const userRole = user?.participant?.role;

  useEffect(() => {
    Promise.all([
      // Fetch batches held by the current user
      batchApi.list({ scope: "holding", limit: 100 }),
      // Fetch active participants in directory (excluding self)
      participantApi.directory(),
    ])
      .then(([bRes, pRes]) => {
        if (bRes.data?.success && bRes.data.data?.items) {
          setBatches(bRes.data.data.items);
        }
        if (pRes.data?.success && pRes.data.data?.items) {
          setParticipants(pRes.data.data.items);
        }
      })
      .catch((err) => {
        setError(getErrorMessage(err, "Failed to load batches or participant directory"));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !toAddress) {
      setError("Please select both a batch and a recipient.");
      return;
    }

    if (!userWallet) {
      setError("You must be logged in as an authorized participant to transfer batches.");
      return;
    }

    if (userRole === "Pharmacy") {
      setError("Pharmacies are the final dispensing point and cannot transfer batches.");
      return;
    }

    if (!hasMetaMask()) {
      setError("MetaMask is required to sign the transfer request on the blockchain.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      // Step 1: Prepare transaction on backend
      setStatusText("Validating transfer parameters and preparing blockchain call...");
      const prepRes = await transferApi.prepareRequest({ batchId, to: toAddress });
      if (!prepRes.data?.success || !prepRes.data.data?.tx) {
        throw new Error(prepRes.data?.error?.message || "Failed to prepare transfer transaction");
      }

      // Step 2: Sign in MetaMask
      setStatusText(`Please confirm the transfer transaction in MetaMask with wallet ${userWallet}...`);
      const hash = await sendMetaMaskTransaction(prepRes.data.data.tx, userWallet);

      // Step 3: Record transaction
      setStatusText("Transfer submitted to blockchain. Awaiting confirmation...");
      const txRes = await transactionApi.submit(hash);
      if (!txRes.data?.success) {
        throw new Error(txRes.data?.error?.message || "Transaction failed on blockchain");
      }

      toast.success("Transfer requested successfully on-chain!");
      router.push("/dashboard/transfers");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to request transfer"));
    } finally {
      setSubmitting(false);
      setStatusText("");
    }
  };

  const selectedBatch = batches.find((b) => b.batchId === batchId);
  const selectedParticipant = participants.find(
    (p) => p.walletAddress.toLowerCase() === toAddress.toLowerCase()
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <Link
          href="/dashboard/transfers"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Transfers
        </Link>
        <h1 className="text-2xl font-display font-bold">Request Transfer</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Initiate an on-chain custody handover to the next supply chain partner.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sm text-sky-700 dark:text-sky-400">
        <Info size={16} className="shrink-0 mt-0.5" />
        <span>
          Logged in as <strong>{user?.name || "Participant"}</strong> ({userRole || user?.role}).
          Transfers must follow the supply chain order (Manufacturer → Distributor → Wholesaler → Pharmacy).
        </span>
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-7">
        {loading ? (
          <div className="py-12 text-center text-sm text-[var(--text-secondary)] flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading your batches and directory...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm border border-rose-200 dark:border-rose-800">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="leading-snug">{error}</div>
              </div>
            )}

            {submitting && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-sm">
                <Loader2 size={18} className="animate-spin shrink-0 text-teal-600" />
                <div>
                  <div className="font-semibold">Signing blockchain transfer</div>
                  <div className="text-xs text-teal-700 dark:text-teal-400">{statusText}</div>
                </div>
              </div>
            )}

            {/* Select Batch */}
            <div>
              <label htmlFor="batch-select">Batch to Transfer *</label>
              <select
                id="batch-select"
                className="input"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="">Select a batch you currently hold...</option>
                {batches.map((b) => (
                  <option key={b.batchId} value={b.batchId}>
                    {b.batchId} — {b.medicineName} ({b.quantity} units)
                  </option>
                ))}
              </select>
              {batches.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  You do not currently hold any confirmed batches available for transfer.
                </p>
              )}
            </div>

            {/* Batch preview preview */}
            {selectedBatch && (
              <div className="p-4 rounded-xl bg-[var(--bg-lifted)] border border-[var(--bg-border)] text-xs space-y-2">
                <div className="font-semibold text-[var(--text-primary)]">Selected Batch Details:</div>
                <div className="grid grid-cols-2 gap-2 text-[var(--text-secondary)]">
                  <div>Medicine: <strong className="text-[var(--text-primary)]">{selectedBatch.medicineName}</strong></div>
                  <div>Quantity: <strong className="text-[var(--text-primary)]">{selectedBatch.quantity}</strong></div>
                  <div>Expiry: <strong className="text-[var(--text-primary)]">{selectedBatch.expiryDate?.slice(0, 10)}</strong></div>
                  <div>Status: <strong className="text-emerald-600 capitalize">{selectedBatch.chainStatus}</strong></div>
                </div>
              </div>
            )}

            {/* Select Recipient */}
            <div>
              <label htmlFor="recipient-select">Transfer Recipient *</label>
              <select
                id="recipient-select"
                className="input"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                disabled={submitting}
                required
              >
                <option value="">Select an active partner organization...</option>
                {participants.map((p) => (
                  <option key={p.walletAddress} value={p.walletAddress}>
                    {p.name} ({p.role}) — {p.location || p.walletAddress.slice(0, 10) + "..."}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient preview */}
            {selectedParticipant && (
              <div className="p-4 rounded-xl bg-[var(--bg-lifted)] border border-[var(--bg-border)] text-xs space-y-1">
                <div className="font-semibold text-[var(--text-primary)]">{selectedParticipant.name}</div>
                <div className="text-[var(--text-secondary)]">Role: {selectedParticipant.role}</div>
                <div className="font-mono text-[10px] text-[var(--text-tertiary)]">{selectedParticipant.walletAddress}</div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--bg-border)]">
              <Link href="/dashboard/transfers" className="btn btn-ghost text-sm">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !batchId || !toAddress}
                className="btn btn-primary text-sm gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Send Transfer Request
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
