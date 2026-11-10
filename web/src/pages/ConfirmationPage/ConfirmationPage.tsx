import { Link, useParams } from 'react-router';
import { eventById, orderById, useApiQuery } from '~/api';
import { OrderSummary } from '~/components';
import { EventRecord, Order } from '~/types';

export function ConfirmationPage() {
  const { orderId = '' } = useParams();
  const {
    data: order,
    isPending,
    isError,
    error,
  } = useApiQuery<Order>(
    orderById,
    { id: orderId },
    { enabled: Boolean(orderId) },
  );
  const { data: event } = useApiQuery<EventRecord>(
    eventById,
    { id: order?.eventId ?? '' },
    { enabled: Boolean(order?.eventId) },
  );

  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-ink/60">
        Cargando tu orden…
      </main>
    );
  }

  if (isError || !order) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          No encontramos esta orden
        </h1>
        <p className="mt-3 text-ink/70">
          {error?.message ?? 'Revisa el enlace e intenta nuevamente.'}
        </p>
        <Link to="/" className="mt-8 inline-block text-accent">
          Volver a eventos
        </Link>
      </main>
    );
  }

  const confirmed = order.status === 'confirmed';
  const expired = order.status === 'expired';
  const statusLabel = confirmed
    ? 'Compra confirmada'
    : expired
      ? 'Reserva expirada'
      : 'Orden pendiente';
  const heading = confirmed
    ? '¡Gracias por tu compra!'
    : expired
      ? 'Esta reserva ya expiró'
      : 'Tu orden está pendiente';

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <section className="rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-8">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">
            {statusLabel}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {heading}
          </h1>
          <p className="mt-3 text-ink/70">
            {event?.title ?? order.eventId}
          </p>
          <p className="mt-2 text-xs text-ink/50">Orden {order.id}</p>
        </div>

        <div className="mt-8 grid gap-8 border-t border-black/10 pt-8 sm:grid-cols-[1fr_260px]">
          <div>
            <h2 className="font-semibold">Datos del comprador</h2>
            {order.buyer ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-ink/60">Nombre</dt>
                  <dd className="mt-0.5 font-medium">{order.buyer.name}</dd>
                </div>
                <div>
                  <dt className="text-ink/60">Correo electrónico</dt>
                  <dd className="mt-0.5 break-all font-medium">
                    {order.buyer.email}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-ink/60">
                La orden todavía no tiene comprador confirmado.
              </p>
            )}
          </div>

          <OrderSummary
            items={order.items}
            subtotalCents={order.subtotalCents}
            feeCents={order.feeCents}
            totalCents={order.totalCents}
          />
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm font-medium text-accent">
            Ver más eventos
          </Link>
        </div>
      </section>
    </main>
  );
}
