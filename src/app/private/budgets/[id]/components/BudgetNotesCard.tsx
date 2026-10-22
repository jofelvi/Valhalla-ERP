import { StickyNote } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';

interface BudgetNotesCardProps {
  notes: string | undefined;
}

export function BudgetNotesCard({ notes }: BudgetNotesCardProps) {
  if (!notes) return null;

  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-accent/20/50 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <StickyNote className="h-5 w-5 text-brand" />
          Notas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-gradient-to-br from-surface/60 to-elevated/60 p-4 rounded-xl border border-line/50">
          <p className="text-sm text-content leading-relaxed whitespace-pre-wrap">
            {notes}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
