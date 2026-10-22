// utils/dateHelpers.ts

/**
 * Cualquier fecha que llegue de la API convertida a Date.
 *
 * Se llamaba aFecha y traia dos ramas para los Timestamp de
 * Firestore. La migracion normalizo TODOS los documentos: no queda ni uno con
 * forma {seconds, nanoseconds} en ninguna coleccion, asi que esas ramas ya no
 * se ejecutaban nunca.
 *
 * Sigue haciendo falta porque por JSON las fechas viajan como string.
 */
export type FechaCruda = Date | string | number | null | undefined;

export function aFecha(valor: FechaCruda): Date {
  if (!valor) return new Date();
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? new Date() : valor;
  }
  const convertida = new Date(valor);
  return Number.isNaN(convertida.getTime()) ? new Date() : convertida;
}

/**
 * Formatea una fecha en formato español
 */
export function formatDate(
  date: FechaCruda,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const convertedDate = aFecha(date);

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Caracas',
    ...options,
  };

  return convertedDate.toLocaleDateString('es-ES', defaultOptions);
}

/**
 * Formatea solo la hora
 */
export function formatTime(date: FechaCruda): string {
  const convertedDate = aFecha(date);

  return convertedDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea hora, y agrega fecha si no es del dia de hoy
 */
export function formatSmartTime(date: FechaCruda): string {
  const convertedDate = aFecha(date);
  const now = new Date();
  const isToday =
    convertedDate.getDate() === now.getDate() &&
    convertedDate.getMonth() === now.getMonth() &&
    convertedDate.getFullYear() === now.getFullYear();

  const time = convertedDate.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) return time;

  const dateStr = convertedDate.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${dateStr} ${time}`;
}

/**
 * Formatea fecha y hora completas
 */
export function formatDateTime(date: FechaCruda): string {
  const convertedDate = aFecha(date);

  return convertedDate.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Caracas',
  });
}

/**
 * Obtiene tiempo relativo (hace X minutos/horas/días)
 */
export function getRelativeTime(date: FechaCruda): string {
  const convertedDate = aFecha(date);
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - convertedDate.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return 'Hace un momento';
  if (diffInMinutes < 60) return `Hace ${diffInMinutes} min`;
  if (diffInMinutes < 1440) {
    const hours = Math.floor(diffInMinutes / 60);
    return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
  }

  const days = Math.floor(diffInMinutes / 1440);
  return `Hace ${days} día${days > 1 ? 's' : ''}`;
}

/**
 * Convierte fecha a timestamp para comparaciones
 */
export function getTimeValue(timeString: string): number {
  if (timeString.includes('momento')) return 0;
  if (timeString.includes('min'))
    return parseInt(timeString.match(/\d+/)?.[0] || '0');
  if (timeString.includes('hora'))
    return parseInt(timeString.match(/\d+/)?.[0] || '0') * 60;
  if (timeString.includes('día'))
    return parseInt(timeString.match(/\d+/)?.[0] || '0') * 1440;
  return 0;
}

/**
 * Verifica si una fecha está vencida
 */
export function isOverdue(date: FechaCruda): boolean {
  const convertedDate = aFecha(date);
  return convertedDate < new Date();
}

/**
 * Formatea fecha para inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: FechaCruda): string {
  const convertedDate = aFecha(date);
  // Evitar que toISOString() (que es UTC) corra el dia a la fecha anterior/siguiente
  // para timezones < UTC como Venezuela. Formateamos explicitamente en America/Caracas.
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Caracas',
  }).format(convertedDate);
  return parts;
}

/**
 * Obtiene el inicio del día para comparaciones
 */
export function getStartOfDay(date: FechaCruda): Date {
  const convertedDate = aFecha(date);
  const startOfDay = new Date(convertedDate);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
}

/**
 * Obtiene el final del día para comparaciones
 */
export function getEndOfDay(date: FechaCruda): Date {
  const convertedDate = aFecha(date);
  const endOfDay = new Date(convertedDate);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * Obtiene rangos de fechas predefinidos para filtros
 */
export function getDateRange(filter: string): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const today = new Date(now);

  switch (filter) {
    case 'today':
      return {
        startDate: getStartOfDay(today),
        endDate: getEndOfDay(today),
      };

    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: getStartOfDay(yesterday),
        endDate: getEndOfDay(yesterday),
      };

    case 'this_week': {
      // "Esta semana": desde el lunes de la semana actual hasta hoy.
      const startOfWeek = new Date(today);
      const diffToMonday = (startOfWeek.getDay() + 6) % 7; // 0 = lunes
      startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
      return {
        startDate: getStartOfDay(startOfWeek),
        endDate: getEndOfDay(today),
      };
    }

    case 'last_week':
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return {
        startDate: getStartOfDay(lastWeek),
        endDate: getEndOfDay(today),
      };

    case 'last_two_weeks':
      const twoWeeksAgo = new Date(today);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      return {
        startDate: getStartOfDay(twoWeeksAgo),
        endDate: getEndOfDay(today),
      };

    case 'this_month':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: getStartOfDay(startOfMonth),
        endDate: getEndOfDay(today),
      };

    case 'last_month':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: getStartOfDay(lastMonth),
        endDate: getEndOfDay(endOfLastMonth),
      };

    default:
      // Por defecto, devuelve el día de hoy
      return {
        startDate: getStartOfDay(today),
        endDate: getEndOfDay(today),
      };
  }
}

/**
 * Filtra órdenes por rango de fechas
 */
export function filterOrdersByDateRange(
  orders: Array<{ createdAt?: FechaCruda }>,
  startDate: Date,
  endDate: Date,
) {
  return orders.filter((order) => {
    const orderDate = aFecha(order.createdAt);
    return orderDate >= startDate && orderDate <= endDate;
  });
}

/**
 * El rango de un filtro de fecha, listo para mandárselo al SERVIDOR.
 *
 * Existe por una regresión concreta y mía: al ponerle tope a `GET /api/orders`
 * (defecto 500 de un techo duro de 2.000), las pantallas que se bajaban TODAS
 * las órdenes y filtraban por fecha en el navegador pasaron a ver solo las 500
 * más recientes. Sobre 4.766 órdenes eso son unas pocas semanas: un reporte de
 * un mes viejo saldría **incompleto o en cero**, sin un solo error en pantalla.
 *
 * El recorte tiene que ir donde están los datos. Estas dos funciones traducen
 * el filtro que ya elige el usuario a `from`/`to` para la consulta, y el filtro
 * del navegador se conserva como red: contra el servidor nuevo no descarta
 * nada, y si algún día la consulta devolviera de más, la pantalla sigue
 * mostrando lo correcto.
 */
export function rangoParaElServidor(
  dateFilter: string,
  customDate: string,
): { from: string; to: string } {
  if (dateFilter === 'custom') {
    const elegida = new Date(customDate + 'T00:00:00');
    return {
      from: getStartOfDay(elegida).toISOString(),
      to: getEndOfDay(elegida).toISOString(),
    };
  }
  const { startDate, endDate } = getDateRange(dateFilter);
  return { from: startDate.toISOString(), to: endDate.toISOString() };
}
