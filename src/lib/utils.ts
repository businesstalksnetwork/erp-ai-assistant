import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtNum = (n: number) =>
  n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Compact number format for mobile: 1.234.567 → "1,23M" */
export const fmtNumCompact = (n: number): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(n / 1_000_000_000).toLocaleString("sr-RS", { maximumFractionDigits: 1 })}B`;
  if (abs >= 1_000_000) return `${sign}${(n / 1_000_000).toLocaleString("sr-RS", { maximumFractionDigits: 1 })}M`;
  if (abs >= 10_000) return `${sign}${(n / 1_000).toLocaleString("sr-RS", { maximumFractionDigits: 0 })}K`;
  return fmtNum(n);
};

/** Auto-compact: uses full format for small numbers, compact for 10M+ */
export const fmtNumAuto = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return fmtNumCompact(n);
  return fmtNum(n);
};
