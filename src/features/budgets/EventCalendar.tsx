'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarEvent } from '@odin6/types';
import { PRIVATE_ROUTES } from '@/shared/constantsRoutes/routes';

interface Props {
  events: CalendarEvent[];
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function EventCalendar({ events }: Props) {
  const router = useRouter();
  const [current, setCurrent] = useState(new Date());

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    events.filter((e) => isSameDay(new Date(e.eventDate), day));

  return (
    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-line">
        <button
          onClick={() => setCurrent(subMonths(current, 1))}
          className="p-2 rounded-xl hover:bg-elevated transition-colors text-dim hover:text-content"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="font-semibold text-content text-lg capitalize">
          {format(current, 'MMMM yyyy', { locale: es })}
        </h2>
        <button
          onClick={() => setCurrent(addMonths(current, 1))}
          className="p-2 rounded-xl hover:bg-elevated transition-colors text-dim hover:text-content"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-line">
        {DAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-dim uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isCurrentMonth = isSameMonth(day, current);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={idx}
              className={`min-h-[90px] p-1.5 border-b border-r border-line/50 ${
                !isCurrentMonth ? 'bg-elevated/20' : ''
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 text-sm rounded-full mb-1 ${
                  isToday
                    ? 'bg-brand text-on-brand font-bold'
                    : isCurrentMonth
                      ? 'text-content'
                      : 'text-dim'
                }`}
              >
                {format(day, 'd')}
              </span>

              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() =>
                    router.push(PRIVATE_ROUTES.BUDGETS_DETAILS(ev.id))
                  }
                  className="w-full text-left mb-1 px-2 py-1 rounded-lg bg-ok/15 border border-ok/30 hover:bg-ok/25 transition-colors"
                >
                  <p className="text-xs font-medium text-ok truncate leading-tight">
                    {ev.eventName}
                  </p>
                  <p className="text-[10px] text-ok/70 truncate">
                    {ev.customerName}
                  </p>
                  <div className="flex justify-between text-[10px] text-ok/70 mt-0.5">
                    <span>${ev.total.toFixed(0)}</span>
                    {ev.abonoAmount ? (
                      <span>Abono: ${ev.abonoAmount.toFixed(0)}</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
