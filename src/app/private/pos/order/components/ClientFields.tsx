'use client';

import { Hash, User2, MapPin } from 'lucide-react';
import type { UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/shared/input/input';
import { OrderFormValues } from '@/shared/schemas/orderSchema';
import { SECTOR_LABELS } from '../utils/constants';

interface ClientFieldsProps {
  sectorParam: string | null;
  isLookingUpMember: boolean;
  onLookupMember: () => void;
  register: UseFormRegister<OrderFormValues>;
}

export function ClientFields({
  sectorParam,
  isLookingUpMember,
  onLookupMember,
  register,
}: ClientFieldsProps) {
  return (
    <div className="border-b border-line p-3">
      {sectorParam && (
        <h4 className="text-xs font-semibold text-brand flex items-center gap-1 mb-2">
          <MapPin className="w-3.5 h-3.5" />
          {SECTOR_LABELS[sectorParam] || sectorParam}
        </h4>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <User2 className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
          <Input
            type="text"
            placeholder="Alias del cliente..."
            {...register('customerAlias', {
              setValueAs: (v) => (v === '' ? null : v),
            })}
            className="h-8 text-xs border-line focus:border-brand focus:ring-brand/20 pl-7"
          />
        </div>
        <div className="relative w-28">
          <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dim" />
          <Input
            type="text"
            placeholder="N° socio"
            {...register('associateNumber', {
              setValueAs: (v) => (v === '' ? null : v),
              onBlur: () => void onLookupMember(),
            })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onLookupMember();
              }
            }}
            disabled={isLookingUpMember}
            className="h-8 text-xs border-line focus:border-brand focus:ring-brand/20 pl-7"
          />
        </div>
      </div>
    </div>
  );
}
