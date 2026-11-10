import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCheckoutTotals,
  getTicketAvailabilityError,
  resolveTicketSelections,
} from './checkout.ts';

const event = {
  id: 'evento',
  title: 'Evento',
  city: 'Quito',
  venue: 'Teatro',
  startsAt: '2026-11-14T01:00:00.000Z',
  description: 'Descripción',
  ticketTypes: [
    {
      id: 'general',
      name: 'General actualizada',
      priceCents: 1005,
      remaining: 10,
      maxPerOrder: 4,
    },
    {
      id: 'vip',
      name: 'VIP',
      priceCents: 2500,
      remaining: 5,
      maxPerOrder: 2,
    },
  ],
};

test('resolves selected tickets with current catalog data', () => {
  const items = resolveTicketSelections(event, [
    { ticketTypeId: 'general', quantity: 2 },
  ]);

  assert.deepEqual(items, [
    {
      ticketTypeId: 'general',
      name: 'General actualizada',
      quantity: 2,
      unitPriceCents: 1005,
    },
  ]);
});

test('calculates subtotal, rounded fee, and total in integer cents', () => {
  const items = resolveTicketSelections(event, [
    { ticketTypeId: 'general', quantity: 1 },
    { ticketTypeId: 'vip', quantity: 2 },
  ]);
  const totals = calculateCheckoutTotals(items);

  assert.deepEqual(totals, {
    subtotalCents: 6005,
    feeCents: 601,
    totalCents: 6606,
  });
  assert.equal(Number.isInteger(totals.subtotalCents), true);
  assert.equal(Number.isInteger(totals.feeCents), true);
  assert.equal(Number.isInteger(totals.totalCents), true);
});

test('detects sold-out or insufficient inventory before submitting', () => {
  const soldOutEvent = {
    ...event,
    ticketTypes: event.ticketTypes.map((ticketType) =>
      ticketType.id === 'general'
        ? { ...ticketType, remaining: 0 }
        : ticketType,
    ),
  };
  const items = resolveTicketSelections(soldOutEvent, [
    { ticketTypeId: 'general', quantity: 1 },
  ]);

  assert.equal(
    getTicketAvailabilityError(soldOutEvent, items),
    'General actualizada está agotada',
  );
  assert.equal(getTicketAvailabilityError(event, items), null);
});
