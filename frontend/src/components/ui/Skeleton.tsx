"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  lines?: number;
  height?: string;
}

export function Skeleton({ className, height = "1rem" }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ height }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card p-5 space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" height="2.5rem" />
        <div className="flex-1 space-y-2">
          <Skeleton height="0.875rem" className="w-1/2" />
          <Skeleton height="0.75rem" className="w-1/3" />
        </div>
      </div>
      <Skeleton height="0.875rem" />
      <Skeleton height="0.875rem" className="w-3/4" />
      <Skeleton height="0.75rem" className="w-1/2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-[var(--bg-border)]">
          <Skeleton height="0.875rem" className="w-1/4" />
          <Skeleton height="0.875rem" className="w-1/3" />
          <Skeleton height="0.875rem" className="w-1/6" />
          <Skeleton height="1.5rem" className="w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton height="0.75rem" className="w-24" />
        <Skeleton className="w-8 h-8 rounded-lg" height="2rem" />
      </div>
      <Skeleton height="2rem" className="w-20" />
      <Skeleton height="0.75rem" className="w-28" />
    </div>
  );
}
