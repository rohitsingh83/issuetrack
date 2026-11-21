import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { PROJECT_ROLES, type ProjectRole } from '../constants/domain';

export interface IProjectMember {
  user: Types.ObjectId;
  role: ProjectRole;
  addedAt: Date;
}

export interface IProject {
  _id: Types.ObjectId;
  name: string;
  key: string;
  description: string;
  owner: Types.ObjectId;
  members: IProjectMember[];
  /** Monotonic per-project issue counter used to generate issueNumber/issueKey atomically. */
  issueCounter: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectDocument = HydratedDocument<IProject>;

const memberSchema = new Schema<IProjectMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: PROJECT_ROLES, required: true, default: 'member' },
    addedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const projectSchema = new Schema<IProject, Model<IProject>>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [80, 'Project name must be at most 80 characters'],
    },
    key: {
      type: String,
      required: [true, 'Project key is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [2, 'Project key must be 2-10 characters'],
      maxlength: [10, 'Project key must be 2-10 characters'],
      match: [
        /^[A-Z][A-Z0-9]{1,9}$/,
        'Project key must start with a letter and contain only A-Z, 0-9',
      ],
    },
    description: { type: String, default: '', trim: true, maxlength: 2000 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [memberSchema], default: [] },
    issueCounter: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectSchema.index({ 'members.user': 1 });
projectSchema.index({ name: 'text', description: 'text' });

projectSchema.virtual('memberCount').get(function memberCount(this: IProject) {
  return this.members.length;
});

projectSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    Reflect.deleteProperty(ret, '__v');
    Reflect.deleteProperty(ret, 'issueCounter');
    return ret;
  },
});

export const Project = model<IProject, Model<IProject>>('Project', projectSchema);
