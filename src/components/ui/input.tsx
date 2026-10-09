import * as React from 'react';
import { cn } from '@/lib/utils';
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => <input data-slot="input" type={type} className={cn('flex h-12 w-full rounded-md border border-border bg-background px-4 text-base font-sans text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50', className)} ref={ref} {...props} />);
Input.displayName = 'Input';
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => <textarea data-slot="textarea" className={cn('flex min-h-28 w-full rounded-md border border-border bg-background p-4 text-base font-sans text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary', className)} ref={ref} {...props} />);
Textarea.displayName = 'Textarea';
