import React from 'react';
import { PlusIcon, InboxIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// --- Composants de base (précédemment dans empty.tsx) ---

const Empty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center animate-in fade-in-50',
      className
    )}
    {...props}
  />
));
Empty.displayName = 'Empty';

const EmptyHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('mx-auto flex max-w-[420px] flex-col items-center justify-center text-center', className)}
    {...props}
  />
));
EmptyHeader.displayName = 'EmptyHeader';

const EmptyMedia = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'icon' | 'image' }
>(({ className, variant = 'icon', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative mb-4 flex size-20 items-center justify-center rounded-full bg-muted',
      variant === 'icon' && 'text-muted-foreground',
      className
    )}
    {...props}
  />
));
EmptyMedia.displayName = 'EmptyMedia';

const EmptyTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('mt-6 text-xl font-semibold', className)}
    {...props}
  />
));
EmptyTitle.displayName = 'EmptyTitle';

const EmptyDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('mt-2 text-center text-sm font-normal leading-6 text-muted-foreground', className)}
    {...props}
  />
));
EmptyDescription.displayName = 'EmptyDescription';

const EmptyContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mt-6 flex flex-col gap-2', className)} {...props} />
));
EmptyContent.displayName = 'EmptyContent';

// --- Composant EmptyState principal ---

interface EmptyStateProps {
  className?: string;
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  showAction?: boolean;
}

export function EmptyState({ 
  className,
  icon,
  title,
  description,
  actionLabel = 'Créer',
  onAction,
  showAction = true
}: EmptyStateProps) {
  return (
    <Empty className={cn('min-h-[400px]', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {icon || <InboxIcon className="size-6" />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && (
          <EmptyDescription>{description}</EmptyDescription>
        )}
      </EmptyHeader>
      {showAction && onAction && (
        <EmptyContent>
          <Button onClick={onAction} className="gap-2">
            <PlusIcon className="size-4" />
            {actionLabel}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
