import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { Badge } from '@/components/shared/badge/badge';
import { Button } from '@/components/shared/button/Button';
import { ShoppingBag, UserCheck, MessageSquare } from 'lucide-react';
import { Order } from '@/modelTypes/order';
import { formatearUsdConMiles, formatearUsd } from '@/shared/utils/dinero';
import { formatDate } from '../utils';

interface OrdersCardProps {
  orders: Order[];
}

export function OrdersCard({ orders }: OrdersCardProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-brand/20 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <ShoppingBag className="h-5 w-5 text-brand" />
          {orders.length > 1
            ? `Ordenes Asociadas (${orders.length})`
            : 'Orden Asociada'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {orders.map((ord) => (
          <div
            key={ord.id}
            className="bg-brand/10 p-4 rounded-xl border border-brand/20"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-content text-sm">
                #{ord.id.slice(-8).toUpperCase()}
              </span>
              <span className="font-bold text-content">
                {formatearUsdConMiles(ord.total)}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-brand mb-2">
              <span>{formatDate(ord.createdAt)}</span>
              {ord.tableName && <Badge variant="info">{ord.tableName}</Badge>}
              <Badge variant="secondary" className="capitalize">
                {ord.status.replace('_', ' ')}
              </Badge>
            </div>
            {ord.waiterName && (
              <div className="flex items-center gap-1.5 text-xs text-accent mb-2">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="font-medium">Mesonero: {ord.waiterName}</span>
              </div>
            )}
            {ord.items.length > 0 && (
              <div className="space-y-0.5 text-xs text-dim">
                {ord.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span className="text-dim">{formatearUsd(item.total)}</span>
                  </div>
                ))}
              </div>
            )}
            {ord.notes && (
              <div className="mt-2 flex items-start gap-1.5 text-xs bg-elevated/60 rounded-lg px-2.5 py-2 border border-line/40">
                <MessageSquare className="w-3.5 h-3.5 text-dim shrink-0 mt-0.5" />
                <span className="text-dim italic">{ord.notes}</span>
              </div>
            )}
            <div className="mt-2">
              <Link href={`/private/orders/${ord.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7"
                >
                  Ver Detalles
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
