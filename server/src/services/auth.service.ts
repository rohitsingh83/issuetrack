import { User, type UserDocument } from '../models/User';
import { serializeUser, type PublicUserDto } from '../serializers';
import { ApiError } from '../utils/ApiError';
import { signAuthToken } from '../utils/jwt';

export interface AuthResult {
  user: PublicUserDto;
  token: string;
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
}): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with that email already exists');

  const passwordHash = await User.hashPassword(input.password);
  const user = await User.create({
    name: input.name.trim(),
    email,
    passwordHash,
    avatarUrl: input.avatarUrl?.trim() || null,
  });

  const token = signAuthToken({ sub: String(user._id), email: user.email, name: user.name });
  return { user: serializeUser(user), token };
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select('+passwordHash');
  // Constant-ish response: never reveal whether the email exists.
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await user.comparePassword(input.password);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  const token = signAuthToken({ sub: String(user._id), email: user.email, name: user.name });
  return { user: serializeUser(user), token };
}

export async function getCurrentUser(userId: string): Promise<PublicUserDto> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  return serializeUser(user);
}

export async function updateProfile(
  user: UserDocument,
  input: {
    name?: string;
    avatarUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
  },
): Promise<PublicUserDto> {
  if (input.name !== undefined) user.name = input.name.trim();
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl?.trim() || null;

  if (input.newPassword) {
    const withHash = await User.findById(user._id).select('+passwordHash');
    if (!withHash) throw ApiError.notFound('User not found');
    const ok = await withHash.comparePassword(input.currentPassword ?? '');
    if (!ok)
      throw ApiError.badRequest('Current password is incorrect', {
        currentPassword: ['Current password is incorrect'],
      });
    user.passwordHash = await User.hashPassword(input.newPassword);
  }

  await user.save();
  return serializeUser(user);
}

export async function lookupUserByEmail(email: string): Promise<PublicUserDto | null> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  return user ? serializeUser(user) : null;
}

export async function searchUsers(query: string, limit = 10): Promise<PublicUserDto[]> {
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({
    $or: [{ email: new RegExp(safe, 'i') }, { name: new RegExp(safe, 'i') }],
  })
    .limit(limit)
    .sort({ name: 1 });
  return users.map(serializeUser);
}
