import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusBadgeClass(status: string): string {
  const variants: Record<string, string> = {
    NEW: "bg-zinc-800 text-zinc-100",
    CONTACTED: "bg-blue-900/70 text-blue-200",
    QUALIFYING: "bg-amber-900/70 text-amber-200",
    QUALIFIED: "bg-indigo-900/70 text-indigo-200",
    VIEWING_BOOKED: "bg-emerald-900/70 text-emerald-200",
    CONVERTED: "bg-green-900/70 text-green-200",
    ARCHIVED: "bg-zinc-800 text-zinc-500",
  };
  return variants[status] || variants.NEW;
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
