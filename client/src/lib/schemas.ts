import { z } from 'zod';

const passwordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name is too long'),
    email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
    password: passwordRules,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const issueFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),
  description: z.string().max(20000, 'Description is too long').optional().default(''),
  type: z.enum(['bug', 'task', 'story']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['todo', 'in-progress', 'done']),
  assignee: z.string().optional().default(''),
  dueDate: z.string().optional().default(''),
  labels: z.array(z.string().min(1).max(30)).max(10, 'Maximum of 10 labels').default([]),
});
export type IssueFormValues = z.input<typeof issueFormSchema>;

export const projectFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  key: z
    .string()
    .trim()
    .min(2, 'Key must be 2-10 characters')
    .max(10, 'Key must be 2-10 characters')
    .regex(/^[A-Za-z][A-Za-z0-9]{1,9}$/, 'Use 2-10 letters/numbers, starting with a letter'),
  description: z.string().max(2000, 'Description is too long').optional().default(''),
});
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const profileFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  avatarUrl: z.string().trim().url('Must be a valid URL').max(500).optional().or(z.literal('')),
});
export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordRules,
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type PasswordFormValues = z.infer<typeof passwordFormSchema>;

export const memberFormSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
});
export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const commentFormSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment must be at most 5000 characters'),
});
export type CommentFormValues = z.infer<typeof commentFormSchema>;
