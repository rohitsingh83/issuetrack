export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';
export type IssueType = 'bug' | 'task' | 'story';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'todo' | 'in-progress' | 'done';
export type IssueSort = 'newest' | 'oldest' | 'priority' | 'dueDate' | 'recentlyUpdated';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface Member extends User {
  role: ProjectRole;
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description: string;
  owner: User | null;
  members: Member[];
  memberCount: number;
  role?: ProjectRole;
  issueCount?: number;
  doneCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: User | null;
  createdAt: string;
}

export interface Issue {
  id: string;
  projectId: string;
  projectKey?: string;
  issueNumber: number;
  issueKey: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  reporter: User | null;
  assignee: User | null;
  labels: string[];
  dueDate: string | null;
  attachments: Attachment[];
  commentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  issueId: string;
  content: string;
  author: User | null;
  edited: boolean;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  message: string;
  field: string | null;
  from: string | null;
  to: string | null;
  actor: User | null;
  issueId: string | null;
  createdAt: string;
  projectId?: string | null;
  projectName?: string | null;
  projectKey?: string | null;
  issueKey?: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export interface DashboardStats {
  projectCount: number;
  totalIssues: number;
  openIssues: number;
  doneIssues: number;
  assignedToMe: number;
  reportedByMe: number;
  overdue: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

export interface Dashboard {
  projects: Project[];
  stats: DashboardStats;
  myIssues: Issue[];
  recentActivity: ActivityItem[];
}

export interface ProjectStats {
  total: number;
  unassigned: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byType: Record<string, number>;
}

export interface IssueFilters {
  search?: string;
  status?: IssueStatus[];
  priority?: IssuePriority[];
  type?: IssueType[];
  assignee?: string;
  reporter?: string;
  label?: string[];
  project?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sort?: IssueSort;
  page?: number;
  limit?: number;
}

export interface IssuePayload {
  title: string;
  description?: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  assignee?: string | null;
  labels: string[];
  dueDate?: string | null;
}

export interface ProjectPermissions {
  role?: ProjectRole;
  canManageMembers: boolean;
  canEditProject: boolean;
  canDeleteProject: boolean;
  canCreateIssue: boolean;
  canComment: boolean;
}
