import { cn } from '@/shared/utils/utils'; // Necesitarás esta función de utilidad (ver más abajo)

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-elevated dark:bg-elevated',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
