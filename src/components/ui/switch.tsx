import * as React from 'react';
import { cn } from '@/shared/utils/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, onCheckedChange, checked, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label className="flex items-center space-x-2 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            ref={ref}
            checked={checked}
            onChange={handleChange}
            {...props}
          />
          <div
            className={cn(
              'w-11 h-6 rounded-full transition-colors duration-200',
              'bg-line peer-checked:bg-brand',
              'peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand/30',
              'after:content-[""] after:absolute after:top-[2px] after:left-[2px]',
              'after:bg-white after:rounded-full after:h-5 after:w-5',
              'after:shadow-sm after:transition-all after:duration-200',
              'peer-checked:after:translate-x-full',
              className,
            )}
          />
        </div>
        {label && <span className="text-sm font-medium text-dim">{label}</span>}
      </label>
    );
  },
);
Switch.displayName = 'Switch';

export { Switch };
