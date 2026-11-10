export type TicketType = {
  id: string;
  name: string;
  priceCents: number;
  remaining: number;
  maxPerOrder: number;
};

export type EventRecord = {
  id: string;
  title: string;
  city: string;
  venue: string;
  startsAt: string;
  description: string;
  ticketTypes: TicketType[];
};

export type OrderStatus = 'pending' | 'confirmed' | 'expired';

export type OrderItem = {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type Buyer = {
  name: string;
  email: string;
};

export type Order = {
  id: string;
  eventId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
  buyer: Buyer | null;
  createdAt: string;
  expiresAt: string;
};

export function createCatalog(): EventRecord[] {
  return [
    {
      id: 'noche-salsa',
      title: 'Noche de Salsa en Quito',
      city: 'Quito',
      venue: 'Teatro Sucre',
      startsAt: '2026-11-14T01:00:00.000Z',
      description:
        'Una noche de salsa en vivo con orquesta invitada. Barra abierta después del concierto.',
      ticketTypes: [
        {
          id: 'salsa-general',
          name: 'General',
          priceCents: 2500,
          remaining: 40,
          maxPerOrder: 6,
        },
        {
          id: 'salsa-vip',
          name: 'VIP',
          priceCents: 6000,
          remaining: 8,
          maxPerOrder: 2,
        },
      ],
    },
    {
      id: 'indie-fest',
      title: 'Indie Fest Guayaquil',
      city: 'Guayaquil',
      venue: 'Malecón 2000',
      startsAt: '2026-12-05T21:00:00.000Z',
      description:
        'Festival al aire libre con bandas independientes de la costa y la sierra.',
      ticketTypes: [
        {
          id: 'indie-early',
          name: 'Early bird',
          priceCents: 1500,
          remaining: 0,
          maxPerOrder: 4,
        },
        {
          id: 'indie-general',
          name: 'General',
          priceCents: 2000,
          remaining: 120,
          maxPerOrder: 8,
        },
      ],
    },
    {
      id: 'standup-uio',
      title: 'Stand-up en La Floresta',
      city: 'Quito',
      venue: 'Casa de la Música (sala pequeña)',
      startsAt: '2026-10-03T01:30:00.000Z',
      description: 'Tres cómicos, un solo micrófono. Cupos limitados.',
      ticketTypes: [
        {
          id: 'standup-mesa',
          name: 'Mesa',
          priceCents: 1800,
          remaining: 25,
          maxPerOrder: 4,
        },
      ],
    },
  ];
}

export type AppStore = {
  events: EventRecord[];
  orders: Map<string, Order>;
};

export function createStore(events: EventRecord[] = createCatalog()): AppStore {
  return {
    events: structuredClone(events),
    orders: new Map(),
  };
}

/** Process-wide store used by the running API. Tests should call createStore(). */
export const appStore = createStore();
