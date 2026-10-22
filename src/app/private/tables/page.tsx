import TablesClientComponent from '@/features/tables/TablesClientComponent';

export default async function TablesPage() {
  return <TablesClientComponent />;
}

// Keeping the old JSX for reference in comments - replaced with client component
/*
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mesas</h1>
        <Link href={PRIVATE_ROUTES.TABLES_NEW}>
          <Button>Nueva Mesa</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map((table) => (
          <Link key={table.id} href={PRIVATE_ROUTES.TABLES_DETAILS(table.id)}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>
                    Mesa {table.number} - {table.name}
                  </span>
                  <Badge variant={getStatusVariant(table.status)}>
                    {table.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-dim">
                  Capacidad: {table.capacity} personas
                </p>
                <p className="text-dim mt-2">
                  Disponible: {table.isAvailable ? 'Sí' : 'No'}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
*/
