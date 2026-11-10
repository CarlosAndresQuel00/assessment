# API

Localmente la API está en `http://localhost:8000/v1`.

En la web, Vite redirige `/v1` a esa URL. O sea, desde el browser puedes hacer `fetch('/v1/events')` y llega a Nest.

## `GET /events`

Los eventos a la venta. Esto ya funciona.

```json
[
  {
    "id": "noche-salsa",
    "title": "Noche de Salsa en Quito",
    "city": "Quito",
    "venue": "Teatro Sucre",
    "startsAt": "2026-11-14T01:00:00.000Z",
    "description": "Una noche de salsa en vivo con orquesta invitada.",
    "ticketTypes": [
      {
        "id": "salsa-general",
        "name": "General",
        "priceCents": 2500,
        "remaining": 40,
        "maxPerOrder": 6
      }
    ]
  }
]
```

## `GET /events/:id`

El mismo JSON, pero de un solo evento. Si no está, `404`.

## `POST /orders`

Aparta las entradas y crea la orden. Hasta que no la confirmen, el `status` es `pending`.

Body:

```json
{
  "eventId": "noche-salsa",
  "items": [{ "ticketTypeId": "salsa-general", "quantity": 2 }]
}
```

Vuelve algo así:

```json
{
  "id": "ord_...",
  "eventId": "noche-salsa",
  "status": "pending",
  "items": [
    {
      "ticketTypeId": "salsa-general",
      "name": "General",
      "quantity": 2,
      "unitPriceCents": 2500,
      "lineTotalCents": 5000
    }
  ],
  "subtotalCents": 5000,
  "feeCents": 500,
  "totalCents": 5500,
  "buyer": null,
  "createdAt": "2026-09-16T20:00:00.000Z",
  "expiresAt": "2026-09-16T20:15:00.000Z"
}
```

La reserva dura 15 minutos. Si no se confirma antes de `expiresAt`, la orden
pasa a `expired` y las entradas se devuelven al inventario.

## `GET /orders/:id`

Esa orden. `404` si no existe.

## `POST /orders/:id/confirm`

Acá se manda quién compra:

```json
{ "name": "Ana Pérez", "email": "ana@example.com" }
```

La orden vuelve con `status: "confirmed"` y `buyer` lleno.
Una orden `expired` no se puede confirmar y responde `400`.
