'use client';
import React from 'react';
import Link from 'next/link';
import { IoArrowBackOutline } from 'react-icons/io5';

type IconVariant =
  | 'indigo'
  | 'blue'
  | 'green'
  | 'red'
  | 'gray'
  | 'purple'
  | 'black';
type IconSize = 'sm' | 'md' | 'lg' | 'xl';

interface BackIconProps {
  href: string;
  variant?: IconVariant;
  size?: IconSize;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  tooltip?: string;
  hoverEffect?: boolean;
}

const variantClasses: Record<IconVariant, string> = {
  indigo: 'text-indigo-600 hover:text-indigo-800',
  blue: 'text-blue-600 hover:text-blue-800',
  green: 'text-ok hover:text-ok',
  red: 'text-danger hover:text-danger',
  gray: 'text-dim hover:text-content',
  purple: 'text-purple-600 hover:text-purple-800',
  black: 'text-content hover:text-black',
};

const sizeClasses: Record<IconSize, { icon: string; container: string }> = {
  sm: {
    icon: 'h-5 w-5',
    container: 'p-1.5',
  },
  md: {
    icon: 'h-6 w-6',
    container: 'p-2',
  },
  lg: {
    icon: 'h-7 w-7',
    container: 'p-2.5',
  },
  xl: {
    icon: 'h-8 w-8',
    container: 'p-3',
  },
};

const BackIcon: React.FC<BackIconProps> = ({
  href,
  variant = 'gray',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  tooltip = 'Volver',
  hoverEffect = true,
}) => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];

  const hoverClasses = hoverEffect
    ? 'hover:bg-elevated hover:scale-110 active:scale-95'
    : '';

  const focusRingColor =
    variant === 'gray' ? 'focus:ring-gray-500' : `focus:ring-${variant}-500`;

  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer';

  const finalClasses =
    `${baseClasses} ${variantClass} ${sizeClass.container} ${hoverClasses} ${focusRingColor} ${disabledClasses} ${className}`.trim();

  const handleClick = () => {
    if (onClick && !disabled) {
      onClick();
    }
  };

  return (
    <div className="inline-flex">
      <Link
        href={href}
        className={finalClasses}
        onClick={handleClick}
        aria-disabled={disabled}
        title={tooltip}
        aria-label={tooltip}
      >
        <IoArrowBackOutline className={sizeClass.icon} aria-hidden="true" />
      </Link>
    </div>
  );
};

export default BackIcon;
