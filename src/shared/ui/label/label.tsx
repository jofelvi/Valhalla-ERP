import * as React from 'react';
import { cn } from '@/shared/utils/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-sm font-semibold text-dim mb-2', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

export { Label };
