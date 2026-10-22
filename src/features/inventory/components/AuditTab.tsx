import Link from 'next/link';
import Loader from '@/components/shared/Loader/Loader';
import { CatalogAudit } from '@odin6/types';
import { formatearUsd } from '@/shared/utils/dinero';
import { ExpandableAuditSection } from './ExpandableAuditSection';

interface AuditTabProps {
  audit: CatalogAudit | undefined;
  isLoading: boolean;
  auditDays: number;
  onAuditDaysChange: (days: number) => void;
}

export function AuditTab({
  audit,
  isLoading,
  auditDays,
  onAuditDaysChange,
}: AuditTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-dim mb-2">
            Período
          </label>
          <select
            value={auditDays}
            onChange={(e) => onAuditDaysChange(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-line bg-elevated text-content text-sm"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </div>
        {audit && (
          <div className="bg-accent/10 rounded-lg p-3 border border-accent/30 self-start sm:self-auto">
            <p className="text-xs font-semibold text-dim">Cobertura</p>
            <p className="text-2xl font-bold text-accent">
              {audit.coveragePct.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader size="md" text="" fullScreen={false} />
        </div>
      ) : audit ? (
        <div className="space-y-4">
          {/* Vendidos sin receta */}
          <ExpandableAuditSection
            title="Vendidos sin Receta"
            count={audit.soldWithoutRecipe.length}
            defaultOpen={audit.soldWithoutRecipe.length > 0}
          >
            {audit.soldWithoutRecipe.length === 0 ? (
              <p className="text-sm text-dim p-4">
                Todos los productos vendidos tienen receta configurada
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-elevated/30">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2 text-left font-semibold text-content">
                        Producto
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-content">
                        Unidades Vendidas
                      </th>
                      <th className="px-4 py-2 text-right font-semibold text-content">
                        Ingreso
                      </th>
                      <th className="px-4 py-2 text-center font-semibold text-content">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.soldWithoutRecipe.map((item, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-line hover:bg-elevated/30"
                      >
                        <td className="px-4 py-3 text-content">{item.name}</td>
                        <td className="px-4 py-3 text-right text-dim">
                          {item.unitsSold}
                        </td>
                        <td className="px-4 py-3 text-right text-content font-medium">
                          {formatearUsd(item.revenue)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/private/products/${item.productId}`}
                            className="text-accent text-xs hover:underline"
                          >
                            Editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExpandableAuditSection>

          {/* Recetas con problemas */}
          <ExpandableAuditSection
            title="Recetas con Problemas"
            count={audit.recipesWithIssues.length}
            defaultOpen={audit.recipesWithIssues.length > 0}
          >
            {audit.recipesWithIssues.length === 0 ? (
              <p className="text-sm text-dim p-4">
                Todas las recetas están bien configuradas
              </p>
            ) : (
              <div className="space-y-3 p-4">
                {audit.recipesWithIssues.map((item, idx) => (
                  <div key={idx} className="border border-line rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-content">{item.name}</h4>
                      <Link
                        href={`/private/products/${item.productId}`}
                        className="text-accent text-xs hover:underline"
                      >
                        Editar
                      </Link>
                    </div>
                    <ul className="text-xs text-dim space-y-1">
                      {item.issues.map((issue, i) => (
                        <li key={i}>• {issue}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </ExpandableAuditSection>

          {/* Insumos incompletos */}
          <ExpandableAuditSection
            title="Insumos Incompletos"
            count={audit.insumosIncomplete.length}
            defaultOpen={audit.insumosIncomplete.length > 0}
          >
            {audit.insumosIncomplete.length === 0 ? (
              <p className="text-sm text-dim p-4">
                Todos los insumos están completos
              </p>
            ) : (
              <div className="space-y-3 p-4">
                {audit.insumosIncomplete.map((item, idx) => (
                  <div key={idx} className="border border-line rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-content">{item.name}</h4>
                      <Link
                        href={`/private/products/${item.productId}`}
                        className="text-accent text-xs hover:underline"
                      >
                        Editar
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.missing.map((field) => (
                        <span
                          key={field}
                          className="inline-block bg-danger/10 text-danger px-2 py-1 rounded text-xs font-medium"
                        >
                          Falta: {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ExpandableAuditSection>

          {/* Servicios Legacy BASE */}
          {audit.legacyBaseServices.length > 0 && (
            <ExpandableAuditSection
              title="Servicios Legacy BASE"
              count={audit.legacyBaseServices.length}
              defaultOpen={false}
            >
              <div className="space-y-2 p-4 text-sm text-dim">
                {audit.legacyBaseServices.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <Link
                      href={`/private/products/${item.productId}`}
                      className="text-accent text-xs hover:underline"
                    >
                      Editar
                    </Link>
                  </div>
                ))}
              </div>
            </ExpandableAuditSection>
          )}
        </div>
      ) : null}
    </div>
  );
}
