import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/helpers';

const variants = {
  default: 'border-transparent bg-primary text-primary-foreground',
  secondary: 'border-transparent bg-secondary text-secondary-foreground',
  destructive: 'border-transparent bg-destructive text-destructive-foreground',
  outline: 'text-foreground',
};

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof variants;
}

export const Badge = ({ className, variant = 'default', ...props }: BadgeProps) => (
  <div
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
      variants[variant],
      className
    )}
    {...props}
  />
);
