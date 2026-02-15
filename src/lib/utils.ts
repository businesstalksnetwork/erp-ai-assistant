import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtNum = (n: number) =>
  n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
