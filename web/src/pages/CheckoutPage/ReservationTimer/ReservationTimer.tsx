import { useEffect, useRef, useState } from 'react';
import {
  formatReservationTime,
  getReservationRemainingMs,
} from '~/lib/reservation';

export type ReservationTimerProps = {
  expiresAt: string;
  onExpired: () => void;
};

export function ReservationTimer({
  expiresAt,
  onExpired,
}: ReservationTimerProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    getReservationRemainingMs(expiresAt),
  );
  const expirationNotified = useRef(false);

  useEffect(() => {
    const updateRemaining = () => {
      const remaining = getReservationRemainingMs(expiresAt);
      setRemainingMs(remaining);

      if (remaining === 0 && !expirationNotified.current) {
        expirationNotified.current = true;
        onExpired();
      }
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => window.clearInterval(interval);
  }, [expiresAt, onExpired]);

  const expired = remainingMs === 0;

  return (
    <div
      className={`absolute right-6 top-6 rounded-xl px-3 py-2 text-right ring-1 ${
        expired
          ? 'bg-red-50 text-red-800 ring-red-200'
          : 'bg-paper text-ink ring-black/10'
      }`}
      aria-live="polite"
    >
      <p className="text-[10px] uppercase tracking-wider">
        {expired ? 'Reserva expirada' : 'Reserva disponible'}
      </p>
      <p className="mt-0.5 font-semibold tabular-nums">
        {expired ? '0:00' : formatReservationTime(remainingMs)}
      </p>
    </div>
  );
}
