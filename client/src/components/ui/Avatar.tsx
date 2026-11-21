import { cn, avatarColor, initials } from '@/lib/utils';

export interface AvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  ring?: boolean;
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

export function Avatar({ name, email, src, size = 'md', className, ring }: AvatarProps) {
  const label = name ?? email ?? 'Unknown user';
  const seed = email ?? name ?? '';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        SIZES[size],
        !src && avatarColor(seed),
        ring && 'ring-2 ring-white',
        className,
      )}
      title={label}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">{initials(label)}</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function AvatarGroup({
  users,
  max = 4,
  size = 'sm',
}: {
  users: { name: string; email?: string; avatarUrl?: string | null }[];
  max?: number;
  size?: AvatarProps['size'];
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((user) => (
        <Avatar
          key={user.email ?? user.name}
          {...user}
          src={user.avatarUrl ?? null}
          size={size}
          ring
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-600 ring-2 ring-white',
            SIZES[size ?? 'sm'],
          )}
          aria-label={`${rest} more members`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
