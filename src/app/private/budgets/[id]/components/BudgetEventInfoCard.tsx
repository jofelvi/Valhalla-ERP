import { Calendar, FileText, Users, AlertTriangle } from 'lucide-react';
import { Budget } from '@odin6/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';
import { formatDateVE } from '../utils';

interface BudgetEventInfoCardProps {
  budget: Budget;
}

export function BudgetEventInfoCard({ budget }: BudgetEventInfoCardProps) {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-accent/20/50 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <Calendar className="h-5 w-5 text-brand" />
          Evento
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-brand to-accent rounded-lg flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-on-brand" />
          </div>
          <div>
            <p className="text-xs font-medium text-brand">Evento</p>
            <p className="font-semibold text-content">{budget.eventName}</p>
          </div>
        </div>

        {budget.eventDate && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="h-4 w-4 text-on-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-accent">Fecha</p>
              <p className="font-semibold text-content">
                {formatDateVE(budget.eventDate)}
              </p>
            </div>
          </div>
        )}

        {budget.eventGuests && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent rounded-lg flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-on-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-accent">Invitados</p>
              <p className="font-semibold text-content">
                {budget.eventGuests} personas
              </p>
            </div>
          </div>
        )}

        {budget.validUntil && (
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-accent to-danger rounded-lg flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-on-brand" />
            </div>
            <div>
              <p className="text-xs font-medium text-accent">Valido hasta</p>
              <p className="font-semibold text-content">
                {formatDateVE(budget.validUntil)}
              </p>
            </div>
          </div>
        )}

        {/* Creation date */}
        <div className="pt-3 border-t border-accent/20/50 text-xs text-brand space-y-1">
          <p>Creado: {formatDateVE(budget.createdAt)}</p>
          {budget.updatedAt && (
            <p>Actualizado: {formatDateVE(budget.updatedAt)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
