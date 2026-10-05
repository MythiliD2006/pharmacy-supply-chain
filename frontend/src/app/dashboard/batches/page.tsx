"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, Search, Filter, Package, ChevronLeft,
  ChevronRight, MoreHorizontal, Eye, ArrowRight,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { batchApi, Batch } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import { HashChip } from "@/components/ui/HashChip";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDate, isExpired } from "@/lib/utils";

const DEMO_BATCHES: Batch[] = Array.from({ length: 12 }, (_, i) => ({
  _id: String(i),
  batchId: `BATCH-2024-${String(i + 1).padStart(4, "0")}`,
  medicineName: ["Amoxicillin 500mg", "Paracetamol 650mg", "Azithromycin 250mg", "Ibuprofen 400mg", "Metformin 500mg"][i % 5],
  manufacturer: `0x${Math.random().toString(16).slice(2, 42)}`,
  manufacturingDate: new Date(Date.now() - (i + 1) * 30 * 86400000).toISOString(),
  expiryDate: new Date(Date.now() + (i % 3 === 0 ? -5 : (i + 1) * 60) * 86400000).toISOString(),
  quantity: Math.floor(1000 + Math.random() * 20000),
  status: i % 5 === 0 ? "expired" : i % 7 === 0 ? "invalid" : "genuine",
}));

function getBatchStatus(batch: Batch): "genuine" | "expired" | "invalid" {
  if (batch.status) return batch.status as "genuine" | "expired" | "invalid";
  if (isExpired(batch.expiryDate)) return "expired";
  return "genuine";
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await batchApi.list({ page, limit: PAGE_SIZE, search: search.trim() || undefined });
      if (res.data?.success && res.data?.data?.items) {
        setBatches(res.data.data.items);
        setTotal(res.data.data.total ?? res.data.data.items.length);
      } else {
        setBatches([]);
      }
    } catch {
      setBatches(DEMO_BATCHES);
      setTotal(DEMO_BATCHES.length);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const filtered = search
    ? batches.filter(
        (b) =>
          b.batchId.toLowerCase().includes(search.toLowerCase()) ||
          b.medicineName.toLowerCase().includes(search.toLowerCase())
      )
    : batches;

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Batches</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            All registered medicine batches
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn btn-secondary p-2.5" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/dashboard/batches/new" className="btn btn-primary text-sm">
            <Plus size={16} />
            Register Batch
          </Link>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="card p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            id="batch-search"
            type="text"
            className="input pl-9 py-2 text-sm"
            placeholder="Search by batch ID or medicine name…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button className="btn btn-secondary text-sm py-2 gap-2">
          <Filter size={14} />
          Filters
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-4">
              <SkeletonTable rows={8} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Package size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="font-display font-semibold text-[var(--text-secondary)]">No batches found</p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                {search ? "Try a different search term" : "Register your first batch to get started"}
              </p>
              {!search && (
                <Link href="/dashboard/batches/new" className="btn btn-primary mt-4 text-sm inline-flex">
                  <Plus size={16} /> Register Batch
                </Link>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Medicine</th>
                  <th>Quantity</th>
                  <th>Mfg Date</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((batch, i) => (
                  <motion.tr
                    key={batch._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td>
                      <HashChip value={batch.batchId} truncate={false} label="Batch ID" />
                    </td>
                    <td className="font-medium">{batch.medicineName}</td>
                    <td className="tabular-nums">{batch.quantity.toLocaleString()}</td>
                    <td className="text-[var(--text-secondary)]">{formatDate(batch.manufacturingDate)}</td>
                    <td className={isExpired(batch.expiryDate) ? "text-amber-600 font-semibold" : "text-[var(--text-secondary)]"}>
                      {formatDate(batch.expiryDate)}
                    </td>
                    <td>
                      <StatusPill status={getBatchStatus(batch)} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/verify/${encodeURIComponent(batch.batchId)}`}
                          className="btn btn-ghost p-1.5 text-[var(--text-tertiary)]"
                          title="Verify"
                        >
                          <Eye size={15} />
                        </Link>
                        <Link
                          href={`/dashboard/batches/${encodeURIComponent(batch.batchId)}`}
                          className="btn btn-ghost p-1.5 text-[var(--text-tertiary)]"
                          title="View details"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--bg-border)]">
            <p className="text-sm text-[var(--text-tertiary)]">
              Showing {filtered.length} batches
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-ghost p-2"
                aria-label="Previous page"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-medium px-2">{page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={filtered.length < PAGE_SIZE}
                className="btn btn-ghost p-2"
                aria-label="Next page"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
