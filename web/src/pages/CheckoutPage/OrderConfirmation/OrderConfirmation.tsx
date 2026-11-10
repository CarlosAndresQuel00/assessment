import { useEffect, useRef } from 'react';
import {
  ConfirmOrderBody,
  confirmOrder,
  useApiMutation,
} from '~/api';
import { Order } from '~/types';

export type OrderConfirmationProps = {
  orderId: string;
  expiresAt: string;
  buyer: ConfirmOrderBody;
  expired: boolean;
  onConfirmed: (order: Order) => void;
};

export function OrderConfirmation({
  orderId,
  expiresAt,
  buyer,
  expired,
  onConfirmed,
}: OrderConfirmationProps) {
  const started = useRef(false);
  const { mutate, isPending, error } = useApiMutation<
    Order,
    { id: string },
    ConfirmOrderBody
  >(confirmOrder, { id: orderId }, { onSuccess: onConfirmed });

  useEffect(() => {
    if (
      started.current ||
      expired ||
      Date.now() >= Date.parse(expiresAt)
    ) {
      return;
    }

    started.current = true;
    mutate(buyer);
  }, [buyer, expired, expiresAt, mutate]);

  const apiReportedExpiration = Boolean(
    error && /expir/i.test(error.message),
  );

  if (expired || apiReportedExpiration) {
    return (
      <div
        role="alert"
        className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <p className="font-medium">La reserva {orderId} expiró.</p>
        <p className="mt-1">
          Las entradas fueron liberadas. Vuelve al evento para iniciar una
          compra nueva.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <p className="font-medium">
          La orden {orderId} fue creada, pero no pudimos confirmarla.
        </p>
        <p className="mt-1">{error.message}</p>
        <p className="mt-1">No crearemos otra orden al reintentar.</p>
        <button
          type="button"
          disabled={isPending}
          className="mt-2 font-medium underline disabled:opacity-50"
          onClick={() => mutate(buyer)}
        >
          {isPending ? 'Reintentando…' : 'Reintentar confirmación'}
        </button>
      </div>
    );
  }

  return (
    <p className="mt-4 text-sm text-ink/60" aria-live="polite">
      {isPending ? 'Confirmando tu orden…' : 'Preparando confirmación…'}
    </p>
  );
}
