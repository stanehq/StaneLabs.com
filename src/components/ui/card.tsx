import * as React from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: React.ComponentProps<'div'>) { return <div data-slot="card" className={cn('border border-border bg-background p-6 text-foreground', className)} {...props} />; }
export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) { return <h3 data-slot="card-title" className={cn('font-heading font-medium', className)} {...props} />; }
export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) { return <p data-slot="card-description" className={cn('font-sans text-muted', className)} {...props} />; }
