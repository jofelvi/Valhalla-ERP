// Utilidades puras para formateo de fechas

/**
 * Formatea una fecha como HH:mm:ss
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    return 'N/A';
  }
  return dateObj.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Formatea una fecha como "martes, 10 de febrero de 2026"
 */
export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Calcula las horas trabajadas desde checkIn hasta ahora
 * @param checkIn - Fecha de entrada
 * @returns String formato "H:mm"
 */
export const calculateWorkedHours = (
  checkIn: Date | string | undefined,
): string => {
  if (!checkIn) return '0:00';

  const checkInDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const now = new Date();
  const diff = now.getTime() - checkInDate.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};
