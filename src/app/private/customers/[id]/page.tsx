import CustomerProfileClientComponent from '@/features/customers/CustomerProfileClientComponent';

interface CustomerProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerProfilePage({
  params,
}: CustomerProfilePageProps) {
  const { id } = await params;

  return <CustomerProfileClientComponent id={id} />;
}
