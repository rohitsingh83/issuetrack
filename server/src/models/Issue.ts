import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  PRIORITY_WEIGHT,
} from '../constants/domain';
import type { IssuePriority, IssueStatus, IssueType } from '../constants/domain';

export interface IAttachment {
  _id: Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

export interface IIssue {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  issueNumber: number;
  issueKey: string;
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  /** Denormalised numeric rank so priority sorting happens in MongoDB. */
  priorityRank: number;
  status: IssueStatus;
  reporter: Types.ObjectId;
  assignee: Types.ObjectId | null;
  labels: string[];
  dueDate: Date | null;
  attachments: IAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export type IssueDocument = HydratedDocument<IIssue>;

const attachmentSchema = new Schema<IAttachment>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const issueSchema = new Schema<IIssue, Model<IIssue>>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    issueNumber: { type: Number, required: true },
    issueKey: { type: String, required: true, uppercase: true, trim: true },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title must be at most 200 characters'],
    },
    description: { type: String, default: '', trim: true, maxlength: 20000 },
    type: { type: String, enum: ISSUE_TYPES, default: 'bug', index: true },
    priority: { type: String, enum: ISSUE_PRIORITIES, default: 'medium', index: true },
    priorityRank: { type: Number, default: 2, index: true },
    status: { type: String, enum: ISSUE_STATUSES, default: 'todo', index: true },
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    labels: { type: [String], default: [], index: true },
    dueDate: { type: Date, default: null },
    attachments: { type: [attachmentSchema], default: [] },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        Reflect.deleteProperty(ret, '__v');
        return ret;
      },
    },
  },
);

issueSchema.index({ project: 1, issueNumber: 1 }, { unique: true });
issueSchema.index({ issueKey: 1 }, { unique: true });
issueSchema.index({ project: 1, status: 1, updatedAt: -1 });
issueSchema.index({ project: 1, priorityRank: -1 });

/** Keep the denormalised priority rank in sync on every write path. */
issueSchema.pre('save', function keepPriorityRank(next) {
  if (this.isModified('priority') || this.isNew) {
    this.priorityRank = PRIORITY_WEIGHT[this.priority] ?? 2;
  }
  next();
});

issueSchema.pre('findOneAndUpdate', function keepPriorityRankOnUpdate(next) {
  const update = this.getUpdate() as Record<string, unknown> | null;
  const priority = update?.priority;
  if (typeof priority === 'string' && priority in PRIORITY_WEIGHT) {
    this.set({ priorityRank: PRIORITY_WEIGHT[priority as IssuePriority] });
  }
  next();
});
issueSchema.index({ project: 1, assignee: 1 });
issueSchema.index({ title: 'text', description: 'text', labels: 'text' });

export const Issue = model<IIssue, Model<IIssue>>('Issue', issueSchema);
