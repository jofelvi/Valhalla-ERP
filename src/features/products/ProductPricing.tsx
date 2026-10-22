import { ProductTypeEnum } from '@/shared';
import { FieldErrors, UseFormRegister, UseFormWatch } from 'react-hook-form';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import { Input } from '@/components/shared/input/input';
import { FaInfoCircle } from 'react-icons/fa';
import { DollarSign } from 'lucide-react';

interface ProductPricingProps {
  register: UseFormRegister<ProductFormData>;
  errors: FieldErrors<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
}

export default function ProductPricing({
  register,
  errors,
  watch,
}: ProductPricingProps) {
  const type = watch('type');
  const seVende = watch('isForSale');

  return (
    <>
      {/* La moneda se quitó: todo el negocio opera en USD y el campo solo lo
          leía el formateador de precio del APK. Un selector con una sola
          opción real solo daba oportunidad de equivocarse. */}

      {/* Precio de Venta: solo si el producto se vende. Un insumo que solo
          entra en recetas no lo necesita (su costo es lo que importa). */}
      {seVende ? (
        <Input
          label="Precio de Venta *"
          id="price"
          type="number"
          min={0.01}
          step={0.01}
          variant="numeric"
          icon={DollarSign}
          {...register('price')}
          error={errors.price?.message}
          placeholder="0.00"
          textHelper="Precio al que se vende al cliente"
        />
      ) : (
        <p className="text-xs text-dim">
          No está a la venta, así que no necesita precio. Su costo se usa para
          calcular las recetas que lo llevan.
        </p>
      )}

      {/* Costo / Precio de Compra */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-semibold text-dim">
            {type === ProductTypeEnum.MIXED
              ? 'Costo de Elaboración'
              : 'Costo de la Unidad de Compra'}
          </label>
          {type === ProductTypeEnum.MIXED && (
            <span className="inline-flex items-center px-2 py-1 rounded-md bg-ok/15 text-ok text-xs font-medium border border-ok/20">
              Calculado automaticamente
            </span>
          )}
        </div>
        <Input
          id="cost"
          type="number"
          min={0}
          step={0.01}
          variant="numeric"
          icon={DollarSign}
          {...register('cost')}
          error={errors.cost?.message}
          disabled={type === ProductTypeEnum.MIXED}
          placeholder="0.00"
          textHelper={
            type === ProductTypeEnum.MIXED
              ? undefined
              : 'Lo que pagas por la unidad COMPLETA tal como la compras: el saco, la lata, el bulto, el cartón. Ej: saco de harina de 45kg = 42.44'
          }
        />
        <DerivedCostHint watch={watch} />
        {type === ProductTypeEnum.MIXED && (
          <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-page to-elevated rounded-xl border border-brand/20">
            <FaInfoCircle
              className="text-brand mt-0.5 flex-shrink-0"
              size={14}
            />
            <p className="text-sm text-dim font-medium">
              Se calcula automaticamente basado en los ingredientes + merma
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// Muestra en vivo el costo derivado por unidad base (kg/gr/L/und) a partir del
// costo de la unidad de compra y su contenido — la cifra que usa el costeo de recetas.
function DerivedCostHint({ watch }: { watch: UseFormWatch<ProductFormData> }) {
  const cost = Number(watch('cost')) || 0;
  const qty = Number(watch('presentationQuantity')) || 0;
  const presentation = watch('presentation');
  if (cost <= 0 || qty <= 0 || !presentation) return null;

  const perUnit = cost / qty;
  const unitLabels: Record<string, string> = {
    Kilogramo: 'kg',
    Gramo: 'gr',
    Litro: 'L',
    Mililitro: 'ml',
    Unidad: 'unidad',
  };
  const unitLabel = unitLabels[presentation] ?? presentation.toLowerCase();

  return (
    <div className="flex items-start gap-2 p-3 bg-accent/5 rounded-xl border border-accent/20">
      <FaInfoCircle className="text-accent mt-0.5 flex-shrink-0" size={14} />
      <p className="text-sm text-content font-medium">
        Costo derivado:{' '}
        <span className="font-bold text-accent">
          ${perUnit < 0.01 ? perUnit.toFixed(4) : perUnit.toFixed(2)} por{' '}
          {unitLabel}
        </span>
        <span className="text-dim font-normal">
          {' '}
          (${cost.toFixed(2)} ÷ {qty} {unitLabel}) — este es el valor que usan
          las recetas y la valorización
        </span>
      </p>
    </div>
  );
}
