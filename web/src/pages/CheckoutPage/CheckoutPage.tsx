import { yupResolver } from '@hookform/resolvers/yup';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import * as yup from 'yup';
import {
  ConfirmOrderBody,
  CreateOrderBody,
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

type PendingConfirmation = {
  orderId: string;
  expiresAt: string;
  buyer: ConfirmOrderBody;
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
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [reservationExpired, setReservationExpired] = useState(false);
  const onReservationExpired = useCallback(() => {
    setReservationExpired(true);
  }, []);
  const [createError, setCreateError] = useState<string | null>(null);
  const createMutation = useApiMutation<
    Order,
    Record<string, never>,
    CreateOrderBody
  >(createOrder);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: isFormSubmitting },
  } = useForm<ConfirmOrderBody>({
    resolver: yupResolver(checkoutSchema),
    defaultValues: { name: '', email: '' },
  });

  if (!selection?.items.length) {
    return <Navigate to="/" replace />;
  }

  if (isEventPending || isEventFetching) {
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

  const items = resolveTicketSelections(
    event,
    selection.items.map(({ ticketTypeId, quantity }) => ({
      ticketTypeId,
      quantity,
    })),
  );
  const { subtotalCents, feeCents, totalCents } =
    calculateCheckoutTotals(items);
  const availabilityError = getTicketAvailabilityError(event, items);
  const isSubmitting =
    isFormSubmitting ||
    createMutation.isPending ||
    Boolean(pendingConfirmation);

  if (items.length !== selection.items.length) {
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

  const onSubmit = handleSubmit(async (buyer) => {
    setCreateError(null);

    if (availabilityError) {
      setCreateError(availabilityError);
      return;
    }

    try {
      const order = await createMutation.mutateAsync({
        eventId: event.id,
        items: items.map(({ ticketTypeId, quantity }) => ({
          ticketTypeId,
          quantity,
        })),
      });

      setReservationExpired(false);
      setPendingConfirmation({
        orderId: order.id,
        expiresAt: order.expiresAt,
        buyer,
      });
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : 'No pudimos crear la orden. Intenta nuevamente.',
      );
    }
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
          {pendingConfirmation && (
            <ReservationTimer
              expiresAt={pendingConfirmation.expiresAt}
              onExpired={onReservationExpired}
            />
          )}
          <h1
            className={`text-2xl font-semibold tracking-tight ${
              pendingConfirmation ? 'pr-36' : ''
            }`}
          >
            Tus datos
          </h1>
          <p
            className={`mt-2 text-sm text-ink/70 ${
              pendingConfirmation ? 'pr-36' : ''
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

            {(availabilityError || createError) && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {availabilityError ?? createError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || Boolean(availabilityError)}
              className="w-full rounded-full bg-accent px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Procesando…'
                : availabilityError
                  ? 'Entradas no disponibles'
                  : `Pagar ${formatUsd(totalCents)}`}
            </button>
          </form>

          {pendingConfirmation && (
            <OrderConfirmation
              orderId={pendingConfirmation.orderId}
              expiresAt={pendingConfirmation.expiresAt}
              buyer={pendingConfirmation.buyer}
              expired={reservationExpired}
              onConfirmed={(order) => navigate(`/orders/${order.id}`)}
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
