import EditTableClientComponent from '@/features/tables/EditTableClientComponent';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTablePage({ params }: PageProps) {
  const { id } = await params;

  return <EditTableClientComponent id={id} />;
}
