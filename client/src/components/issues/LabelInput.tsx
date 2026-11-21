import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabelInputProps {
  value: string[];
  onChange: (labels: string[]) => void;
  suggestions?: string[];
  max?: number;
  disabled?: boolean;
  id?: string;
}

/** Chip-based label editor: Enter/comma adds, Backspace removes, suggestions one-click. */
export function LabelInput({
  value,
  onChange,
  suggestions = [],
  max = 10,
  disabled,
  id,
}: LabelInputProps) {
  const [draft, setDraft] = useState('');

  const addLabel = (raw: string) => {
    const label = raw.trim().slice(0, 30);
    if (!label) return;
    if (value.length >= max) return;
    if (value.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, label]);
    setDraft('');
  };

  const removeLabel = (label: string) => onChange(value.filter((item) => item !== label));

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addLabel(draft);
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeLabel(value[value.length - 1]);
    }
  };

  const unusedSuggestions = suggestions
    .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    .slice(0, 6);

  return (
    <div>
      <div
        className={cn(
          'flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 shadow-sm',
          'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30',
          disabled && 'bg-slate-50',
        )}
      >
        {value.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700"
          >
            {label}
            {!disabled && (
              <button
                type="button"
                onClick={() => removeLabel(label)}
                className="rounded text-brand-500 hover:text-brand-800"
                aria-label={`Remove label ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addLabel(draft)}
          disabled={disabled || value.length >= max}
          placeholder={value.length === 0 ? 'Add labels…' : ''}
          aria-label="Add a label"
          className="min-w-[90px] flex-1 border-0 bg-transparent p-0.5 text-sm shadow-none outline-none placeholder:text-slate-400 focus:ring-0"
        />
      </div>
      {unusedSuggestions.length > 0 && value.length < max && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="text-[11px] text-slate-600">Suggestions:</span>
          {unusedSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addLabel(suggestion)}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 transition hover:bg-slate-200"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-xs text-slate-600">
        {value.length}/{max} labels · press Enter or comma to add
      </p>
    </div>
  );
}
