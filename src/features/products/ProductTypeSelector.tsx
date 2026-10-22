import { FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { ProductFormData } from '@/features/types/schemaYup/productSchema';
import { ProductTypeEnum } from '@/shared';
import { Package, ChefHat, Sparkles } from 'lucide-react';

interface ProductTypeSelectorProps {
  errors: FieldErrors<ProductFormData>;
  watch: UseFormWatch<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
}

/**
 * La ÚNICA pregunta que decide qué sale del almacén al vender.
 *
 * Antes eran dos controles que decían lo mismo por vías distintas (un select
 * "Base/Compuesto" y un toggle "Insumo de inventario") y se contradecían: 136
 * productos se vendían sin descontar nada y los tobos, marcados "insumo",
 * vaciaban un stock fantasma de sí mismos en vez de las cervezas.
 *
 * Cada tarjeta dice explícitamente QUÉ DESCUENTA, porque ese es el efecto que
 * el dueño necesita anticipar — no la etiqueta.
 */
const OPCIONES = [
  {
    valor: ProductTypeEnum.BASE,
    titulo: 'Insumo',
    icono: Package,
    ejemplo: 'Cerveza, ketchup, harina',
    descuenta: 'Al venderlo sale UNA unidad de sí mismo',
    // Clases COMPLETAS: Tailwind no genera las que se arman con plantillas
    // (`border-${color}`), las purga en el build y la tarjeta queda sin color.
    activo: 'border-brand bg-brand/10 shadow-sm',
    iconoActivo: 'bg-brand/20',
    textoActivo: 'text-brand',
  },
  {
    valor: ProductTypeEnum.MIXED,
    titulo: 'Preparado',
    icono: ChefHat,
    ejemplo: 'Hamburguesa, pizza, tobo, mojito',
    descuenta: 'Salen sus ingredientes, con su merma',
    activo: 'border-accent bg-accent/10 shadow-sm',
    iconoActivo: 'bg-accent/20',
    textoActivo: 'text-accent',
  },
  {
    valor: ProductTypeEnum.SERVICE,
    titulo: 'Servicio',
    icono: Sparkles,
    ejemplo: 'Alquiler del salón, animador, entrada',
    descuenta: 'No sale nada del almacén',
    activo: 'border-warn bg-warn/10 shadow-sm',
    iconoActivo: 'bg-warn/20',
    textoActivo: 'text-warn',
  },
] as const;

export default function ProductTypeSelector({
  errors,
  watch,
  setValue,
}: ProductTypeSelectorProps) {
  const seleccionado = watch('type');

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-semibold mb-1 text-dim">
        ¿Qué es este producto? *
      </label>
      <p className="text-xs text-dim mb-3">
        Decide qué se descuenta del inventario cuando se vende.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {OPCIONES.map((o) => {
          const activo = seleccionado === o.valor;
          const Icono = o.icono;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() =>
                setValue('type', o.valor, { shouldValidate: true })
              }
              className={`group text-left p-4 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                activo
                  ? o.activo
                  : 'border-line bg-page hover:border-dim/50 hover:bg-surface'
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div
                  className={`p-2 rounded-xl ${activo ? o.iconoActivo : 'bg-elevated'}`}
                >
                  <Icono
                    className={`w-5 h-5 ${activo ? o.textoActivo : 'text-dim'}`}
                  />
                </div>
                <span
                  className={`text-base font-bold ${activo ? 'text-content' : 'text-dim'}`}
                >
                  {o.titulo}
                </span>
              </div>
              <p className="text-xs text-dim mb-1.5">{o.ejemplo}</p>
              <p
                className={`text-xs font-medium ${activo ? 'text-content' : 'text-dim/70'}`}
              >
                {o.descuenta}
              </p>
            </button>
          );
        })}
      </div>

      {errors.type && (
        <p className="mt-2 text-sm text-danger">{errors.type.message}</p>
      )}
    </div>
  );
}
