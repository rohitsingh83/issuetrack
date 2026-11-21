import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, UserMethods>;

interface UserModelType extends Model<IUser, unknown, UserMethods> {
  hashPassword(plain: string): Promise<string>;
}

const userSchema = new Schema<IUser, UserModelType, UserMethods>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        Reflect.deleteProperty(ret, 'passwordHash');
        Reflect.deleteProperty(ret, '__v');
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

userSchema.statics.hashPassword = function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
};

userSchema.methods.comparePassword = function comparePassword(candidate: string): Promise<boolean> {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = model<IUser, UserModelType>('User', userSchema);
export type PublicUser = Pick<IUser, 'name' | 'email' | 'avatarUrl'> & { _id: Types.ObjectId };
