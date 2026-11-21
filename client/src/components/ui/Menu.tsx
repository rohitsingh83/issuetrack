import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
}

export interface MenuProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
  label?: string;
  className?: string;
}

/** Lightweight accessible menu button: click to open, Escape/outside click to close, arrow keys to move. */
export function Menu({
  trigger,
  items,
  align = 'right',
  label = 'Open menu',
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => {
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          const next = (current + delta + items.length) % items.length;
          itemRefs.current[next]?.focus();
          return next;
        });
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, items.length]);

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-30 mt-1 min-w-[200px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-pop animate-slide-up',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role="menuitem"
              type="button"
              tabIndex={activeIndex === index || activeIndex === -1 ? 0 : -1}
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                item.destructive
                  ? 'text-rose-600 hover:bg-rose-50 disabled:text-rose-300'
                  : 'text-slate-700 hover:bg-slate-100 disabled:text-slate-500',
              )}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="text-xs text-slate-600">{item.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
