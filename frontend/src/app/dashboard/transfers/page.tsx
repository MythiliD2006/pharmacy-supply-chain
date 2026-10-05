"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeftRight, Clock, CheckCircle, XCircle,
  RefreshCw, Filter, Plus, ChevronLeft, ChevronRight,
  Package, ExternalLink, ShieldCheck, AlertCircle
} from "lucide-react";
import Link from "next/link";
import { transferApi, transactionApi, Transfer, getErrorMessage } from "@/lib/api";
import { sendMetaMaskTransaction, hasMetaMask } from "@/lib/web3";
import { StatusPill } from "@/components/ui/StatusPill";
import { HashChip } from "@/components/ui/HashChip";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDateTime, roleName, getEtherscanUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

type FilterType = "all" | "pending" | "confirmed" | "rejected";

export default function TransfersPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState("");

  const userWallet = user?.participant?.walletAddress?.toLowerCase();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam =
        filter === "all"
          ? undefined
          : filter.charAt(0).toUpperCase() + filter.slice(1);

      const res = await transferApi.list({
        status: statusParam,
        limit: 50,
      });

      if (res.data?.success && res.data.data?.items) {
        setTransfers(res.data.data.items);
      } else {
        setTransfers([]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load transfers"));
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (transferId: number, action: "confirm" | "reject" | "cancel") => {
    if (!userWallet) {
      toast.error("You must have a connected participant wallet to perform this action.");
      return;
    }

    if (!hasMetaMask()) {
      toast.error("MetaMask is required to sign on-chain transfer actions.");
      return;
    }

    setActioningId(transferId);
    try {
      setActionStatus(`Preparing ${action}...`);
      const prepRes = await transferApi.prepareAction(transferId, action);
      if (!prepRes.data?.success || !prepRes.data.data?.tx) {
        throw new Error(prepRes.data?.error?.message || `Failed to prepare ${action} transaction`);
      }

      setActionStatus("Signing in MetaMask...");
      const hash = await sendMetaMaskTransaction(prepRes.data.data.tx, userWallet);

      setActionStatus("Confirming on blockchain...");
      const txRes = await transactionApi.submit(hash);
      if (!txRes.data?.success) {
        throw new Error(txRes.data?.error?.message || `Failed to submit ${action} transaction`);
      }

      toast.success(`Transfer successfully ${action === "confirm" ? "confirmed" : action === "reject" ? "rejected" : "cancelled"}!`);
      load();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, `Failed to ${action} transfer`));
    } finally {
      setActioningId(null);
      setActionStatus("");
    }
  };

  const pendingCount = transfers.filter((t) => t.status === "Pending").length;

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            Transfers
            {pendingCount > 0 && (
              <span className="pill pill-pending text-xs">{pendingCount} pending</span>
            )}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Cryptographic custody transfer workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn btn-secondary p-2.5" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {user?.role === "participant" && user.participant?.role !== "Pharmacy" && (
            <Link href="/dashboard/transfers/new" className="btn btn-primary text-sm">
              <Plus size={16} />
              Request Transfer
            </Link>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--bg-border)] pb-2">
        {(["all", "pending", "confirmed", "rejected"] as FilterType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              filter === tab
                ? "bg-[var(--brand-from)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {actionStatus && (
        <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300 text-xs border border-teal-200 dark:border-teal-800 flex items-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <span>{actionStatus}</span>
        </div>
      )}

      {/* Transfers Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-4">
              <SkeletonTable rows={6} />
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-16">
              <ArrowLeftRight size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="font-display font-semibold text-[var(--text-secondary)]">
                {filter === "pending"
                  ? "No pending transfers — you're all caught up ✨"
                  : "No transfers found"}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer #</th>
                  <th>Batch ID</th>
                  <th>Medicine</th>
                  <th>Sender</th>
                  <th>Receiver</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => {
                  const isReceiver = userWallet && t.to.toLowerCase() === userWallet;
                  const isSender = userWallet && t.from.toLowerCase() === userWallet;
                  const isBusy = actioningId === t.transferId;

                  return (
                    <motion.tr
                      key={t._id || t.transferId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td className="font-mono text-xs font-semibold">#{t.transferId}</td>
                      <td>
                        <Link
                          href={`/dashboard/batches/${encodeURIComponent(t.batchId)}`}
                          className="hover:underline font-mono text-xs font-medium text-[var(--brand-to)]"
                        >
                          {t.batchId}
                        </Link>
                      </td>
                      <td className="font-medium text-sm">{t.medicineName ?? "—"}</td>
                      <td>
                        <div className="text-xs">
                          <span className="font-semibold">{t.fromName || "Sender"}</span>
                          <div className="text-[var(--text-tertiary)] text-[10px]">
                            {typeof t.fromRole === "string" ? t.fromRole : roleName(t.fromRole || 1)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-xs">
                          <span className="font-semibold">{t.toName || "Receiver"}</span>
                          <div className="text-[var(--text-tertiary)] text-[10px]">
                            {typeof t.toRole === "string" ? t.toRole : roleName(t.toRole || 2)}
                          </div>
                        </div>
                      </td>
                      <td className="text-[var(--text-secondary)] text-xs">
                        {formatDateTime(t.requestedAt)}
                      </td>
                      <td>
                        <StatusPill
                          status={t.status.toLowerCase() as "pending" | "confirmed" | "rejected" | "cancelled"}
                        />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === "Pending" && isReceiver && (
                            <>
                              <button
                                onClick={() => handleAction(t.transferId, "confirm")}
                                disabled={isBusy}
                                className="btn text-xs py-1 px-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                              >
                                {isBusy ? "Processing..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => handleAction(t.transferId, "reject")}
                                disabled={isBusy}
                                className="btn text-xs py-1 px-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {t.status === "Pending" && isSender && (
                            <button
                              onClick={() => handleAction(t.transferId, "cancel")}
                              disabled={isBusy}
                              className="btn btn-secondary text-xs py-1 px-2.5 text-amber-600"
                            >
                              Cancel
                            </button>
                          )}

                          {t.resolveTxHash && (
                            <a
                              href={getEtherscanUrl(t.resolveTxHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                              title="View on explorer"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
