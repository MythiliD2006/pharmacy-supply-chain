"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Search, ArrowRight, Camera, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";

export default function VerifyPage() {
  const router = useRouter();
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!batchId.trim()) return;
      setLoading(true);
      router.push(`/verify/${encodeURIComponent(batchId.trim())}`);
    },
    [batchId, router]
  );

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Navbar />

      {/* Background */}
      <div className="blob w-96 h-96 top-10 left-1/4 bg-teal-400 opacity-8" />
      <div className="absolute inset-0 grid-pattern opacity-40 dark:opacity-15 pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-20 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] flex items-center justify-center shadow-xl">
            <QrCode size={36} className="text-white" />
          </div>

          <h1 className="text-4xl font-display font-bold mb-3">
            Verify Medicine
          </h1>
          <p className="text-[var(--text-secondary)] text-base mb-10 max-w-sm mx-auto">
            Enter the batch ID from the medicine packaging, or scan the QR code
            to instantly check authenticity and chain of custody.
          </p>

          {/* Search form */}
          <div className="card p-6 mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="batch-id-input">Batch ID</label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
                  />
                  <input
                    id="batch-id-input"
                    type="text"
                    className="input pl-9 font-mono text-sm"
                    placeholder="e.g. BATCH-2024-001A"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {batchId && (
                    <button
                      type="button"
                      onClick={() => setBatchId("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                      aria-label="Clear"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <button
                id="verify-submit-btn"
                type="submit"
                disabled={!batchId.trim() || loading}
                className="btn btn-primary w-full py-3 text-base"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    Verify Batch
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Scanner option */}
          <Link
            href="/verify/scan"
            className="flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border-2 border-dashed border-[var(--bg-border)] hover:border-[var(--brand-to)]/50 hover:bg-[var(--bg-hover)] transition-all group"
          >
            <Camera size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--brand-to)] transition-colors" />
            <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">
              Or scan QR code with camera
            </span>
            <ArrowRight size={14} className="text-[var(--text-tertiary)] group-hover:text-[var(--brand-to)] transition-all group-hover:translate-x-1" />
          </Link>

          <p className="text-xs text-[var(--text-tertiary)] mt-6">
            No account required · Free to use · Powered by Ethereum
          </p>
        </motion.div>
      </div>
    </div>
  );
}
