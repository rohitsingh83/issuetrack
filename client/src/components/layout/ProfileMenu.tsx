import { Link } from 'react-router-dom';
import { LogOut, User as UserIcon, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Menu } from '@/components/ui/Menu';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function ProfileMenu() {
  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Menu
      label="Account menu"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="md" />
          <span className="sr-only">Open account menu for {user.name}</span>
        </button>
      )}
      items={[
        {
          label: 'Profile settings',
          icon: <UserIcon className="h-4 w-4" aria-hidden="true" />,
          onSelect: () => navigate('/profile'),
        },
        {
          label: 'My projects',
          icon: <Settings className="h-4 w-4" aria-hidden="true" />,
          onSelect: () => navigate('/projects'),
        },
        {
          label: isLoggingOut ? 'Signing out…' : 'Sign out',
          icon: <LogOut className="h-4 w-4" aria-hidden="true" />,
          destructive: true,
          disabled: isLoggingOut,
          onSelect: () => {
            void logout().then(() => navigate('/login', { replace: true }));
          },
        },
      ]}
    />
  );
}

export function ProfileSummary() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <Link
      to="/profile"
      className="flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-white">{user.name}</span>
        <span className="block truncate text-[11px] text-white/70">{user.email}</span>
      </span>
    </Link>
  );
}
