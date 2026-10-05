"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Package, ArrowLeftRight, Users,
  Settings, ChevronLeft, ChevronRight, Shield,
  QrCode, BarChart3
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Batches",
    href: "/dashboard/batches",
    icon: Package,
  },
  {
    label: "Transfers",
    href: "/dashboard/transfers",
    icon: ArrowLeftRight,
  },
  {
    label: "Verify",
    href: "/verify",
    icon: QrCode,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
    adminOnly: false,
  },
];

const adminItems = [
  {
    label: "Participants",
    href: "/dashboard/participants",
    icon: Users,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (item: { href: string; exact?: boolean }) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative hidden md:flex flex-col border-r border-[var(--bg-border)] bg-[var(--bg-card)] shrink-0 overflow-hidden"
      style={{ paddingTop: "64px" }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute top-[72px] right-0 translate-x-1/2 z-10 w-6 h-6 rounded-full bg-[var(--bg-card)] border border-[var(--bg-border)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shadow-sm transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className="flex flex-col gap-1 p-3 flex-1">
        {/* Main nav */}
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-item",
                  active && "active"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute right-2 w-1 h-4 rounded-full bg-[var(--brand-to)]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        {/* Admin section */}
        {user?.role === "admin" && (
          <>
            <div className="my-2 border-t border-[var(--bg-border)]" />
            {!collapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)] px-3 mb-1">
                Admin
              </p>
            )}
            <div className="space-y-0.5">
              {adminItems.map((item) => {
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn("sidebar-item", active && "active")}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {active && (
                      <motion.div
                        layoutId="sidebar-active-admin"
                        className="absolute right-2 w-1 h-4 rounded-full bg-[var(--accent)]"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer logo */}
      <div className={cn(
        "p-3 border-t border-[var(--bg-border)] flex items-center gap-2",
        collapsed && "justify-center"
      )}>
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] flex items-center justify-center shrink-0">
          <Shield size={12} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-xs text-[var(--text-tertiary)] font-medium">PharmaChain v1.0</span>
        )}
      </div>
    </motion.aside>
  );
}
