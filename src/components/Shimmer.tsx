"use client";

import { cn } from "@/lib/utils";

/**
 * Cursor-style shimmering text — a light sweep travels across muted text to
 * signal an in-progress / loading state (mirrors the "Editing …" chat label).
 * Reuse anywhere a lightweight "working…" affordance is nicer than a spinner.
 */
export function ShimmerText({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  return (
    <Tag className={cn("shimmer-text font-medium", className)}>{children}</Tag>
  );
}

/** A shimmering placeholder block for content that hasn't loaded yet. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-2xl", className)} aria-hidden />;
}

/** Small inline dot+label loading row using the shimmer treatment. */
export function ShimmerRow({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7c8cff]/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#7c8cff]" />
      </span>
      <ShimmerText>{label}</ShimmerText>
    </div>
  );
}
