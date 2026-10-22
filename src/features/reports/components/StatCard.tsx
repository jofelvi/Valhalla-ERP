import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: React.ReactNode;
  iconBgColor: string;
  label: string;
  value: string | number;
  valueColor: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBgColor,
  label,
  value,
  valueColor,
}) => {
  return (
    <Card className="bg-surface border-line shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full ${iconBgColor} flex items-center justify-center`}
          >
            {icon}
          </div>
          <div className="ml-4">
            <p className="text-sm font-medium text-dim">{label}</p>
            <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
