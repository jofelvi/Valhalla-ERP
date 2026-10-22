import Link from '@/shared/ui/AppLink/AppLink';
import { Badge, Building, Calendar, DollarSign } from 'lucide-react';
import { PurchaseOrder } from '@odin6/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { formatDateForDisplay } from '@/shared/utils/serializeTimestamp';
import { PurchaseOrderStatusEnum } from '@/shared';
import { getStatusInSpanish } from '@/shared/utils/getStatusOrderInSpanish';
import { getStatusBadgeClasses } from '@/shared/utils/getStatusBadgeClasses';
import { PRIVATE_ROUTES } from '@/shared';

interface OrderCardProps {
  order: PurchaseOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <Link href={PRIVATE_ROUTES.PURCHASE_ORDERS_DETAILS(order.id)}>
      <Card className="h-full transition-all hover:shadow-xl hover:-translate-y-1 flex flex-col">
        <CardHeader>
          <CardTitle className="flex justify-between items-start gap-2">
            <span className="font-bold text-lg text-brand truncate">
              Orden #{order.id.slice(-3).toUpperCase()}
            </span>
            <Badge className={getStatusBadgeClasses(order.status)}>
              {getStatusInSpanish(order.status)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4 text-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Building className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-foreground truncate">
              {getStatusInSpanish(order.status as PurchaseOrderStatusEnum)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Building className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-foreground truncate">
              {order.supplierName}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <DollarSign className="h-4 w-4 flex-shrink-0" />
            <span className="font-semibold text-foreground">
              {order.currency} {order.totalAmount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="text-foreground">
              {formatDateForDisplay(order.expectedDeliveryDate)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
