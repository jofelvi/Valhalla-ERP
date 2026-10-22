import { toast } from 'react-toastify';
import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
}

const icons = {
  success: <CheckCircle2 className="w-5 h-5 text-ok shrink-0 mt-0.5" />,
  error: <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="w-5 h-5 text-brand shrink-0 mt-0.5" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
};

export const useToast = () => {
  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    options: ToastOptions = {},
  ) => {
    const { title = '', description = '', duration = 5000 } = options;

    const message = (
      <div className="flex items-start gap-3">
        {icons[type]}
        <div className="flex flex-col gap-0.5 min-w-0">
          {title && (
            <h4 className="font-semibold text-[13px] leading-tight text-gray-900 dark:text-content">
              {title}
            </h4>
          )}
          {description && (
            <p className="text-xs text-dim dark:text-dim leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    );

    return toast(message, {
      autoClose: duration,
      position: 'top-right',
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: false,
      icon: false,
      className:
        '!bg-white dark:!bg-page !shadow-lg !shadow-black/10 !border !border-line dark:!border-line !rounded-xl !min-h-0 !p-3',
      style: { padding: '12px' },
      closeButton: ({ closeToast }) => (
        <button
          onClick={closeToast}
          className="text-dim hover:text-dim dark:hover:text-content transition-colors shrink-0 ml-2 mt-0.5"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      ),
    });
  };

  return {
    success: (options?: ToastOptions) =>
      showToast('success', { duration: 4000, ...options }),
    error: (options?: ToastOptions) =>
      showToast('error', { duration: 6000, ...options }),
    warning: (options?: ToastOptions) =>
      showToast('warning', { duration: 5000, ...options }),
    info: (options?: ToastOptions) =>
      showToast('info', { duration: 4000, ...options }),
  };
};
