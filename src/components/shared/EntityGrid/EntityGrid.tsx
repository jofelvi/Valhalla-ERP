// features/shared/EntityGrid.tsx
import Link from 'next/link';
import Image from 'next/image';
import { FiPackage, FiTrash2 } from 'react-icons/fi';
import { cn } from '@/shared/utils/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';

interface EntityGridProps<T> {
  items: T[];
  getDetailPath: (id: string) => string;
  imageKey?: keyof T;
  nameKey: keyof T;
  descriptionKey?: keyof T;
  statusKey?: keyof T;
  statusLabels?: { [key: string]: string };
  statusColors?: { [key: string]: string };
  onDelete?: (item: T) => void;
  emptyState: React.ReactNode;
}

export const EntityGrid = <T extends { id: string }>({
  items,
  getDetailPath,
  imageKey,
  nameKey,
  descriptionKey,
  statusKey,
  statusLabels = {},
  statusColors = {},
  onDelete,
  emptyState,
}: EntityGridProps<T>) => {
  if (items.length === 0) {
    return emptyState;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {items.map((item) => (
        <div key={item.id} className="group relative">
          <Link href={getDetailPath(item.id)} className="group">
            <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-0 shadow-sm">
              {/* Image Section */}
              {imageKey && (
                <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg overflow-hidden">
                  {item[imageKey] ? (
                    <Image
                      src={String(item[imageKey])}
                      alt={String(item[nameKey]) || 'Imagen'}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gradient-to-br from-page to-indigo-100">
                      <FiPackage className="w-16 h-16 text-blue-400" />
                    </div>
                  )}

                  {/* Status Badge Overlay */}
                  {statusKey && item[statusKey] && (
                    <div className="absolute top-3 right-3">
                      <Badge
                        className={cn(
                          'shadow-sm font-medium text-xs',
                          statusColors[String(item[statusKey])] ||
                            'bg-elevated text-content border-line',
                        )}
                      >
                        {statusLabels[String(item[statusKey])] ||
                          String(item[statusKey])}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Content Section */}
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-content group-hover:text-blue-600 transition-colors duration-200">
                  {String(item[nameKey])}
                </CardTitle>
              </CardHeader>

              {descriptionKey && (
                <CardContent className="pt-0">
                  <p className="text-dim text-sm leading-relaxed line-clamp-2">
                    {(item[descriptionKey] && String(item[descriptionKey])) ||
                      'Sin descripción disponible'}
                  </p>
                </CardContent>
              )}
            </Card>
          </Link>

          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(item);
              }}
              className="absolute top-3 left-3 bg-surface/80 hover:bg-danger rounded-full p-2 shadow-md transition-colors duration-200 group-hover:opacity-100 opacity-0 focus:opacity-100"
              aria-label={`Eliminar ${String(item[nameKey])}`}
            >
              <FiTrash2 className="w-4 h-4 text-danger" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
};
