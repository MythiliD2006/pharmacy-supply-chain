"use client";

import { use, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, ShieldX, AlertTriangle, Clock,
  Package, Calendar, Hash, Building2, ArrowLeft,
  ExternalLink, Share2, QrCode, CheckCircle, XCircle,
  Factory, Truck, Store, Pill, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { verifyApi, VerifyResult } from "@/lib/api";
import { HashChip } from "@/components/ui/HashChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate, formatDateTime, roleName, getEtherscanUrl } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";
import { toast } from "sonner";

type VerifyStatus = "genuine" | "expired" | "invalid" | "pending";

const roleIcons: Record<number, React.ReactNode> = {
  1: <Factory size={18} className="text-emerald-500" />,
  2: <Truck size={18} className="text-sky-500" />,
  3: <Store size={18} className="text-violet-500" />,
  4: <Pill size={18} className="text-rose-500" />,
};

function getStatus(result: VerifyResult): VerifyStatus {
  if (!result.registered) return "invalid";
  if (result.expired) return "expired";
  if (!result.historyValid) return "invalid";
  return "genuine";
}

const statusConfig = {
  genuine: {
    icon: <ShieldCheck size={48} className="text-emerald-500" />,
    title: "Genuine Medicine",
    subtitle: "This batch is verified on the blockchain",
    bg: "from-emerald-500/10 to-teal-500/5",
    border: "border-emerald-500/20",
    glow: "0 0 40px rgba(20,184,166,0.2)",
  },
  expired: {
    icon: <AlertTriangle size={48} className="text-amber-500" />,
    title: "Batch Expired",
    subtitle: "This medicine has passed its expiry date",
    bg: "from-amber-500/10 to-orange-500/5",
    border: "border-amber-500/20",
    glow: "0 0 40px rgba(245,158,11,0.2)",
  },
  invalid: {
    icon: <ShieldX size={48} className="text-rose-500" />,
    title: "Invalid / Unverified",
    subtitle: "This batch could not be verified on-chain",
    bg: "from-rose-500/10 to-pink-500/5",
    border: "border-rose-500/20",
    glow: "0 0 40px rgba(244,63,94,0.2)",
  },
  pending: {
    icon: <Clock size={48} className="text-sky-500" />,
    title: "Verification Pending",
    subtitle: "Checking the blockchain…",
    bg: "from-sky-500/10 to-blue-500/5",
    border: "border-sky-500/20",
    glow: "0 0 40px rgba(56,189,248,0.2)",
  },
};

export default function VerifyResultPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const decodedId = decodeURIComponent(batchId);

  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const res = await verifyApi.verify(decodedId);
        setResult(res.data);
      } catch {
        setError("Could not reach the verification service. Try again later.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [decodedId]);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "PharmaChain Verification",
        text: `Batch ${decodedId} verification result`,
        url: window.location.href,
      });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    }
  };

  const status = result ? getStatus(result) : "pending";
  const cfg = statusConfig[status];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 pt-24 pb-12">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Link
            href="/verify"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft size={14} />
            Verify another batch
          </Link>
        </motion.div>

        {/* Batch ID chip */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 mb-6"
        >
          <HashChip value={decodedId} truncate={false} label="Batch ID" />
        </motion.div>

        {/* ── Loading state ──────────────────────────────────────── */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card p-8 text-center space-y-6"
          >
            {/* Shimmering shield */}
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] opacity-20 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[var(--brand-from)]/20 to-[var(--brand-to)]/20 flex items-center justify-center">
                <ShieldCheck size={40} className="text-[var(--brand-to)] animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold mb-2">
                Verifying on blockchain…
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Checking Ethereum Sepolia for batch {decodedId}
              </p>
            </div>
            <div className="flex gap-1.5 justify-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 rounded-full bg-[var(--brand-to)]"
                  style={{
                    animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Error state ────────────────────────────────────────── */}
        {!loading && error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-8 text-center border border-rose-500/20"
          >
            <XCircle size={48} className="text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-display font-semibold mb-2">
              Verification Failed
            </h2>
            <p className="text-[var(--text-secondary)] text-sm">{error}</p>
          </motion.div>
        )}

        {/* ── Result ────────────────────────────────────────────── */}
        {!loading && result && (
          <AnimatePresence>
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {/* Status card */}
              <div
                className={`card p-8 text-center bg-gradient-to-b ${cfg.bg} border ${cfg.border}`}
                style={{ boxShadow: cfg.glow }}
              >
                {/* Icon with animation */}
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.15 }}
                  className="flex justify-center mb-4"
                >
                  {status === "genuine" ? (
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-emerald-400 opacity-0 animate-[pulse-ring_2s_ease-out_infinite]" />
                      {cfg.icon}
                    </div>
                  ) : (
                    <motion.div
                      animate={status === "invalid" ? { x: [-4, 4, -4, 4, 0] } : {}}
                      transition={{ duration: 0.4, delay: 0.3 }}
                    >
                      {cfg.icon}
                    </motion.div>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <StatusPill status={status} className="mb-3 mx-auto" />
                  <h2 className="text-2xl font-display font-bold mb-2">{cfg.title}</h2>
                  <p className="text-[var(--text-secondary)] text-sm">{cfg.subtitle}</p>
                </motion.div>
              </div>

              {/* Medicine details */}
              {result.batch && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="card p-5"
                >
                  <h3 className="text-sm font-display font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-4">
                    Medicine Details
                  </h3>
                  <div className="space-y-3.5">
                    <DetailRow icon={<Package size={16} />} label="Medicine Name" value={result.batch.medicineName} />
                    <DetailRow icon={<Hash size={16} />} label="Batch ID" value={<HashChip value={result.batch.batchId} truncate={false} />} />
                    <DetailRow icon={<Building2 size={16} />} label="Manufacturer" value={<HashChip value={result.batch.manufacturer} label="manufacturer address" />} />
                    <DetailRow icon={<Calendar size={16} />} label="Manufacturing Date" value={formatDate(result.batch.manufacturingDate)} />
                    <DetailRow
                      icon={<Calendar size={16} />}
                      label="Expiry Date"
                      value={
                        <span className={result.expired ? "text-amber-600 font-semibold" : ""}>
                          {formatDate(result.batch.expiryDate)}
                        </span>
                      }
                    />
                    <DetailRow icon={<Package size={16} />} label="Quantity" value={`${result.batch.quantity.toLocaleString()} units`} />
                  </div>
                </motion.div>
              )}

              {/* Transfer timeline */}
              {result.custodyHistory && result.custodyHistory.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="card p-5"
                >
                  <h3 className="text-sm font-display font-semibold uppercase tracking-widest text-[var(--text-tertiary)] mb-5">
                    Transfer History
                  </h3>
                  <div className="timeline">
                    {result.custodyHistory.map((record, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="timeline-item"
                      >
                        <div className="timeline-dot" />
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {roleIcons[record.toRole]}
                            <span className="text-sm font-semibold">
                              {record.toName ?? truncateAddr(record.to)}
                            </span>
                            <span className="pill pill-accent text-xs">
                              {roleName(record.toRole)}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)]">
                            From {record.fromName ?? truncateAddr(record.from)} · {formatDateTime(record.timestamp)}
                          </div>
                          {record.txHash && (
                            <a
                              href={getEtherscanUrl(record.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline mt-0.5"
                            >
                              <ExternalLink size={10} />
                              Verified on-chain
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex gap-3"
              >
                <button onClick={handleShare} className="btn btn-secondary flex-1">
                  <Share2 size={16} />
                  Share Result
                </button>
                <Link href="/verify" className="btn btn-primary flex-1">
                  <QrCode size={16} />
                  Scan Another
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-[var(--text-tertiary)] mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--text-tertiary)] mb-0.5">{label}</div>
        <div className="text-sm font-medium text-[var(--text-primary)] break-all">{value}</div>
      </div>
    </div>
  );
}

function truncateAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
