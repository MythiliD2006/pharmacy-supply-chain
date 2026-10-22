"use client";

import { cn } from "@/lib/utils";

type Status =
  | "genuine" | "expired" | "invalid" | "pending" | "confirmed" | "rejected" | "cancelled"
  | "recalled" | "verified" | "inconsistent" | "unregistered";

const statusMap: Record<Status, { label: string; className: string; dot: string }> = {
  genuine:   { label: "Genuine",   className: "pill pill-genuine",  dot: "bg-emerald-500" },
  expired:   { label: "Expired",   className: "pill pill-expired",  dot: "bg-amber-500" },
  invalid:   { label: "Invalid",   className: "pill pill-invalid",  dot: "bg-rose-500" },
  pending:   { label: "Pending",   className: "pill pill-pending",  dot: "bg-sky-500" },
  confirmed: { label: "Confirmed", className: "pill pill-genuine",  dot: "bg-emerald-500" },
  rejected:  { label: "Rejected",  className: "pill pill-invalid",  dot: "bg-rose-500" },
  cancelled: { label: "Cancelled", className: "pill pill-expired",  dot: "bg-amber-500" },
  recalled:  { label: "Recalled",  className: "pill pill-invalid",  dot: "bg-rose-500" },
  // verification statuses from the backend (VERIFIED, INCONSISTENT, UNREGISTERED)
  verified:     { label: "Verified",     className: "pill pill-genuine", dot: "bg-emerald-500" },
  inconsistent: { label: "Inconsistent", className: "pill pill-invalid", dot: "bg-rose-500" },
  unregistered: { label: "Unregistered", className: "pill pill-invalid", dot: "bg-rose-500" },
};

interface StatusPillProps {
  status: Status | string;
  className?: string;
  showDot?: boolean;
}

export function StatusPill({ status, className, showDot = true }: StatusPillProps) {
  const s = status?.toLowerCase() as Status;
  const config = statusMap[s] ?? { label: status, className: "pill", dot: "bg-gray-400" };

  return (
    <span className={cn(config.className, className)}>
      {showDot && (
        <span className={cn("w-1.5 h-1.5 rounded-full inline-block", config.dot)} />
      )}
      {config.label}
    </span>
  );
}