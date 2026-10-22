import { Users, Phone, Mail } from 'lucide-react';
import { Budget } from '@odin6/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/shared/card/card';

interface BudgetClientInfoCardProps {
  budget: Budget;
}

export function BudgetClientInfoCard({ budget }: BudgetClientInfoCardProps) {
  return (
    <Card className="bg-surface/90 backdrop-blur-sm shadow-xl border border-line/50 hover:shadow-xl hover:-translate-y-0">
      <CardHeader className="border-b border-accent/20/50 pb-4">
        <CardTitle className="text-content flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-brand" />
          Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        {/* Avatar & Name */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-brand to-accent rounded-full flex items-center justify-center shadow-lg shadow-brand/20">
            <span className="text-on-brand font-bold text-lg">
              {budget.customerName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-content text-lg truncate">
              {budget.customerName}
            </p>
          </div>
        </div>

        {/* Contact info */}
        <div className="space-y-3 pt-2 border-t border-accent/20/50">
          {budget.customerPhone && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-ok to-ok rounded-lg flex items-center justify-center shrink-0">
                <Phone className="h-3.5 w-3.5 text-on-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-brand">Telefono</p>
                <p className="text-sm font-medium text-content truncate">
                  {budget.customerPhone}
                </p>
              </div>
            </div>
          )}

          {budget.customerEmail && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent rounded-lg flex items-center justify-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-on-brand" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-brand">Email</p>
                <p className="text-sm font-medium text-content truncate">
                  {budget.customerEmail}
                </p>
              </div>
            </div>
          )}

          {!budget.customerPhone && !budget.customerEmail && (
            <p className="text-sm text-brand italic">
              Sin datos de contacto registrados
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
