"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Package, Calendar, Hash, Building2,
  Download, Share2, ExternalLink, ArrowLeftRight,
  Factory, Truck, Store, Pill, AlertCircle, Clock
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { batchApi, Batch, Transfer } from "@/lib/api";
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

  useEffect(() => {
    batchApi
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

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${decodedId}-qr.png`;
    a.click();
  };

  const status = batch
    ? isExpired(batch.expiryDate)
      ? "expired"
      : (batch.status ?? "genuine")
    : "pending";

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
            {batch && <StatusPill status={status as "genuine" | "expired" | "invalid"} />}
            {isHolder && !pendingTransfer && (
              <Link href="/dashboard/transfers/new" className="btn btn-primary text-sm">
                <ArrowLeftRight size={15} /> Transfer Batch
              </Link>
            )}
          </div>
        </div>
      </div>

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
