import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProjectRole } from '@/types';

/** Tailwind-aware class name merge. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

// 700-level shades keep white initials at >= 4.5:1 contrast (WCAG AA).
const AVATAR_PALETTE = [
  'bg-indigo-700',
  'bg-emerald-700',
  'bg-amber-700',
  'bg-rose-700',
  'bg-sky-700',
  'bg-violet-700',
  'bg-teal-700',
  'bg-orange-700',
];

/** Deterministic avatar colour so a user keeps the same colour everywhere. */
export function avatarColor(seed?: string | null): string {
  if (!seed) return 'bg-slate-600';
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return 'just now';
  if (abs < hour) {
    const mins = Math.round(abs / minute);
    return diff > 0 ? `${mins}m ago` : `in ${mins}m`;
  }
  if (abs < day) {
    const hours = Math.round(abs / hour);
    return diff > 0 ? `${hours}h ago` : `in ${hours}h`;
  }
  if (abs < 30 * day) {
    const days = Math.round(abs / day);
    return diff > 0 ? `${days}d ago` : `in ${days}d`;
  }
  return formatDate(value);
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function isOverdue(value?: string | null, status?: string): boolean {
  if (!value || status === 'done') return false;
  return new Date(value).getTime() < Date.now();
}

export function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export const ROLE_LABEL: Record<ProjectRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export function canManageProject(role?: ProjectRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Absolute API URL for a server-relative asset path (attachments). */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
  if (!base) return path;
  return `${base}${path}`;
}

/** Mirrors the server policy so the UI hides actions the API would reject. */
export function canEditIssue(
  role: ProjectRole | undefined,
  issue: { reporter?: { id: string } | null; assignee?: { id: string } | null },
  userId?: string,
): boolean {
  if (!role || !userId) return false;
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  return issue.reporter?.id === userId || issue.assignee?.id === userId;
}

export function canDeleteIssue(
  role: ProjectRole | undefined,
  issue: { reporter?: { id: string } | null },
  userId?: string,
): boolean {
  if (!role || !userId) return false;
  if (role === 'owner' || role === 'admin') return true;
  if (role !== 'member') return false;
  return issue.reporter?.id === userId;
}
