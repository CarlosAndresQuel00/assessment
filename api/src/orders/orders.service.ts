import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { APP_STORE } from '../store/store.constants';
import { AppStore, Order, TicketType } from '../store/store';

/** Service fee applied on top of the ticket subtotal. */
const SERVICE_FEE_PERCENT = 10;

@Injectable()
export class OrdersService {
  constructor(@Inject(APP_STORE) private readonly store: AppStore) {}

  /** Creates a pending order and holds inventory. */
  create(dto: CreateOrderDto): Order {
    this.validateItems(dto.items);

    const event = this.store.events.find((item) => item.id === dto.eventId);

    if (!event) {
      throw new NotFoundException('Evento no encontrado');
    }

    const ticketTypes = dto.items.map((line) => {
      const ticketType = event.ticketTypes.find(
        (type) => type.id === line.ticketTypeId,
      );

      if (!ticketType) {
        throw new NotFoundException(
          `Tipo de entrada no encontrado: ${line.ticketTypeId}`,
        );
      }

      this.validateAvailability(ticketType, line.quantity);
      return ticketType;
    });

    const items = dto.items.map((line, index) => {
      const ticketType = ticketTypes[index];
      return {
        ticketTypeId: ticketType.id,
        name: ticketType.name,
        quantity: line.quantity,
        unitPriceCents: ticketType.priceCents,
        lineTotalCents: ticketType.priceCents * line.quantity,
      };
    });

    const subtotalCents = items.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );

    const feeCents = Math.round(
      (subtotalCents * SERVICE_FEE_PERCENT) / 100,
    );

    const order: Order = {
      id: `ord_${randomUUID()}`,
      eventId: event.id,
      status: 'pending',
      items,
      subtotalCents,
      feeCents,
      totalCents: subtotalCents + feeCents,
      buyer: null,
      createdAt: new Date().toISOString(),
    };

    // Keep the availability check and reservation in the same synchronous
    // operation so concurrent requests cannot interleave and oversell stock.
    ticketTypes.forEach((ticketType, index) => {
      ticketType.remaining -= dto.items[index].quantity;
    });
    this.store.orders.set(order.id, order);
    return order;
  }

  findById(id: string): Order {
    const order = this.store.orders.get(id);

    if (!order) {
      throw new NotFoundException('Orden no encontrada');
    }

    return order;
  }

  confirm(id: string, dto: ConfirmOrderDto): Order {
    const order = this.findById(id);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        'Solo se pueden confirmar órdenes pendientes',
      );
    }

    order.status = 'confirmed';
    order.buyer = { name: dto.name, email: dto.email };
    return order;
  }

  private validateItems(items: CreateOrderDto['items']): void {
    if (items.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos una localidad',
      );
    }

    const ticketTypeIds = new Set<string>();

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException(
          `La cantidad para ${item.ticketTypeId} debe ser un entero mayor o igual a 1`,
        );
      }

      if (ticketTypeIds.has(item.ticketTypeId)) {
        throw new BadRequestException(
          `El tipo de entrada ${item.ticketTypeId} está duplicado`,
        );
      }

      ticketTypeIds.add(item.ticketTypeId);
    }
  }

  private validateAvailability(ticketType: TicketType, quantity: number): void {
    if (quantity > ticketType.remaining) {
      throw new BadRequestException(
        `No hay suficientes entradas ${ticketType.name}: quedan ${ticketType.remaining}`,
      );
    }

    if (quantity > ticketType.maxPerOrder) {
      throw new BadRequestException(
        `Puedes comprar máximo ${ticketType.maxPerOrder} entradas ${ticketType.name} por orden`,
      );
    }
  }
}
