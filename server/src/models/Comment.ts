import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IComment {
  _id: Types.ObjectId;
  issue: Types.ObjectId;
  project: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CommentDocument = HydratedDocument<IComment>;

const commentSchema = new Schema<IComment, Model<IComment>>(
  {
    issue: { type: Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    content: {
      type: String,
      required: [true, 'Comment cannot be empty'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [5000, 'Comment must be at most 5000 characters'],
    },
    editedAt: { type: Date, default: null },
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

commentSchema.index({ issue: 1, createdAt: 1 });

export const Comment = model<IComment, Model<IComment>>('Comment', commentSchema);
