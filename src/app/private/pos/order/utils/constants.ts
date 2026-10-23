import { ZoneSectorEnum } from '@/shared';

export const SECTOR_LABELS: Record<string, string> = {
  [ZoneSectorEnum.EVENTO]: 'Evento',
  [ZoneSectorEnum.PISCINA]: 'Piscina',
  [ZoneSectorEnum.TENIS]: 'Tenis',
  [ZoneSectorEnum.FUTBOL]: 'Futbol',
  [ZoneSectorEnum.BEISBOL]: 'Beisbol',
  [ZoneSectorEnum.SALON_PRINCIPAL]: 'Salon Principal',
  [ZoneSectorEnum.CANCHAS]: 'Canchas',
};

export const HEARTBEAT_INTERVAL_MS = 60_000;
