'use client';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Button } from '@/components/shared/button/Button';
import { PRIVATE_ROUTES } from '@/shared';
import { Order } from '@odin6/types';

interface RelatedOrderCardProps {
  order: Order;
}

export const RelatedOrderCard: React.FC<RelatedOrderCardProps> = ({
  order,
}) => {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50">
      <CardHeader>
        <CardTitle className="text-content">Orden Relacionada</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm font-medium text-brand">ID de Orden</p>
          <p className="font-semibold text-content">#{order.id.slice(0, 8)}</p>
          <div className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-brand">Estado:</span>
                <p className="font-semibold text-content">{order.status}</p>
              </div>
              <div>
                <span className="text-brand">Total:</span>
                <p className="font-semibold text-content">
                  ${(order.total || 0).toFixed(2)}
                </p>
              </div>
            </div>
            <Link href={PRIVATE_ROUTES.ORDERS}>
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="w-3 h-3 mr-2" />
                Ver Orden Completa
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
