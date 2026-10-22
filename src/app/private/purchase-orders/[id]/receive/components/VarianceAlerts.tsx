import { PriceVarianceReport } from '@/features/supply-chain/types/merchandiseReceiptTypes';
import { formatearUsdConMiles } from '@/shared/utils/dinero';
import { getVarianceColor } from '../utils';

interface VarianceAlertsProps {
  priceVariances: PriceVarianceReport[];
  show: boolean;
}

export const VarianceAlerts: React.FC<VarianceAlertsProps> = ({
  priceVariances,
  show,
}) => {
  if (!show) return null;

  const significantVariances = priceVariances.filter(
    (v) => Math.abs(v.variance) > 0.01,
  );

  if (significantVariances.length === 0) return null;

  return (
    <div className="mb-6 bg-accent/15 border border-accent/20 rounded-lg p-4">
      <h3 className="text-sm font-medium text-accent mb-3">
        ⚠️ Variaciones de Precios Detectadas
      </h3>
      <div className="space-y-2">
        {significantVariances.map((variance, index) => (
          <div
            key={index}
            className="flex justify-between items-center text-sm"
          >
            <span className="text-accent">{variance.productName}</span>
            <div className="flex items-center gap-2">
              <span className={getVarianceColor(variance.variance)}>
                {variance.variance > 0 ? '+' : ''}
                {formatearUsdConMiles(variance.variance)}
              </span>
              <span
                className={`${getVarianceColor(variance.variance)} font-medium`}
              >
                ({variance.variancePercentage > 0 ? '+' : ''}
                {variance.variancePercentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
