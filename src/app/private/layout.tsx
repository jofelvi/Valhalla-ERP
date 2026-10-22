// Server component wrapper — fuerza dynamic rendering en todas las rutas
// /private/*. Sin esto, Next prerenderiza los client components como static
// y eso rompe las soft navigations del router cuando la pagina usa
// useSearchParams o cambia searchParams (ej. pos/order?tableId=...&orderId=...).
export const dynamic = 'force-dynamic';

import DashboardClientLayout from './DashboardClientLayout';

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
