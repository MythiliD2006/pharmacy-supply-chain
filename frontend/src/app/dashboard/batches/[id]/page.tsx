"use client";

import { use, useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Package, Calendar, Hash, Building2,
  Download, Share2, ExternalLink, ArrowLeftRight,
  Factory, Truck, Store, Pill, AlertCircle, Clock, Ban, X
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { toast } from "sonner";
import { batchApi, transactionApi, Batch, Transfer, RecallInfo, getErrorMessage } from "@/lib/api";
import { sendMetaMaskTransaction, hasMetaMask } from "@/lib/web3";
import { useAuth } from "@/context/AuthContext";
import { HashChip } from "@/components/ui/HashChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { formatDate, roleName, getEtherscanUrl, isExpired } from "@/lib/utils";

const roleIcons: Record<string, React.ReactNode> = {
  "1": <Factory size={16} className="text-emerald-500" />,
  "2": <Truck size={16} className="text-sky-500" />,
  "3": <Store size={16} className="text-violet-500" />,
  "4": <Pill size={16} className="text-rose-500" />,
  Manufacturer: <Factory size={16} className="text-emerald-500" />,
  Distributor: <Truck size={16} className="text-sky-500" />,
  Wholesaler: <Store size={16} className="text-violet-500" />,
  Pharmacy: <Pill size={16} className="text-rose-500" />,
};

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);

  const [batch, setBatch] = useState<Batch | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [pendingTransfer, setPendingTransfer] = useState<Transfer | null>(null);
  const [isHolder, setIsHolder] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isManufacturer, setIsManufacturer] = useState(false);
  const [recall, setRecall] = useState<RecallInfo | null>(null);
  const [apiStatus, setApiStatus] = useState("");
  const [showRecall, setShowRecall] = useState(false);
  const [recallReason, setRecallReason] = useState("");
  const [recalling, setRecalling] = useState(false);
  const [recallStep, setRecallStep] = useState("");

  const { user } = useAuth();
  const userWallet = user?.participant?.walletAddress;

  const load = useCallback(() => {
    return batchApi
      .get(decodedId)
      .then((res) => {
        if (res.data?.success && res.data.data) {
          const d = res.data.data;
          setBatch(d.batch);
          setHistory(d.history || []);
          setTransfers(d.transfers || []);
          setPendingTransfer(d.pendingTransfer || null);
          setIsHolder(Boolean(d.isHolder));
          setStatusMessage(d.statusMessage || "");
          setIsManufacturer(Boolean(d.isManufacturer));
          setRecall(d.recall || null);
          setApiStatus(d.status || "");

          if (d.qrCode) {
            setQrDataUrl(d.qrCode);
          } else {
            const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(d.batch.batchId)}`;
            QRCode.toDataURL(verifyUrl, {
              width: 256,
              margin: 2,
              color: { dark: "#0F766E", light: "#FFFFFF" },
            }).then(setQrDataUrl);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [decodedId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecall = async () => {
    const reason = recallReason.trim();
    if (reason.length < 3) {
      toast.error("Please give a reason for the recall (at least 3 characters).");
      return;
    }
    if (!userWallet) {
      toast.error("Your account has no linked wallet.");
      return;
    }
    if (!hasMetaMask()) {
      toast.error("MetaMask is required to sign the recall.");
      return;
    }
    setRecalling(true);
    try {
      setRecallStep("Checking the recall...");
      const prep = await batchApi.prepareRecall(decodedId, reason);
      if (!prep.data?.success || !prep.data.data?.tx) {
        throw new Error(prep.data?.error?.message || "Could not prepare the recall");
      }

      setRecallStep("Sign the recall in MetaMask...");
      const hash = await sendMetaMaskTransaction(prep.data.data.tx, userWallet);

      setRecallStep("Waiting for the blockchain...");
      const txRes = await transactionApi.submit(hash);
      if (!txRes.data?.success) {
        throw new Error(txRes.data?.error?.message || "Recall transaction failed");
      }

      toast.success("Batch recalled. It can no longer be transferred and every scan will show it as recalled.");
      setShowRecall(false);
      setRecallReason("");
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to recall batch"));
    } finally {
      setRecalling(false);
      setRecallStep("");
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${decodedId}-qr.png`;
    a.click();
  };

  const isRecalled = Boolean(batch?.recalled || recall || apiStatus === "RECALLED");

  const status = batch
    ? isRecalled
      ? "recalled"
      : apiStatus === "INCONSISTENT"
      ? "inconsistent"
      : isExpired(batch.expiryDate)
      ? "expired"
      : (batch.status ?? "genuine")
    : "pending";

  const recallReasonText = recall?.reason || batch?.recallReason || "";
  const recalledAt = recall?.recalledAt || batch?.recalledAt || null;

  const txHash = batch?.registerTxHash || batch?.txHash;

  return (
    <div className="max-w-screen-xl space-y-5">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/batches"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> All Batches
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold">{loading ? "Loading…" : batch?.medicineName}</h1>
            {batch && <HashChip value={batch.batchId} truncate={false} label="Batch ID" />}
          </div>
          <div className="flex items-center gap-2">
            {batch && <StatusPill status={status} />}
            {isManufacturer && !isRecalled && (
              <button onClick={() => setShowRecall(true)} className="btn btn-secondary text-sm text-rose-600">
                <Ban size={15} /> Recall Batch
              </button>
            )}
            {isHolder && !pendingTransfer && !isRecalled && !isExpired(batch?.expiryDate ?? 0) && (
              <Link href="/dashboard/transfers/new" className="btn btn-primary text-sm">
                <ArrowLeftRight size={15} /> Transfer Batch
              </Link>
            )}
          </div>
        </div>
      </div>

      {batch && isRecalled && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm">
          <Ban size={18} className="shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <div className="font-semibold">This batch has been recalled by the manufacturer</div>
            {recallReasonText && <div>Reason: {recallReasonText}</div>}
            {recalledAt && <div className="text-xs opacity-80">Recalled on {formatDate(recalledAt)}</div>}
            <div className="text-xs opacity-80">
              It can no longer be transferred, and customers who scan it are told not to use it.
            </div>
            {batch.recallTxHash && (
              <a
                href={getEtherscanUrl(batch.recallTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] underline"
              >
                <ExternalLink size={10} /> Recall transaction
              </a>
            )}
          </div>
        </div>
      )}

      {!isRecalled && apiStatus === "INCONSISTENT" && statusMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {pendingTransfer && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={16} className="shrink-0 animate-pulse text-amber-600" />
            <span>Transfer to <strong>{pendingTransfer.toName || pendingTransfer.to}</strong> is currently pending confirmation.</span>
          </div>
          <Link href="/dashboard/transfers" className="btn btn-secondary text-xs py-1.5">
            View Transfers
          </Link>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SkeletonCard className="lg:col-span-2" />
          <SkeletonCard />
        </div>
      ) : !batch ? (
        <div className="card p-12 text-center">
          <Package size={48} className="mx-auto text-[var(--text-tertiary)] mb-4" />
          <h2 className="font-display font-semibold text-lg mb-2">Batch not found</h2>
          <p className="text-sm text-[var(--text-secondary)]">No batch with ID "{decodedId}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Details + Timeline */}
          <div className="lg:col-span-2 space-y-5">
            {/* Details card */}
            <div className="card p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">
                Batch Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem icon={<Package size={15} />} label="Medicine Name" value={batch.medicineName} />
                <DetailItem icon={<Hash size={15} />} label="Batch ID" value={<HashChip value={batch.batchId} truncate={false} />} />
                <DetailItem icon={<Building2 size={15} />} label="Manufacturer" value={<HashChip value={batch.manufacturer} label="manufacturer" />} />
                <DetailItem icon={<Package size={15} />} label="Quantity" value={`${batch.quantity.toLocaleString()} units`} />
                <DetailItem icon={<Calendar size={15} />} label="Manufacturing Date" value={formatDate(batch.manufacturingDate)} />
                <DetailItem
                  icon={<Calendar size={15} />}
                  label="Expiry Date"
                  value={
                    <span className={isExpired(batch.expiryDate) ? "text-amber-600 font-semibold" : ""}>
                      {formatDate(batch.expiryDate)}
                    </span>
                  }
                />
                {batch.currentHolder && (
                  <DetailItem
                    icon={<Building2 size={15} />}
                    label="Current Holder"
                    value={<HashChip value={batch.currentHolder} label="current holder" />}
                  />
                )}
                {txHash && (
                  <DetailItem
                    icon={<ExternalLink size={15} />}
                    label="Registration Tx"
                    value={
                      <HashChip
                        value={txHash}
                        href={getEtherscanUrl(txHash)}
                        label="tx hash"
                      />
                    }
                  />
                )}
              </div>
            </div>

            {/* Transfer history card */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <ArrowLeftRight size={16} className="text-[var(--brand-to)]" />
                <h2 className="text-sm font-display font-semibold">Chain of Custody History</h2>
              </div>
              <div className="timeline">
                {/* Step 0: Registered */}
                <div className="timeline-item">
                  <div className="timeline-dot bg-emerald-500" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {roleIcons["Manufacturer"]}
                      <span className="text-sm font-semibold">{batch.manufacturerName || "Manufacturer"}</span>
                      <span className="pill pill-genuine text-xs">Origin</span>
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">
                      {batch.registeredAt ? formatDate(batch.registeredAt) : "Batch Registered"}
                    </div>
                    {txHash && (
                      <a
                        href={getEtherscanUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                      >
                        <ExternalLink size={10} /> View on explorer
                      </a>
                    )}
                  </div>
                </div>

                {/* Additional transfers */}
                {transfers.map((t, idx) => (
                  <div key={idx} className="timeline-item">
                    <div
                      className={`timeline-dot ${
                        t.status === "Confirmed"
                          ? "bg-emerald-500"
                          : t.status === "Pending"
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                    />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {roleIcons[String(t.toRole)] ?? roleIcons["2"]}
                        <span className="text-sm font-semibold">{t.toName || t.to}</span>
                        <span className="pill pill-accent text-xs">
                          {typeof t.toRole === "string" ? t.toRole : roleName(t.toRole ?? 2)}
                        </span>
                        <span
                          className={`pill text-xs ${
                            t.status === "Confirmed"
                              ? "pill-genuine"
                              : t.status === "Pending"
                              ? "pill-pending"
                              : "pill-expired"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        {t.resolvedAt ? formatDate(t.resolvedAt) : formatDate(t.requestedAt)}
                      </div>
                      {t.resolveTxHash && (
                        <a
                          href={getEtherscanUrl(t.resolveTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline"
                        >
                          <ExternalLink size={10} /> Confirmation Tx
                        </a>
                      )}
                    </div>
                  </div>
                ))}

                {transfers.length === 0 && (
                  <p className="text-xs text-[var(--text-tertiary)] ml-2 mt-2 italic">
                    No transfers have taken place yet. This batch is currently held by the manufacturer.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: QR Code */}
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="card p-6 text-center"
              style={{
                background: "linear-gradient(145deg, var(--bg-card), var(--bg-lifted))",
              }}
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">
                Verification QR Code
              </h2>

              <div className="relative inline-block">
                <div
                  className="absolute -inset-1 rounded-2xl opacity-60"
                  style={{
                    background: "linear-gradient(135deg, var(--brand-from), var(--brand-to))",
                    filter: "blur(8px)",
                  }}
                />
                <div className="relative bg-white rounded-xl p-4 inline-block shadow-lg">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt={`QR code for batch ${batch.batchId}`}
                      className="w-48 h-48"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-gray-400">
                      Generating...
                    </div>
                  )}
                </div>
              </div>

              <p className="text-xs text-[var(--text-tertiary)] mt-4 mb-5">
                Scan to verify medicine authenticity
              </p>

              <div className="flex gap-2 justify-center flex-wrap">
                <button onClick={downloadQR} className="btn btn-primary text-sm">
                  <Download size={14} /> Download PNG
                </button>
                <Link
                  href={`/verify/${encodeURIComponent(batch.batchId)}`}
                  className="btn btn-secondary text-sm"
                >
                  <Share2 size={14} /> Public View
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Recall dialog */}
      <AnimatePresence>
        {showRecall && batch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={() => !recalling && setShowRecall(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="card p-6 w-full max-w-md space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                  <Ban size={18} className="text-rose-500" /> Recall {batch.batchId}
                </h2>
                <button
                  onClick={() => setShowRecall(false)}
                  disabled={recalling}
                  className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                Recalling is permanent and is written to the blockchain. The batch can no longer be transferred,
                any pending transfer can only be rejected or cancelled, and every customer scan will show it as recalled.
              </p>
              <div>
                <label htmlFor="recall-reason" className="text-xs font-semibold text-[var(--text-secondary)]">
                  Reason for recall
                </label>
                <textarea
                  id="recall-reason"
                  value={recallReason}
                  onChange={(e) => setRecallReason(e.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="e.g. Failed stability test, contaminated lot, labelling error"
                  className="input w-full mt-1"
                  disabled={recalling}
                />
                <div className="text-[11px] text-[var(--text-tertiary)] text-right">{recallReason.length}/300</div>
              </div>
              {recallStep && <p className="text-xs text-[var(--text-secondary)]">{recallStep}</p>}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowRecall(false)} disabled={recalling} className="btn btn-secondary text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleRecall}
                  disabled={recalling || recallReason.trim().length < 3}
                  className="btn btn-primary text-sm bg-rose-600 hover:bg-rose-700"
                >
                  <Ban size={14} /> {recalling ? "Recalling..." : "Recall batch"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[var(--text-tertiary)] mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-tertiary)] mb-0.5">{label}</div>
        <div className="text-sm font-medium break-all">{value}</div>
      </div>
    </div>
  );
}