"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Package, Calendar, Hash, ArrowLeft,
  CheckCircle, Loader2, AlertCircle, Info, FileText
} from "lucide-react";
import Link from "next/link";
import { batchApi, transactionApi, getErrorMessage } from "@/lib/api";
import { sendMetaMaskTransaction, hasMetaMask } from "@/lib/web3";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface FormState {
  batchId: string;
  medicineName: string;
  description: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: string;
}

const initialForm: FormState = {
  batchId: "",
  medicineName: "",
  description: "",
  manufacturingDate: "",
  expiryDate: "",
  quantity: "",
};

type Step = "form" | "preparing" | "signing" | "mining" | "success";

export default function NewBatchPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState<Step>("form");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [registeredId, setRegisteredId] = useState("");
  const [txHash, setTxHash] = useState("");

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const isManufacturer = user?.participant?.role === "Manufacturer";
  const userWallet = user?.participant?.walletAddress;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!userWallet) {
      setError("You must be logged in as a registered participant to register a batch.");
      return;
    }

    if (!isManufacturer) {
      setError("Only participants with the 'Manufacturer' role are permitted to register batches.");
      return;
    }

    if (!hasMetaMask()) {
      setError("MetaMask is required to sign the blockchain transaction. Please install the MetaMask extension.");
      return;
    }

    try {
      // Step 1: Validate and prepare transaction on backend
      setStep("preparing");
      setStatusText("Validating batch parameters and preparing transaction...");

      const prepRes = await batchApi.prepare({
        batchId: form.batchId.trim(),
        medicineName: form.medicineName.trim(),
        description: form.description.trim() || undefined,
        manufacturingDate: form.manufacturingDate,
        expiryDate: form.expiryDate,
        quantity: parseInt(form.quantity, 10),
      });

      if (!prepRes.data?.success || !prepRes.data.data?.tx) {
        throw new Error(prepRes.data?.error?.message || "Failed to prepare batch transaction");
      }

      const preparedTx = prepRes.data.data.tx;

      // Step 2: Sign and send via MetaMask
      setStep("signing");
      setStatusText(`Please confirm the transaction in MetaMask using wallet ${userWallet}...`);

      const hash = await sendMetaMaskTransaction(preparedTx, userWallet);
      setTxHash(hash);

      // Step 3: Submit hash to backend to wait for confirmation & sync MongoDB
      setStep("mining");
      setStatusText("Transaction submitted! Waiting for block confirmation and updating ledger...");

      const txRes = await transactionApi.submit(hash);
      if (!txRes.data?.success) {
        throw new Error(txRes.data?.error?.message || "Transaction failed to confirm on blockchain");
      }

      setRegisteredId(form.batchId.trim());
      setStep("success");
      toast.success("Batch successfully registered on the blockchain!");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Batch registration failed. Check MetaMask connection."));
      setStep("form");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/batches"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Batches
        </Link>
        <h1 className="text-2xl font-display font-bold">Register New Batch</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Validate and record an immutable medicine batch on the blockchain.
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-sm text-sky-700 dark:text-sky-400">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          <span>
            Signing Wallet: <strong>{userWallet || "Not connected"}</strong> ({user?.participant?.role || user?.role || "Unknown"}).
          </span>
          <p className="text-xs text-sky-600 dark:text-sky-500 mt-1">
            MetaMask will prompt you to sign the on-chain registration transaction. Ensure you are connected to the matching account.
          </p>
        </div>
      </div>

      {/* ── Form ──────────────────────────────────────────────── */}
      {(step === "form" || step === "preparing" || step === "signing" || step === "mining") && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-7"
        >
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-sm border border-rose-200 dark:border-rose-800"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="leading-snug">{error}</div>
              </motion.div>
            )}

            {step !== "form" && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-sm">
                <Loader2 size={18} className="animate-spin shrink-0 text-teal-600" />
                <div>
                  <div className="font-semibold capitalize">{step} step in progress</div>
                  <div className="text-xs text-teal-700 dark:text-teal-400">{statusText}</div>
                </div>
              </div>
            )}

            {/* Section: Identity */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
                <Hash size={12} /> Batch Identity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="batch-id">Batch ID *</label>
                  <input
                    id="batch-id"
                    className="input font-mono text-sm"
                    placeholder="e.g. AMOX-2024-0001"
                    value={form.batchId}
                    onChange={set("batchId")}
                    disabled={step !== "form"}
                    required
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label htmlFor="medicine-name">Medicine Name *</label>
                  <input
                    id="medicine-name"
                    className="input"
                    placeholder="e.g. Amoxicillin 500mg"
                    value={form.medicineName}
                    onChange={set("medicineName")}
                    disabled={step !== "form"}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description">Batch Description / Packaging Details (Optional)</label>
              <input
                id="description"
                className="input"
                placeholder="e.g. 10x10 blister pack, foil sealed"
                value={form.description}
                onChange={set("description")}
                disabled={step !== "form"}
              />
            </div>

            {/* Section: Dates */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
                <Calendar size={12} /> Dates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mfg-date">Manufacturing Date *</label>
                  <input
                    id="mfg-date"
                    type="date"
                    className="input"
                    value={form.manufacturingDate}
                    onChange={set("manufacturingDate")}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={step !== "form"}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="expiry-date">Expiry Date *</label>
                  <input
                    id="expiry-date"
                    type="date"
                    className="input"
                    value={form.expiryDate}
                    onChange={set("expiryDate")}
                    min={form.manufacturingDate || undefined}
                    disabled={step !== "form"}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section: Quantity */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
                <Package size={12} /> Inventory
              </h2>
              <div className="max-w-xs">
                <label htmlFor="quantity">Quantity (units) *</label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  className="input"
                  placeholder="e.g. 10000"
                  value={form.quantity}
                  onChange={set("quantity")}
                  disabled={step !== "form"}
                  required
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-2 border-t border-[var(--bg-border)]">
              <Link href="/dashboard/batches" className="btn btn-ghost text-sm">
                Cancel
              </Link>
              <button
                id="register-batch-btn"
                type="submit"
                disabled={step !== "form"}
                className="btn btn-primary text-sm"
              >
                {step !== "form" ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Signing On Chain…
                  </>
                ) : (
                  <>
                    <Package size={15} />
                    Register Batch
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* ── Success screen ─────────────────────────────────────── */}
      {step === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="card p-10 text-center"
        >
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-500 opacity-20 animate-[pulse-ring_2s_ease-out_infinite]" />
            <div className="relative w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
              <CheckCircle size={36} className="text-emerald-500" />
            </div>
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">Batch Registered On-Chain!</h2>
          <p className="text-[var(--text-secondary)] mb-2">
            <span className="font-mono font-medium text-[var(--accent)]">{registeredId}</span> is confirmed on the blockchain.
          </p>
          {txHash && (
            <p className="text-xs font-mono text-[var(--text-tertiary)] mb-4 truncate max-w-sm mx-auto">
              Tx: {txHash}
            </p>
          )}
          <p className="text-sm text-[var(--text-tertiary)] mb-8">
            An official cryptographic QR code has been generated. You can now transfer or print the label.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href={`/dashboard/batches/${encodeURIComponent(registeredId)}`}
              className="btn btn-primary"
            >
              View Batch & QR Code
            </Link>
            <button
              onClick={() => {
                setForm(initialForm);
                setStep("form");
                setError("");
              }}
              className="btn btn-secondary"
            >
              Register Another Batch
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
