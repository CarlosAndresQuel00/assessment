import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import * as yup from 'yup';
import {
  ConfirmOrderBody,
  CreateOrderBody,
  confirmOrder,
  createOrder,
  eventById,
  useApiMutation,
  useApiQuery,
} from '~/api';
import { OrderSummary } from '~/components';
import {
  calculateCheckoutTotals,
  getTicketAvailabilityError,
  resolveTicketSelections,
} from '~/lib/checkout';
import { formatUsd } from '~/lib/money';
import { CheckoutState, EventRecord, Order } from '~/types';
import { OrderConfirmation } from './OrderConfirmation';
import { ReservationTimer } from './ReservationTimer';

const checkoutSchema: yup.ObjectSchema<ConfirmOrderBody> = yup.object({
  name: yup.string().trim().required('El nombre es obligatorio'),
  email: yup
    .string()
    .trim()
    .email('Ingresa un correo electrónico válido')
    .required('El correo es obligatorio'),
});

type Reservation = {
  orderId: string;
  expiresAt: string;
};

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selection = location.state as CheckoutState | null;
  const eventId = selection?.eventId ?? '';
  const {
    data: event,
    isPending: isEventPending,
    isFetching: isEventFetching,
    isError: isEventError,
    error: eventError,
  } = useApiQuery<EventRecord>(
    eventById,
    { id: eventId },
    { enabled: Boolean(eventId) },
  );
  const reservationCreationStarted = useRef(false);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [reservationExpired, setReservationExpired] = useState(false);
  const onReservationExpired = useCallback(() => {
    setReservationExpired(true);
  }, []);
  const [createError, setCreateError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const createMutation = useApiMutation<
    Order,
    Record<string, never>,
    CreateOrderBody
  >(createOrder);
  const confirmArgs = useMemo(
    () => ({ id: reservation?.orderId ?? '' }),
    [reservation?.orderId],
  );
  const confirmMutation = useApiMutation<
    Order,
    { id: string },
    ConfirmOrderBody
  >(confirmOrder, confirmArgs, {
    onSuccess: (order) => navigate(`/orders/${order.id}`),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<ConfirmOrderBody>({
    resolver: yupResolver(checkoutSchema),
    defaultValues: { name: '', email: '' },
  });
  const items = useMemo(
    () =>
      event && selection
        ? resolveTicketSelections(
            event,
            selection.items.map(({ ticketTypeId, quantity }) => ({
              ticketTypeId,
              quantity,
            })),
          )
        : [],
    [event, selection],
  );
  const availabilityError = event
    ? getTicketAvailabilityError(event, items)
    : null;
  const selectionIsCurrent = Boolean(
    selection && items.length === selection.items.length,
  );
  const { mutate: createReservation, isPending: isCreatingReservation } =
    createMutation;
  const startReservation = useCallback(() => {
    if (
      !event ||
      !selectionIsCurrent ||
      availabilityError ||
      reservationCreationStarted.current
    ) {
      return;
    }

    reservationCreationStarted.current = true;
    setCreateError(null);
    createReservation(
      {
        eventId: event.id,
        items: items.map(({ ticketTypeId, quantity }) => ({
          ticketTypeId,
          quantity,
        })),
      },
      {
        onSuccess: (order) => {
          setReservationExpired(false);
          setReservation({
            orderId: order.id,
            expiresAt: order.expiresAt,
          });
        },
        onError: (error) => {
          reservationCreationStarted.current = false;
          setCreateError(error.message);
        },
      },
    );
  }, [
    availabilityError,
    createReservation,
    event,
    items,
    selectionIsCurrent,
  ]);

  useEffect(() => {
    if (!isEventFetching) startReservation();
  }, [isEventFetching, startReservation]);

  if (!selection?.items.length) {
    return <Navigate to="/" replace />;
  }

  if (isEventPending) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 text-ink/60">
        Cargando checkout…
      </main>
    );
  }

  if (isEventError || !event) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p>No pudimos cargar el evento para completar la compra.</p>
        <p className="mt-2 text-sm text-ink/60">{eventError?.message}</p>
        <Link to="/" className="mt-4 inline-block text-accent">
          Volver a eventos
        </Link>
      </main>
    );
  }

  const { subtotalCents, feeCents, totalCents } =
    calculateCheckoutTotals(items);
  const activeAvailabilityError = reservation ? null : availabilityError;
  const isSubmitting =
    isFormSubmitting ||
    isCreatingReservation ||
    confirmMutation.isPending;

  if (!selectionIsCurrent) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p>Una de las entradas seleccionadas ya no está disponible.</p>
        <Link
          to={`/events/${event.id}`}
          className="mt-4 inline-block text-accent"
        >
          Volver a elegir entradas
        </Link>
      </main>
    );
  }

  const onSubmit = handleSubmit((buyer) => {
    setConfirmationError(null);

    if (activeAvailabilityError) {
      setCreateError(activeAvailabilityError);
      return;
    }

    if (!reservation) {
      setCreateError('Espera a que la reserva esté lista antes de confirmar.');
      return;
    }

    if (reservationExpired) {
      setConfirmationError(
        'La reserva expiró. Vuelve al evento para seleccionar entradas nuevamente.',
      );
      return;
    }

    confirmMutation.mutate(buyer, {
      onError: (error) => setConfirmationError(error.message),
    });
  });
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link
        to={`/events/${event.id}`}
        className="text-sm text-ink/60"
      >
        ← Volver al evento
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[1fr_280px]">
        <section className="relative rounded-2xl bg-white p-6 ring-1 ring-black/5">
          {reservation && (
            <ReservationTimer
              expiresAt={reservation.expiresAt}
              onExpired={onReservationExpired}
            />
          )}
          <h1
            className={`text-2xl font-semibold tracking-tight ${
              reservation ? 'pr-36' : ''
            }`}
          >
            Tus datos
          </h1>
          <p
            className={`mt-2 text-sm text-ink/70 ${
              reservation ? 'pr-36' : ''
            }`}
          >
            Completa el checkout para{' '}
            <strong>{event.title}</strong>.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="name" className="text-sm font-medium">
                Nombre completo
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'name-error' : undefined}
                disabled={isSubmitting}
                {...register('name')}
                className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-paper"
              />
              {errors.name && (
                <p id="name-error" className="mt-1 text-sm text-red-700">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                disabled={isSubmitting}
                {...register('email')}
                className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-paper"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-700">
                  {errors.email.message}
                </p>
              )}
            </div>

            {(activeAvailabilityError || createError) && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <p>{activeAvailabilityError ?? createError}</p>
                {!activeAvailabilityError &&
                  !reservation &&
                  !isCreatingReservation && (
                    <button
                      type="button"
                      className="mt-2 font-medium underline"
                      onClick={startReservation}
                    >
                      Reintentar reserva
                    </button>
                  )}
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                !reservation ||
                reservationExpired ||
                Boolean(activeAvailabilityError)
              }
              className="w-full rounded-full bg-accent px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreatingReservation
                ? 'Preparando reserva…'
                : confirmMutation.isPending
                  ? 'Confirmando compra…'
                  : reservationExpired
                    ? 'Reserva expirada'
                    : activeAvailabilityError
                      ? 'Entradas no disponibles'
                      : !reservation
                        ? 'Preparando reserva…'
                        : `Pagar ${formatUsd(totalCents)}`}
            </button>
          </form>

          {confirmationError && (
            <OrderConfirmation
              orderId={reservation?.orderId ?? 'pendiente'}
              error={confirmationError}
              canRetry={Boolean(reservation && !reservationExpired)}
            />
          )}
        </section>

        <aside className="h-max rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <OrderSummary
            items={items}
            subtotalCents={subtotalCents}
            feeCents={feeCents}
            totalCents={totalCents}
          />
        </aside>
      </div>
    </main>
  );
}
