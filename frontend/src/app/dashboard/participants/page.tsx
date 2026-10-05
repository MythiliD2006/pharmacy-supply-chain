"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, CheckCircle, XCircle,
  Factory, Truck, Store, Pill, RefreshCw, Shield, AlertCircle, X, Loader2
} from "lucide-react";
import { participantApi, Participant, getErrorMessage } from "@/lib/api";
import { HashChip } from "@/components/ui/HashChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { formatDate, roleName } from "@/lib/utils";
import { toast } from "sonner";

const roleIcons: Record<string, React.ReactNode> = {
  "1": <Factory size={14} className="text-emerald-500" />,
  "2": <Truck size={14} className="text-sky-500" />,
  "3": <Store size={14} className="text-violet-500" />,
  "4": <Pill size={14} className="text-rose-500" />,
  Manufacturer: <Factory size={14} className="text-emerald-500" />,
  Distributor: <Truck size={14} className="text-sky-500" />,
  Wholesaler: <Store size={14} className="text-violet-500" />,
  Pharmacy: <Pill size={14} className="text-rose-500" />,
};

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    walletAddress: "",
    role: "Manufacturer" as "Manufacturer" | "Distributor" | "Wholesaler" | "Pharmacy",
    email: "",
    password: "",
    location: "",
  });
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await participantApi.list({ search: search.trim() || undefined });
      if (res.data?.success && res.data.data?.items) {
        setParticipants(res.data.data.items);
      } else {
        setParticipants([]);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load participants"));
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = async (p: Participant) => {
    setTogglingId(p._id);
    try {
      await participantApi.setStatus(p._id, !p.active);
      toast.success(`${p.name} ${!p.active ? "enabled" : "disabled"}`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update status"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setAdding(true);
    try {
      const res = await participantApi.add({
        name: addForm.name.trim(),
        walletAddress: addForm.walletAddress.trim(),
        role: addForm.role,
        email: addForm.email.trim(),
        password: addForm.password,
        location: addForm.location.trim() || undefined,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.error?.message || "Failed to add participant");
      }

      toast.success("Participant registered on-chain and login created!");
      setShowAddForm(false);
      setAddForm({
        name: "",
        walletAddress: "",
        role: "Manufacturer",
        email: "",
        password: "",
        location: "",
      });
      load();
    } catch (e: unknown) {
      setFormError(getErrorMessage(e, "Failed to add participant"));
    } finally {
      setAdding(false);
    }
  };

  const filtered = search
    ? participants.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.walletAddress.toLowerCase().includes(search.toLowerCase())
      )
    : participants;

  return (
    <div className="space-y-5 max-w-screen-xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Participants</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Registered organizations in the pharmaceutical network
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn btn-secondary p-2.5" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => setShowAddForm(true)} className="btn btn-primary text-sm">
            <Plus size={16} />
            Add Participant
          </button>
        </div>
      </div>

      {/* Add Participant Modal */}
      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-6 w-full max-w-lg shadow-2xl relative"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--bg-border)]">
                <h2 className="font-display font-bold text-lg">Add Network Participant</h2>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="btn btn-ghost p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs border border-rose-200 dark:border-rose-800">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <div>{formError}</div>
                </div>
              )}

              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label htmlFor="part-name">Organization Name *</label>
                  <input
                    id="part-name"
                    className="input"
                    placeholder="e.g. Apex Pharma Logistics"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="part-role">Supply Chain Role *</label>
                    <select
                      id="part-role"
                      className="input"
                      value={addForm.role}
                      onChange={(e) =>
                        setAddForm({
                          ...addForm,
                          role: e.target.value as any,
                        })
                      }
                      required
                    >
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Wholesaler">Wholesaler</option>
                      <option value="Pharmacy">Pharmacy</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="part-location">Location / City</label>
                    <input
                      id="part-location"
                      className="input"
                      placeholder="e.g. Chennai"
                      value={addForm.location}
                      onChange={(e) => setAddForm({ ...addForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="part-wallet">Ethereum Wallet Address *</label>
                  <input
                    id="part-wallet"
                    className="input font-mono text-xs"
                    placeholder="0x..."
                    value={addForm.walletAddress}
                    onChange={(e) => setAddForm({ ...addForm, walletAddress: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="part-email">Login Email *</label>
                    <input
                      id="part-email"
                      type="email"
                      className="input"
                      placeholder="partner@example.com"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="part-password">Initial Password *</label>
                    <input
                      id="part-password"
                      type="password"
                      className="input"
                      placeholder="Min 8 chars, 1 digit, 1 sym"
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--bg-border)]">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="btn btn-ghost text-sm"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={adding} className="btn btn-primary text-sm gap-2">
                    {adding ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Registering on Chain…
                      </>
                    ) : (
                      "Register Participant"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Search Bar */}
      <div className="card p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            className="input pl-9 py-2 text-sm"
            placeholder="Search participants by name, wallet, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-4">
              <SkeletonTable rows={5} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Users size={40} className="mx-auto text-[var(--text-tertiary)] mb-3" />
              <p className="font-display font-semibold text-[var(--text-secondary)]">No participants found</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Role</th>
                  <th>Wallet Address</th>
                  <th>Location</th>
                  <th>Login Email</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="font-semibold text-sm">{p.name}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {roleIcons[String(p.role)] ?? roleIcons["1"]}
                        <span className="text-xs">{String(p.role)}</span>
                      </div>
                    </td>
                    <td>
                      <HashChip value={p.walletAddress} />
                    </td>
                    <td className="text-xs text-[var(--text-secondary)]">{p.location || "—"}</td>
                    <td className="text-xs text-[var(--text-tertiary)] font-mono">{p.user?.email || "—"}</td>
                    <td>
                      <span
                        className={`pill text-xs ${
                          p.active ? "pill-genuine" : "pill-expired"
                        }`}
                      >
                        {p.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => toggleStatus(p)}
                          disabled={togglingId === p._id}
                          className={`btn text-xs py-1 px-2.5 ${
                            p.active
                              ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
                              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          {togglingId === p._id ? "..." : p.active ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
