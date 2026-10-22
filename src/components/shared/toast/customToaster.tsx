import { JSX } from 'react';

export interface CustomToasterProps {
  variant: 'success' | 'error' | 'warning' | 'information';
  isVisible: boolean;
  title: string;
  description: string;
}

const CustomToaster = ({
  variant,
  description,
  isVisible,
  title,
}: CustomToasterProps): JSX.Element => {
  const VARIANTS = {
    success: {
      icon: 'bg-gradient-to-r from-emerald-500 to-green-500',
      iconSymbol: '✓',
      bgGradient: 'from-emerald-50 to-green-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-ok',
    },
    error: {
      icon: 'bg-gradient-to-r from-red-500 to-pink-500',
      iconSymbol: '✕',
      bgGradient: 'from-red-50 to-pink-50',
      borderColor: 'border-danger',
      textColor: 'text-danger',
    },
    warning: {
      icon: 'bg-gradient-to-r from-amber-500 to-orange-500',
      iconSymbol: '⚠',
      bgGradient: 'from-amber-50 to-orange-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-800',
    },
    information: {
      icon: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      iconSymbol: 'ℹ',
      bgGradient: 'from-page to-elevated',
      borderColor: 'border-line',
      textColor: 'text-content',
    },
  };

  const variantConfig = VARIANTS[variant];

  return (
    <div
      className={`bg-gradient-to-r ${variantConfig.bgGradient} backdrop-blur-md border ${variantConfig.borderColor} px-4 py-4 shadow-xl rounded-2xl min-w-[20rem] max-w-[24rem] ${
        isVisible
          ? 'animate-in slide-in-from-top-5 fade-in-0 duration-300'
          : 'animate-out slide-out-to-top-5 fade-out-0 duration-200'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`${variantConfig.icon} w-8 h-8 text-on-brand text-sm font-bold flex items-center justify-center rounded-full shadow-lg flex-shrink-0`}
        >
          {variantConfig.iconSymbol}
        </div>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <h3 className={`text-sm font-semibold ${variantConfig.textColor}`}>
            {title}
          </h3>
          <p
            className={`text-xs font-medium ${variantConfig.textColor} opacity-80 leading-relaxed`}
          >
            {description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomToaster;
