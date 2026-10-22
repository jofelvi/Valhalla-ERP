'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Mostrar el toast con animación
    const showTimer = setTimeout(() => setIsVisible(true), 10);

    // Auto-cerrar después del duration
    const hideTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(id);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-ok" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-danger" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-brand" />;
      case 'info':
        return <Info className="h-5 w-5 text-brand" />;
      default:
        return <Info className="h-5 w-5 text-brand" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-ok';
      case 'error':
        return 'bg-red-50 border-danger text-danger';
      case 'warning':
        return 'bg-amber-50 border-amber-200 text-amber-800';
      case 'info':
        return 'bg-elevated border-line text-content';
      default:
        return 'bg-elevated border-line text-content';
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm',
        'min-w-[300px] max-w-[500px] transition-all duration-300 ease-out',
        getStyles(),
        isVisible && !isLeaving
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-full',
        isLeaving && 'opacity-0 translate-x-full',
      )}
    >
      {/* Icono */}
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      {/* Contenido */}
      <div className="flex-1 min-w-0">
        {title && <h4 className="text-sm font-semibold mb-1">{title}</h4>}
        <p className="text-sm leading-relaxed">{message}</p>
      </div>

      {/* Botón cerrar */}
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-md hover:bg-black/10 transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
