'use client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';

interface NotesCardProps {
  notes: string;
}

export const NotesCard: React.FC<NotesCardProps> = ({ notes }) => {
  if (!notes) {
    return null;
  }

  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50">
      <CardHeader>
        <CardTitle className="text-content">Notas</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-content">{notes}</p>
      </CardContent>
    </Card>
  );
};
