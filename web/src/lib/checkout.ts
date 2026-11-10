import { feeFromSubtotal } from './money.ts';
import type { EventRecord, TicketSelection } from '../types.ts';

export type RequestedTicket = Pick<
  TicketSelection,
  'ticketTypeId' | 'quantity'
>;

export type CheckoutTotals = {
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
};

export function resolveTicketSelections(
  event: EventRecord,
  requestedTickets: RequestedTicket[],
): TicketSelection[] {
  const ticketTypes = new Map(
    event.ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
  );

  return requestedTickets.flatMap(({ ticketTypeId, quantity }) => {
    const ticketType = ticketTypes.get(ticketTypeId);

    if (!ticketType) return [];

    return {
      ticketTypeId,
      name: ticketType.name,
      quantity,
      unitPriceCents: ticketType.priceCents,
    };
  });
}

export function calculateCheckoutTotals(
  items: TicketSelection[],
): CheckoutTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.unitPriceCents * item.quantity,
    0,
  );
  const feeCents = feeFromSubtotal(subtotalCents);

  return {
    subtotalCents,
    feeCents,
    totalCents: subtotalCents + feeCents,
  };
}

export function getTicketAvailabilityError(
  event: EventRecord,
  items: TicketSelection[],
): string | null {
  const ticketTypes = new Map(
    event.ticketTypes.map((ticketType) => [ticketType.id, ticketType]),
  );

  for (const item of items) {
    const ticketType = ticketTypes.get(item.ticketTypeId);

    if (!ticketType) continue;

    if (item.quantity > ticketType.remaining) {
      return ticketType.remaining === 0
        ? `${ticketType.name} está agotada`
        : `Solo quedan ${ticketType.remaining} entradas ${ticketType.name}`;
    }

    if (item.quantity > ticketType.maxPerOrder) {
      return `Puedes comprar máximo ${ticketType.maxPerOrder} entradas ${ticketType.name}`;
    }
  }

  return null;
}
