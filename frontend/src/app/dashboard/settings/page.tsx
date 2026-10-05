"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { 
  Settings, User as UserIcon, Bell, Shield, 
  Moon, Sun, Laptop, Save, Loader2 
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { HashChip } from "@/components/ui/HashChip";
import { roleName } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Mock save
    setTimeout(() => {
      setLoading(false);
      toast.success("Settings saved successfully.");
    }, 800);
  };

  return (
    <div className="max-w-screen-md space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-0.5">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation / Tabs (Static for now) */}
        <div className="md:col-span-1 space-y-1">
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--bg-lifted)] text-[var(--brand-from)]">
            <UserIcon size={16} /> Profile
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            <Bell size={16} /> Notifications
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            <Shield size={16} /> Security
          </button>
        </div>

        {/* Content */}
        <div className="md:col-span-3 space-y-6">
          
          {/* Identity info */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
            <h2 className="text-sm font-display font-semibold mb-4 border-b border-[var(--bg-border)] pb-2">
              Blockchain Identity
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-tertiary)] block mb-1">Role</label>
                <div className="font-medium inline-block px-2.5 py-1 rounded bg-[var(--bg-lifted)] text-sm">
                  {user ? roleName(user.role === "admin" ? 0 : 1) : "Unknown"} ({user?.role})
                </div>
              </div>
              {user?.participantId && (
                <div>
                  <label className="text-xs text-[var(--text-tertiary)] block mb-1">Wallet Address</label>
                  <HashChip value={user.participantId} truncate={false} />
                </div>
              )}
            </div>
          </motion.div>

          {/* Profile Form */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-6">
            <h2 className="text-sm font-display font-semibold mb-4 border-b border-[var(--bg-border)] pb-2">
              Personal Information
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name">Full Name</label>
                  <input
                    id="name"
                    className="input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    className="input bg-[var(--bg-lifted)] cursor-not-allowed"
                    value={profile.email}
                    disabled
                  />
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-1">Email cannot be changed.</p>
                </div>
              </div>
              
              <div className="pt-2">
                <button type="submit" disabled={loading} className="btn btn-primary text-sm">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Save size={15} /> Save Changes</>}
                </button>
              </div>
            </form>
          </motion.div>

          {/* Appearance */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card p-6">
            <h2 className="text-sm font-display font-semibold mb-4 border-b border-[var(--bg-border)] pb-2">
              Appearance
            </h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setTheme("light")}
                className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'border-[var(--brand-to)] bg-[var(--bg-lifted)]' : 'border-[var(--bg-border)] hover:border-[var(--text-tertiary)]'}`}
              >
                <Sun size={20} className={theme === 'light' ? 'text-[var(--brand-to)]' : 'text-[var(--text-secondary)]'} />
                <span className="text-sm font-medium">Light</span>
              </button>
              <button 
                onClick={() => setTheme("dark")}
                className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'border-[var(--brand-to)] bg-[var(--bg-lifted)]' : 'border-[var(--bg-border)] hover:border-[var(--text-tertiary)]'}`}
              >
                <Moon size={20} className={theme === 'dark' ? 'text-[var(--brand-to)]' : 'text-[var(--text-secondary)]'} />
                <span className="text-sm font-medium">Dark</span>
              </button>
              <button 
                onClick={() => setTheme("system")}
                className={`flex-1 p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme === 'system' ? 'border-[var(--brand-to)] bg-[var(--bg-lifted)]' : 'border-[var(--bg-border)] hover:border-[var(--text-tertiary)]'}`}
              >
                <Laptop size={20} className={theme === 'system' ? 'text-[var(--brand-to)]' : 'text-[var(--text-secondary)]'} />
                <span className="text-sm font-medium">System</span>
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
