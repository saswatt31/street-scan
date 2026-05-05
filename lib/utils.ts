import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';

/**
 * Utility for merging Tailwind classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Color mapping for severities
 */
export function severityColor(severity: string) {
  const colors: Record<string, string> = {
    low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    critical: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  return colors[severity] || colors.medium;
}

export function severityDot(severity: string) {
  const colors: Record<string, string> = {
    low: 'bg-emerald-500',
    medium: 'bg-amber-500',
    high: 'bg-orange-500',
    critical: 'bg-rose-500',
  };
  return colors[severity] || colors.medium;
}

/**
 * Color mapping for ticket statuses
 */
export function statusColor(status: string) {
  const colors: Record<string, string> = {
    open: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    verified: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    assigned: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    in_progress: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    resolved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    rejected: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  };
  return colors[status] || colors.open;
}

/**
 * Human readable damage labels
 */
export function damageLabel(type: string) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Icons for sources
 */
export function sourceIcon(source: string) {
  // Returns Lucide icon names as strings if needed, 
  // but usually used to decide which component to render
  return source === 'iot' ? 'Cpu' : 'User';
}

/**
 * Date formatting
 */
export function formatRelative(date: string | Date) {
  if (!date) return 'N/A';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: string | Date, pattern: string = 'PPP') {
  if (!date) return 'N/A';
  return format(new Date(date), pattern);
}
