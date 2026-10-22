import EditSupplierClientComponent from '@/features/suppliers/EditSupplierClientComponent';

export default async function SupplierEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EditSupplierClientComponent id={id} />;
}
