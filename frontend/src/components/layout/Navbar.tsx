"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  Sun, Moon, Search, Bell, ChevronDown,
  LogOut, Settings, User as UserIcon, Shield
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 glass border-b transition-all duration-300",
        scrolled ? "border-[var(--bg-border)]" : "border-transparent"
      )}
      style={{ height: "64px" }}
    >
      <nav className="flex items-center h-full px-4 gap-3 max-w-screen-2xl mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mr-4 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] flex items-center justify-center shadow-lg">
            <Shield size={16} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-[var(--text-primary)] text-base hidden sm:block">
            PharmaChain
          </span>
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Search hint */}
          <button
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-tertiary)] bg-[var(--bg-lifted)] border border-[var(--bg-border)] hover:border-[var(--brand-to)]/30 transition-all"
            aria-label="Open search"
          >
            <Search size={14} />
            <span>Search…</span>
            <kbd className="text-[10px] font-mono bg-[var(--bg-border)] px-1.5 py-0.5 rounded ml-1">
              ⌘K
            </kbd>
          </button>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="btn btn-ghost p-2 rounded-lg"
              aria-label="Toggle theme"
            >
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </motion.div>
            </button>
          )}

          {/* Notifications */}
          {user && (
            <button className="btn btn-ghost p-2 rounded-lg relative" aria-label="Notifications">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--brand-to)]" />
            </button>
          )}

          {/* User menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--brand-from)] to-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)] hidden sm:block max-w-[100px] truncate">
                  {user.name}
                </span>
                <ChevronDown size={14} className={cn("text-[var(--text-secondary)] transition-transform", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-48 card z-20 overflow-hidden py-1"
                  >
                    <div className="px-3 py-2 border-b border-[var(--bg-border)] mb-1">
                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{user.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)] truncate capitalize">{user.role}</p>
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserIcon size={14} /> Dashboard
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings size={14} /> Settings
                    </Link>
                    <div className="border-t border-[var(--bg-border)] mt-1 pt-1">
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      >
                        <LogOut size={14} /> Sign out
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          ) : (
            <Link href="/login" className="btn btn-primary text-sm px-4 py-2">
              Partner Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
