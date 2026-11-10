import assert from 'node:assert/strict';
import test from 'node:test';
import { apiFetch } from './fetch.ts';

test('uses the API error message for unsuccessful responses', async (context) => {
  context.mock.method(globalThis, 'fetch', async () =>
    Response.json(
      { message: 'No hay suficientes entradas General: quedan 0' },
      { status: 400 },
    ),
  );

  await assert.rejects(
    apiFetch({ url: '/v1/orders', method: 'POST' }),
    new Error('No hay suficientes entradas General: quedan 0'),
  );
});

test('returns a clear message when the API cannot be reached', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('fetch failed');
  });

  await assert.rejects(
    apiFetch({ url: '/v1/orders' }),
    new Error(
      'No pudimos conectar con la API. Revisa tu conexión e intenta nuevamente.',
    ),
  );
});
