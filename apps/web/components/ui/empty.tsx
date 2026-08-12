import type { HTMLAttributes, ReactNode } from 'react';

type EmptyProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

const slot = (name: string, className = '') => `v2-empty-${name}${className ? ` ${className}` : ''}`;

export function Empty({ className, ...props }: EmptyProps) {
  return <div data-slot="empty" className={slot('state', className)} {...props} />;
}

export function EmptyHeader({ className, ...props }: EmptyProps) {
  return <div data-slot="empty-header" className={slot('header', className)} {...props} />;
}

export function EmptyMedia({ className, ...props }: EmptyProps) {
  return <div data-slot="empty-media" className={slot('media', className)} {...props} />;
}

export function EmptyTitle({ className, ...props }: EmptyProps) {
  return <h3 data-slot="empty-title" className={slot('title', className)} {...props} />;
}

export function EmptyDescription({ className, ...props }: EmptyProps) {
  return <p data-slot="empty-description" className={slot('description', className)} {...props} />;
}

export function EmptyContent({ className, ...props }: EmptyProps) {
  return <div data-slot="empty-content" className={slot('content', className)} {...props} />;
}
