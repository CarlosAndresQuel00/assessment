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

export type TicketSelection = {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type CheckoutState = {
  eventId: string;
  eventTitle: string;
  items: TicketSelection[];
};
