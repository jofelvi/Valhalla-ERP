import EditCustomerClientComponent from '@/features/customers/EditCustomerClientComponent';

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({
  params,
}: EditCustomerPageProps) {
  const { id } = await params;

  return <EditCustomerClientComponent id={id} />;
}
