import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-espresso mb-1.5 block text-sm font-medium', className)} {...props} />
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'bg-foam text-espresso placeholder:text-latte focus:ring-espresso/40 h-11 w-full rounded-lg border px-3 text-base focus:ring-2 focus:outline-none',
        invalid ? 'border-red-500' : 'border-latte/50',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-700">
      {children}
    </p>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | string[];
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !message ? <p className="text-latte mt-1 text-xs">{hint}</p> : null}
      <FieldError id={`${htmlFor}-error`}>{message}</FieldError>
    </div>
  );
}
