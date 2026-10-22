'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import { Product } from '@odin6/types';
import { ProductTypeEnum, UserRoleEnum } from '@/shared';
import { useToast } from '@/shared/hooks/useToast';
import { useSetNaturaleza } from '@/hooks/useProducts';
import { NATURALEZA } from '@/features/products/naturaleza';
import type {
  AuditSection,
  AuditedProduct,
} from '@/features/recipes/types/auditResults';
import { margenPct } from '@/features/products/naturaleza';

interface RecipeAuditSectionProps {
  section: AuditSection;
  onEditProduct: (p: Product) => void;
  _userRole?: UserRoleEnum;
}

export function RecipeAuditSection({
  section,
  onEditProduct,
  _userRole,
}: RecipeAuditSectionProps) {
  const [expandido, setExpandido] = useState(true);
  const [marcando, setMarcando] = useState<string | null>(null);
  const toast = useToast();
  const setNaturaleza = useSetNaturaleza();

  const marcar = async (p: AuditedProduct, type: string, etiqueta: string) => {
    setMarcando(p.id);
    try {
      await setNaturaleza.mutateAsync({ id: p.id, type });
      toast.success({
        title: `${p.name} es ${etiqueta}`,
        description:
          type === ProductTypeEnum.BASE
            ? 'Al venderlo descontará una unidad de sí mismo.'
            : 'No tocará el inventario, a propósito.',
      });
    } catch (err: unknown) {
      toast.error({
        title: 'No se pudo guardar',
        description: err instanceof Error ? err.message : 'Inténtalo de nuevo.',
      });
    } finally {
      setMarcando(null);
    }
  };

  if (section.productos.length === 0) {
    return (
      <div className="border rounded-lg p-4 space-y-2 bg-surface/50">
        <h3 className="font-bold text-base text-content">{section.titulo}</h3>
        <p className="text-sm text-dim">{section.descripcion}</p>
      </div>
    );
  }

  const tieneProblemas = section.productos.some(
    (p) => (p as AuditedProduct).errores,
  );

  return (
    <div
      className={`border rounded-lg overflow-hidden ${tieneProblemas ? 'border-danger/40 bg-danger/5' : 'border-line'}`}
    >
      <button
        type="button"
        onClick={() => setExpandido(!expandido)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-surface hover:bg-surface/80 transition-colors"
      >
        <div className="text-left">
          <h3 className="font-bold text-base text-content">{section.titulo}</h3>
          <p className="text-xs sm:text-sm text-dim">{section.descripcion}</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-dim shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`}
        />
      </button>

      {expandido && (
        <div className="divide-y divide-line">
          {section.productos.map((p) => {
            const auditedP = p as AuditedProduct;
            const tieneError = auditedP.errores && auditedP.errores.length > 0;
            const etiqueta = NATURALEZA[auditedP.naturaleza];
            const margen = margenPct(p);
            const ocupado = marcando === p.id;

            return (
              <div key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onEditProduct(p)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="font-semibold text-content truncate">
                      {p.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded border ${etiqueta.color}`}
                        title={etiqueta.queDescuenta}
                      >
                        {etiqueta.titulo}
                      </span>
                      {margen !== null && (
                        <span
                          className={`text-xs px-2 py-1 rounded ${margen < 0 ? 'bg-danger/20 text-danger' : margen < 30 ? 'bg-warn/20 text-warn' : 'bg-ok/20 text-ok'}`}
                        >
                          {margen.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </button>
                </div>

                {tieneError && (
                  <div className="flex gap-2 text-xs text-danger">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <ul className="space-y-1">
                      {auditedP.errores?.map((err, idx) => (
                        <li key={idx}>{err.detalles || err.reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Acciones en un toque */}
                {auditedP.acciones.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
                    {auditedP.acciones.map((accion) => {
                      const handleClick = () => {
                        if (accion === 'Es insumo') {
                          marcar(auditedP, ProductTypeEnum.BASE, 'un insumo');
                        } else if (accion === 'Es servicio') {
                          marcar(
                            auditedP,
                            ProductTypeEnum.SERVICE,
                            'un servicio',
                          );
                        } else if (accion === 'Cargar receta') {
                          onEditProduct(p);
                        }
                      };

                      const accionBtnClass =
                        {
                          'Es insumo':
                            'border-brand/40 text-brand hover:bg-brand/10',
                          'Es servicio':
                            'border-line text-dim hover:bg-elevated',
                          'Cargar receta':
                            'border-accent/40 text-accent hover:bg-accent/10',
                          Directo: 'border-warn/40 text-warn hover:bg-warn/10',
                        }[accion] || 'border-line text-dim';

                      return (
                        <button
                          key={accion}
                          type="button"
                          disabled={ocupado && accion !== 'Cargar receta'}
                          onClick={handleClick}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${accionBtnClass} disabled:opacity-50`}
                        >
                          {accion}
                        </button>
                      );
                    })}
                    {ocupado && (
                      <Loader2 className="w-4 h-4 animate-spin text-dim" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
