'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectCustom from '@/components/shared/selectCustom/SelectCustom';

interface AttendanceFiltersProps {
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

/**
 * Panel de filtros para mes y año
 */
export const AttendanceFilters = ({
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
}: AttendanceFiltersProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <SelectCustom
            id="month"
            label="Mes"
            value={selectedMonth.toString()}
            onChange={(value) => onMonthChange(parseInt(value))}
            options={Array.from({ length: 12 }, (_, i) => ({
              value: (i + 1).toString(),
              label: new Date(0, i).toLocaleDateString('es-ES', {
                month: 'long',
              }),
            }))}
          />
        </div>

        <div>
          <Label htmlFor="year">Año</Label>
          <Input
            type="number"
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            min="2020"
            max="2030"
          />
        </div>
      </CardContent>
    </Card>
  );
};
