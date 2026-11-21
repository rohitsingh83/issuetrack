import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { ACTIVITY_ACTIONS, type ActivityAction } from '../constants/domain';

export interface IActivity {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  issue: Types.ObjectId | null;
  actor: Types.ObjectId;
  action: ActivityAction;
  field?: string | null;
  from?: string | null;
  to?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityDocument = HydratedDocument<IActivity>;

const activitySchema = new Schema<IActivity, Model<IActivity>>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    issue: { type: Schema.Types.ObjectId, ref: 'Issue', default: null, index: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ACTIVITY_ACTIONS, required: true, index: true },
    field: { type: String, default: null },
    from: { type: String, default: null },
    to: { type: String, default: null },
    message: { type: String, required: true, maxlength: 500 },
    metadata: { type: Schema.Types.Mixed, default: {} },
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

activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ issue: 1, createdAt: -1 });
activitySchema.index({ createdAt: -1 });

export const Activity = model<IActivity, Model<IActivity>>('Activity', activitySchema);
