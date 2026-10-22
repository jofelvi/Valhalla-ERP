/**
 * Formatea una fecha/hora en formato de hora (HH:mm)
 * Soporta Date, string, timestamp de Firestore
 */
export const formatTime = (
  date: Date | string | null | undefined | { toDate: () => Date },
): string => {
  if (!date) return '-';

  let dateObj: Date;

  // Manejo de Firestore Timestamp objects
  if (
    date &&
    typeof date === 'object' &&
    typeof (date as { toDate?: () => Date }).toDate === 'function'
  ) {
    dateObj = (date as { toDate: () => Date }).toDate();
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'string') {
    dateObj = new Date(date);
  } else {
    return '-';
  }

  if (isNaN(dateObj.getTime())) {
    return '-';
  }

  return dateObj.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Formatea una fecha en formato DD/MM/YYYY
 */
export const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
