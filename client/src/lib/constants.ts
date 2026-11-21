import {
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  Bookmark,
  CheckCircle2,
  Circle,
  CircleDot,
  Equal,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import type { IssuePriority, IssueStatus, IssueType } from '@/types';

export interface StatusMeta {
  value: IssueStatus;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  /** Column accent (top border) + badge classes. Colour is never the only signal — every badge has an icon and a label. */
  accent: string;
  badge: string;
  dot: string;
}

export const STATUS_META: Record<IssueStatus, StatusMeta> = {
  todo: {
    value: 'todo',
    label: 'To Do',
    shortLabel: 'To Do',
    description: 'Not started yet',
    icon: Circle,
    accent: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400',
  },
  'in-progress': {
    value: 'in-progress',
    label: 'In Progress',
    shortLabel: 'In Progress',
    description: 'Actively being worked on',
    icon: Loader2,
    accent: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
  },
  done: {
    value: 'done',
    label: 'Done',
    shortLabel: 'Done',
    description: 'Completed',
    icon: CheckCircle2,
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export const STATUS_ORDER: IssueStatus[] = ['todo', 'in-progress', 'done'];

export interface PriorityMeta {
  value: IssuePriority;
  label: string;
  icon: LucideIcon;
  badge: string;
  dot: string;
  weight: number;
}

export const PRIORITY_META: Record<IssuePriority, PriorityMeta> = {
  low: {
    value: 'low',
    label: 'Low',
    icon: ArrowDown,
    badge: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400',
    weight: 1,
  },
  medium: {
    value: 'medium',
    label: 'Medium',
    icon: Equal,
    badge: 'bg-sky-50 text-sky-800 ring-sky-200',
    dot: 'bg-sky-500',
    weight: 2,
  },
  high: {
    value: 'high',
    label: 'High',
    icon: ArrowUp,
    badge: 'bg-orange-50 text-orange-800 ring-orange-200',
    dot: 'bg-orange-500',
    weight: 3,
  },
  critical: {
    value: 'critical',
    label: 'Critical',
    icon: AlertOctagon,
    badge: 'bg-rose-50 text-rose-800 ring-rose-200',
    dot: 'bg-rose-600',
    weight: 4,
  },
};

export const PRIORITY_ORDER: IssuePriority[] = ['critical', 'high', 'medium', 'low'];

export interface IssueTypeMeta {
  value: IssueType;
  label: string;
  icon: LucideIcon;
  className: string;
}

export const ISSUE_TYPE_META: Record<IssueType, IssueTypeMeta> = {
  bug: {
    value: 'bug',
    label: 'Bug',
    icon: CircleDot,
    className: 'text-rose-700 bg-rose-50 ring-rose-200',
  },
  task: {
    value: 'task',
    label: 'Task',
    icon: Bookmark,
    className: 'text-sky-700 bg-sky-50 ring-sky-200',
  },
  story: {
    value: 'story',
    label: 'Story',
    icon: CheckCircle2,
    className: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  },
};

export const ISSUE_TYPE_ORDER: IssueType[] = ['bug', 'task', 'story'];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'recentlyUpdated', label: 'Recently updated' },
] as const;

export const LABEL_SUGGESTIONS = [
  'bug',
  'regression',
  'ui',
  'performance',
  'security',
  'auth',
  'mobile',
  'api',
  'docs',
  'tech-debt',
];
