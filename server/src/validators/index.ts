import { z } from 'zod';
import { ISSUE_PRIORITIES, ISSUE_STATUSES, ISSUE_TYPES, PROJECT_ROLES } from '../constants/domain';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid identifier');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  avatarUrl: z
    .string()
    .trim()
    .url('Avatar must be a valid URL')
    .max(500)
    .optional()
    .or(z.literal('')),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
    avatarUrl: z.string().trim().url('Avatar must be a valid URL').max(500).nullish(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72)
      .regex(/[A-Za-z]/, 'Password must contain a letter')
      .regex(/[0-9]/, 'Password must contain a number')
      .optional(),
  })
  .refine((data) => !data.newPassword || Boolean(data.currentPassword), {
    message: 'Current password is required to set a new password',
    path: ['currentPassword'],
  });

export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9]{1,9}$/,
    'Key must be 2-10 characters: letters/numbers, starting with a letter',
  );

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  key: projectKeySchema,
  description: z.string().trim().max(2000).optional().default(''),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter the email of a registered user'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(PROJECT_ROLES),
});

export const issueBaseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(20000).optional().default(''),
  type: z.enum(ISSUE_TYPES).default('bug'),
  priority: z.enum(ISSUE_PRIORITIES).default('medium'),
  status: z.enum(ISSUE_STATUSES).default('todo'),
  assignee: objectIdSchema.nullish(),
  labels: z.array(z.string().trim().min(1).max(30)).max(10, 'Maximum of 10 labels').default([]),
  dueDate: z
    .union([z.string().datetime({ offset: true }), z.string().date(), z.null(), z.literal('')])
    .optional(),
});

export const createIssueSchema = issueBaseSchema;

export const updateIssueSchema = issueBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const updateStatusSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

const sortValues = ['newest', 'oldest', 'priority', 'dueDate', 'recentlyUpdated'] as const;

export const issueQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.union([z.enum(ISSUE_STATUSES), z.array(z.enum(ISSUE_STATUSES))]).optional(),
  priority: z.union([z.enum(ISSUE_PRIORITIES), z.array(z.enum(ISSUE_PRIORITIES))]).optional(),
  type: z.union([z.enum(ISSUE_TYPES), z.array(z.enum(ISSUE_TYPES))]).optional(),
  assignee: z.string().trim().max(50).optional(),
  reporter: z.string().trim().max(50).optional(),
  label: z.union([z.string().trim().max(30), z.array(z.string().trim().max(30))]).optional(),
  project: objectIdSchema.optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  sort: z.enum(sortValues).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type IssueQueryInput = z.infer<typeof issueQuerySchema>;

export const commentCreateSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'Comment is too long'),
});

export const commentUpdateSchema = commentCreateSchema;

export const objectIdParamSchema = z.object({ projectId: objectIdSchema });
export const issueParamSchema = z.object({ issueId: objectIdSchema });
export const issueCommentParamSchema = z.object({
  issueId: objectIdSchema,
  commentId: objectIdSchema,
});
export const issueAttachmentParamSchema = z.object({
  issueId: objectIdSchema,
  attachmentId: objectIdSchema,
});
