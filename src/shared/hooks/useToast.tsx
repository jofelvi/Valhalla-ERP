import { toast } from 'react-toastify';

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
}

export const useToast = () => {
  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    options: ToastOptions = {},
  ) => {
    const { title = '', description = '', duration = 5000 } = options;

    const message =
      title && description
        ? `${title}: ${description}`
        : title || description || '';

    return toast[type](message, {
      autoClose: duration,
      position: 'top-right',
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
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
