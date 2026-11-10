import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { AppModule } from '../app.module';

type JsonObject = Record<string, unknown>;

describe('Orders HTTP contract', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/v1`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function post(path: string, body: JsonObject): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('creates a pending order with the documented response shape', async () => {
    const response = await post('/orders', {
      eventId: 'noche-salsa',
      items: [{ ticketTypeId: 'salsa-general', quantity: 2 }],
    });
    const order = (await response.json()) as JsonObject;

    expect(response.status).toBe(201);
    expect(order).toMatchObject({
      eventId: 'noche-salsa',
      status: 'pending',
      items: [
        {
          ticketTypeId: 'salsa-general',
          name: 'General',
          quantity: 2,
          unitPriceCents: 2500,
          lineTotalCents: 5000,
        },
      ],
      subtotalCents: 5000,
      feeCents: 500,
      totalCents: 5500,
      buyer: null,
    });
    expect(order.id).toEqual(expect.stringMatching(/^ord_/));
    expect(order.createdAt).toEqual(expect.any(String));
  });

  it('returns HTTP 400 for sold-out tickets', async () => {
    const response = await post('/orders', {
      eventId: 'indie-fest',
      items: [{ ticketTypeId: 'indie-early', quantity: 1 }],
    });
    const error = (await response.json()) as JsonObject;

    expect(response.status).toBe(400);
    expect(error.message).toBe(
      'No hay suficientes entradas Early bird: quedan 0',
    );
  });

  it('validates buyer data and prevents duplicate confirmation', async () => {
    const createResponse = await post('/orders', {
      eventId: 'standup-uio',
      items: [{ ticketTypeId: 'standup-mesa', quantity: 1 }],
    });
    const pending = (await createResponse.json()) as JsonObject;
    const orderPath = `/orders/${pending.id as string}/confirm`;

    const invalidResponse = await post(orderPath, {
      name: '   ',
      email: 'correo-invalido',
    });
    expect(invalidResponse.status).toBe(400);

    const confirmResponse = await post(orderPath, {
      name: 'Ana Pérez',
      email: 'ana@example.com',
    });
    const confirmed = (await confirmResponse.json()) as JsonObject;

    expect(confirmResponse.status).toBe(201);
    expect(confirmed).toMatchObject({
      id: pending.id,
      status: 'confirmed',
      buyer: { name: 'Ana Pérez', email: 'ana@example.com' },
    });

    const duplicateResponse = await post(orderPath, {
      name: 'Otra Persona',
      email: 'otra@example.com',
    });
    const error = (await duplicateResponse.json()) as JsonObject;

    expect(duplicateResponse.status).toBe(400);
    expect(error.message).toBe(
      'Solo se pueden confirmar órdenes pendientes',
    );
  });

  it('returns HTTP 404 when confirming an unknown order', async () => {
    const response = await post('/orders/ord_missing/confirm', {
      name: 'Ana Pérez',
      email: 'ana@example.com',
    });
    const error = (await response.json()) as JsonObject;

    expect(response.status).toBe(404);
    expect(error.message).toBe('Orden no encontrada');
  });
});
