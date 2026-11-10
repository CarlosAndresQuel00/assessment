import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createStore } from '../store/store';
import { APP_STORE } from '../store/store.constants';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let store: ReturnType<typeof createStore>;

  beforeEach(async () => {
    store = createStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: APP_STORE, useValue: store },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('creates a pending order with subtotal, 10% fee, and total in cents', () => {
      const order = service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-general', quantity: 2 }],
      });

      expect(order.status).toBe('pending');
      expect(order.buyer).toBeNull();
      expect(Date.parse(order.expiresAt) - Date.parse(order.createdAt)).toBe(
        15 * 60 * 1000,
      );
      expect(order.items).toEqual([
        {
          ticketTypeId: 'salsa-general',
          name: 'General',
          quantity: 2,
          unitPriceCents: 2500,
          lineTotalCents: 5000,
        },
      ]);
      expect(order.subtotalCents).toBe(5000);
      expect(order.feeCents).toBe(500);
      expect(order.totalCents).toBe(5500);
    });

    it('computes the 10% fee with integer math (not floating-point prices)', () => {
      const order = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });

      expect(order.subtotalCents).toBe(1800);
      expect(order.feeCents).toBe(180);
      expect(order.totalCents).toBe(1980);
    });

    it('sums multiple ticket types into the subtotal, fee, and total', () => {
      const order = service.create({
        eventId: 'noche-salsa',
        items: [
          { ticketTypeId: 'salsa-general', quantity: 2 },
          { ticketTypeId: 'salsa-vip', quantity: 1 },
        ],
      });

      expect(order.subtotalCents).toBe(11000);
      expect(order.feeCents).toBe(1100);
      expect(order.totalCents).toBe(12100);
      expect(order.status).toBe('pending');
    });

    it('rounds the fee and keeps every amount in integer cents', () => {
      const ticketType = store.events
        .find((event) => event.id === 'standup-uio')
        ?.ticketTypes.find((type) => type.id === 'standup-mesa');

      if (!ticketType) {
        throw new Error('Expected standup-mesa fixture');
      }

      ticketType.priceCents = 1005;

      const order = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });

      expect(order.subtotalCents).toBe(1005);
      expect(order.feeCents).toBe(101);
      expect(order.totalCents).toBe(1106);
      expect(Number.isInteger(order.subtotalCents)).toBe(true);
      expect(Number.isInteger(order.feeCents)).toBe(true);
      expect(Number.isInteger(order.totalCents)).toBe(true);
    });

    it('decrements remaining inventory', () => {
      service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
      });

      const vip = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-vip');

      expect(vip?.remaining).toBe(6);
    });

    it('rejects when a ticket type is sold out', () => {
      expect(() =>
        service.create({
          eventId: 'indie-fest',
          items: [{ ticketTypeId: 'indie-early', quantity: 1 }],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when quantity exceeds remaining', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [{ ticketTypeId: 'salsa-vip', quantity: 9 }],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects when quantity exceeds maxPerOrder', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [{ ticketTypeId: 'salsa-vip', quantity: 3 }],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects unknown events', () => {
      expect(() =>
        service.create({
          eventId: 'missing',
          items: [{ ticketTypeId: 'salsa-general', quantity: 1 }],
        }),
      ).toThrow(NotFoundException);
    });

    it('rejects unknown ticket types', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [{ ticketTypeId: 'nope', quantity: 1 }],
        }),
      ).toThrow(NotFoundException);
    });

    it('rejects empty items', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects quantities lower than one', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [{ ticketTypeId: 'salsa-general', quantity: 0 }],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects duplicate ticketTypeId values', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [
            { ticketTypeId: 'salsa-general', quantity: 1 },
            { ticketTypeId: 'salsa-general', quantity: 2 },
          ],
        }),
      ).toThrow(BadRequestException);
    });

    it('does not decrement inventory when any item is invalid', () => {
      expect(() =>
        service.create({
          eventId: 'noche-salsa',
          items: [
            { ticketTypeId: 'salsa-general', quantity: 1 },
            { ticketTypeId: 'salsa-vip', quantity: 3 },
          ],
        }),
      ).toThrow(BadRequestException);

      const general = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-general');

      expect(general?.remaining).toBe(40);
    });

    it('prevents overselling when requests compete for the last inventory', async () => {
      const vip = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-vip');

      if (!vip) {
        throw new Error('Expected salsa-vip fixture');
      }

      vip.remaining = 2;
      const request = () =>
        service.create({
          eventId: 'noche-salsa',
          items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
        });

      const results = await Promise.allSettled([
        Promise.resolve().then(request),
        Promise.resolve().then(request),
      ]);

      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected'),
      ).toMatchObject({
        reason: expect.any(BadRequestException),
      });
      expect(vip.remaining).toBe(0);
      expect(store.orders.size).toBe(1);
    });
  });

  describe('confirm', () => {
    it('marks a pending order as confirmed and stores the buyer', () => {
      const pending = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });

      const confirmed = service.confirm(pending.id, {
        name: 'Ana Pérez',
        email: 'ana@example.com',
      });

      expect(confirmed.status).toBe('confirmed');
      expect(confirmed.buyer).toEqual({
        name: 'Ana Pérez',
        email: 'ana@example.com',
      });
    });

    it('rejects unknown orders', () => {
      expect(() =>
        service.confirm('ord_missing', {
          name: 'Ana Pérez',
          email: 'ana@example.com',
        }),
      ).toThrow(NotFoundException);
    });

    it('rejects already confirmed orders', () => {
      const pending = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });

      service.confirm(pending.id, {
        name: 'Ana Pérez',
        email: 'ana@example.com',
      });

      expect(() =>
        service.confirm(pending.id, {
          name: 'Otra Persona',
          email: 'otra@example.com',
        }),
      ).toThrow(BadRequestException);
    });

    it('keeps the ticket reservation when confirming or retrying confirmation', () => {
      const pending = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 2 }],
      });
      const ticketType = store.events
        .find((event) => event.id === 'standup-uio')
        ?.ticketTypes.find((type) => type.id === 'standup-mesa');

      service.confirm(pending.id, {
        name: 'Ana Pérez',
        email: 'ana@example.com',
      });

      expect(() =>
        service.confirm(pending.id, {
          name: 'Otra Persona',
          email: 'otra@example.com',
        }),
      ).toThrow(BadRequestException);
      expect(ticketType?.remaining).toBe(23);
      expect(store.orders.size).toBe(1);
    });
  });

  describe('expiration', () => {
    const now = new Date('2026-11-10T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    it('expires a pending order after 15 minutes and restores inventory', () => {
      const order = service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
      });
      const vip = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-vip');

      expect(order.expiresAt).toBe('2026-11-10T12:15:00.000Z');
      expect(vip?.remaining).toBe(6);

      jest.advanceTimersByTime(15 * 60 * 1000 - 1);

      expect(order.status).toBe('pending');
      expect(vip?.remaining).toBe(6);

      jest.advanceTimersByTime(1);

      expect(order.status).toBe('expired');
      expect(vip?.remaining).toBe(8);
    });

    it('releases inventory only once', () => {
      const order = service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
      });
      const vip = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-vip');

      jest.advanceTimersByTime(15 * 60 * 1000);
      service.findById(order.id);
      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(order.status).toBe('expired');
      expect(vip?.remaining).toBe(8);
    });

    it('expires an overdue order when it is queried before its timer runs', () => {
      const order = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 2 }],
      });
      const ticketType = store.events
        .find((event) => event.id === 'standup-uio')
        ?.ticketTypes.find((type) => type.id === 'standup-mesa');

      jest.setSystemTime(new Date('2026-11-10T12:15:00.000Z'));

      expect(service.findById(order.id).status).toBe('expired');
      expect(ticketType?.remaining).toBe(25);
    });

    it('recovers expired inventory before checking a new order', () => {
      const vip = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-vip');

      if (!vip) {
        throw new Error('Expected salsa-vip fixture');
      }

      vip.remaining = 2;
      const expired = service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
      });
      jest.setSystemTime(new Date('2026-11-10T12:15:00.000Z'));

      const replacement = service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
      });

      expect(expired.status).toBe('expired');
      expect(replacement.status).toBe('pending');
      expect(vip.remaining).toBe(0);
    });

    it('does not oversell released inventory when requests compete after expiration', async () => {
      const vip = store.events
        .find((event) => event.id === 'noche-salsa')
        ?.ticketTypes.find((type) => type.id === 'salsa-vip');

      if (!vip) {
        throw new Error('Expected salsa-vip fixture');
      }

      vip.remaining = 2;
      const expired = service.create({
        eventId: 'noche-salsa',
        items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
      });
      jest.setSystemTime(new Date('2026-11-10T12:15:00.000Z'));

      const request = () =>
        service.create({
          eventId: 'noche-salsa',
          items: [{ ticketTypeId: 'salsa-vip', quantity: 2 }],
        });
      const results = await Promise.allSettled([
        Promise.resolve().then(request),
        Promise.resolve().then(request),
      ]);

      expect(expired.status).toBe('expired');
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      expect(vip.remaining).toBe(0);
      expect(vip.remaining).toBeGreaterThanOrEqual(0);
    });

    it('serializes confirmation and expiration scheduled for the same instant', () => {
      let order!: ReturnType<OrdersService['create']>;
      let confirmationError: unknown;

      // Register this callback first so both possible timer orderings are
      // covered: confirm() still enforces the deadline synchronously.
      setTimeout(() => {
        try {
          service.confirm(order.id, {
            name: 'Ana Pérez',
            email: 'ana@example.com',
          });
        } catch (error) {
          confirmationError = error;
        }
      }, 15 * 60 * 1000);

      order = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });
      const ticketType = store.events
        .find((event) => event.id === 'standup-uio')
        ?.ticketTypes.find((type) => type.id === 'standup-mesa');

      jest.advanceTimersByTime(15 * 60 * 1000);

      expect(confirmationError).toBeInstanceOf(BadRequestException);
      expect(order.status).toBe('expired');
      expect(ticketType?.remaining).toBe(25);

      jest.runOnlyPendingTimers();
      expect(ticketType?.remaining).toBe(25);
    });

    it('rejects confirmation at the deadline and releases inventory', () => {
      const order = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });
      const ticketType = store.events
        .find((event) => event.id === 'standup-uio')
        ?.ticketTypes.find((type) => type.id === 'standup-mesa');

      // Move the clock without running the timer to exercise the synchronous
      // deadline check performed by confirm().
      jest.setSystemTime(new Date('2026-11-10T12:15:00.000Z'));

      expect(() =>
        service.confirm(order.id, {
          name: 'Ana Pérez',
          email: 'ana@example.com',
        }),
      ).toThrow(
        new BadRequestException(
          'La orden expiró y las entradas reservadas fueron liberadas',
        ),
      );
      expect(order.status).toBe('expired');
      expect(ticketType?.remaining).toBe(25);
    });

    it('does not expire or release an order confirmed before the deadline', () => {
      const order = service.create({
        eventId: 'standup-uio',
        items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
      });
      const ticketType = store.events
        .find((event) => event.id === 'standup-uio')
        ?.ticketTypes.find((type) => type.id === 'standup-mesa');

      jest.advanceTimersByTime(15 * 60 * 1000 - 1);
      service.confirm(order.id, {
        name: 'Ana Pérez',
        email: 'ana@example.com',
      });
      jest.advanceTimersByTime(1);

      expect(order.status).toBe('confirmed');
      expect(ticketType?.remaining).toBe(24);
    });
  });
});
