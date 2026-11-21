import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  optional?: boolean;
}

/** Accessible label + hint + error wrapper used by every form field. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  optional,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={htmlFor} className="label-base">
        {label}
        {required && (
          <span className="ml-0.5 text-rose-600" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="ml-1 text-xs font-normal text-slate-600">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 flex items-start gap-1 text-xs font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, icon, ...props },
  ref,
) {
  if (icon) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">
          {icon}
        </span>
        <input
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn('input-base pl-9', invalid && 'input-error', className)}
          {...props}
        />
      </div>
    );
  }
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn('input-base', invalid && 'input-error', className)}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn('input-base resize-y leading-relaxed', invalid && 'input-error', className)}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'input-base select-caret cursor-pointer appearance-none',
        invalid && 'input-error',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = 'Select';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        {...props}
      />
      <div className="leading-tight">
        <label htmlFor={inputId} className="cursor-pointer text-sm font-medium text-slate-700">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-slate-600">{description}</p>}
      </div>
    </div>
  );
}
