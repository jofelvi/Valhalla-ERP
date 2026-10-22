import React from 'react';
import { FiLoader } from 'react-icons/fi';
import { cn } from '@/shared/utils/utils'; // Asegúrate de tener esta utilidad

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'default';
  text?: string;
  textPosition?: 'top' | 'bottom' | 'right' | 'left';
  className?: string;
  fullScreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({
  size = 'lg',
  color = 'primary',
  text = 'Cargando...',
  textPosition = 'bottom',
  className,
  fullScreen = true,
}) => {
  // Mapeo de tamaños
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
    full: 'h-24 w-24',
  };

  // Mapeo de colores usando variables del tema
  const colorClasses = {
    primary: 'text-brand',
    secondary: 'text-brand-light',
    success: 'text-ok',
    warning: 'text-accent',
    error: 'text-danger',
    default: 'text-brand',
  };

  // Tamaños de texto correspondientes
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
    full: 'text-xl',
  };

  // Dirección del contenido
  const flexDirection = {
    top: 'flex-col-reverse',
    bottom: 'flex-col',
    left: 'flex-row-reverse',
    right: 'flex-row',
  };

  const spinner = (
    <FiLoader
      className={cn('animate-spin', sizeClasses[size], colorClasses[color])}
    />
  );

  const content = (
    <div
      className={cn(
        'flex items-center justify-center',
        flexDirection[textPosition],
        text ? 'gap-2' : '',
        className,
      )}
    >
      {spinner}
      {text && (
        <span className={cn('text-content font-medium', textSizeClasses[size])}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-page/80 backdrop-blur-md flex items-center justify-center z-50">
        <div className="bg-surface backdrop-blur-sm rounded-2xl p-8 shadow-2xl shadow-brand/5 border border-line">
          {content}
        </div>
      </div>
    );
  }

  return content;
};

export default Loader;
