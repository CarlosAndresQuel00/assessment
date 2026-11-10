# Backend/Api

## Ajuste

- Revisé el controller, los DTO, el servicio de órdenes, el store en memoria y `docs/api.md`.
- Mantuve el flujo y la arquitectura existentes (`controller -> service -> store`).
- Agregué validaciones de negocio en `OrdersService` para rechazar con `BadRequestException`:
  - listas de items vacías.
  - cantidades que no sean enteros mayores o iguales a 1.
  - `ticketTypeId` duplicados.
  - cantidades superiores al inventario disponible (`remaining`).
  - cantidades superiores al límite por orden (`maxPerOrder`).
- Conservé `NotFoundException` para eventos y tipos de entrada inexistentes, y mejoré el mensaje del tipo de entrada para incluir su ID.
- Las validaciones de todas las líneas se completan antes de modificar el inventario, evitando reservas parciales cuando una línea falla.
- La comprobación de disponibilidad y la reserva se mantienen en una sola operación síncrona, sin puntos de espera que permitan intercalar solicitudes dentro de una instancia del API.
- Al crear una orden, ahora se descuenta el inventario, se calcula el cargo de servicio del 10% con `Math.round` y se mantiene el total en centavos enteros.
- Al confirmar una orden, ahora se rechaza un segundo intento con `BadRequestException`.
- La confirmación exige un nombre con contenido y un correo electrónico válido mediante `ConfirmOrderDto`; el `ValidationPipe` global responde HTTP 400 antes de llegar al servicio.
- Una orden inexistente continúa respondiendo HTTP 404, y cualquier orden que no esté `pending` responde HTTP 400 con un mensaje consistente.
- Confirmar una orden solo actualiza `status` y `buyer`; no vuelve a descontar ni libera las entradas ya reservadas.
- Agregué pruebas para cantidades menores a 1, redondeo con precios impares en centavos, ausencia de modificaciones parciales y solicitudes concurrentes compitiendo por el último inventario.
- Agregué pruebas del DTO de confirmación, de confirmaciones duplicadas y de conservación del inventario reservado.
- En la revisión final eliminé la validación duplicada del nombre, dejé privada la constante interna de comisión y agregué una prueba con múltiples tipos de entrada.

# Checkout frontend/web

## Cambios

- Revisé las rutas, páginas existentes, hooks de API, endpoints, tipos, estilos globales y el patrón de carpetas de `TicketStepper`.
- Completé `CheckoutPage` con un formulario tipado usando `react-hook-form` y Yup para validar nombre y correo.
- Agregué el resumen previo a la compra con localidades, cantidades, subtotal, cargo del 10% y total en centavos formateados.
- Conecté el flujo `createOrder -> confirmOrder -> /orders/:orderId` usando `useApiMutation`.
- Si crear la orden falla, se muestra el mensaje enviado por la API. Si falla la confirmación, se reintenta sobre la misma orden para no crear otra reserva.
- Completé `ConfirmationPage` con estados de carga y error, datos del evento y comprador, líneas compradas y total pagado.
- Agregué `OrderSummary` como componente reutilizable, con su carpeta, archivo e `index.ts`.
- Agregué `OrderConfirmation` como componente del flujo de checkout, también con carpeta, archivo e `index.ts`.
- Reutilicé Tailwind, `formatUsd`, `feeFromSubtotal`, los tipos y los hooks existentes. No agregué dependencias.
- `CheckoutPage` ahora consulta el evento con `useApiQuery(eventById)` y reconstruye las líneas con nombres y precios vigentes del catálogo; `location.state` conserva únicamente la selección del usuario.
- Agregué estados de carga, error del evento y selección desactualizada antes de mostrar el formulario.
- Extraje la resolución de entradas y los cálculos en centavos a funciones puras en `web/src/lib/checkout.ts`.
- Agregué pruebas con el runner nativo de Node para verificar datos actuales del catálogo, subtotal, redondeo del 10% y total entero.
- El botón de pago permanece bloqueado durante la validación, creación y confirmación para evitar envíos duplicados.
- La creación y confirmación usan exclusivamente `useApiMutation` con `createOrder` y `confirmOrder`; al completar ambas operaciones se navega a `/orders/:id`.
- Si la confirmación falla después de reservar, se muestra el ID creado y el reintento confirma esa misma orden sin volver a crearla.
- `apiFetch` conserva los mensajes 400/404 del backend y ahora convierte fallos de red en un mensaje claro para el usuario.
- `ConfirmationPage` consulta la orden real con `useApiQuery(orderById)` y presenta su estado, comprador, líneas e importes actuales.
- Después de crear la orden, `CheckoutPage` muestra `ReservationTimer` en la esquina superior derecha con una cuenta regresiva basada en el `expiresAt` entregado por la API.
- Al vencer, el timer muestra `Reserva expirada`, bloquea nuevos intentos de confirmación y mantiene el ID existente para no crear reservas duplicadas.
- `ConfirmationPage` distingue los estados reales `pending`, `confirmed` y `expired`.
- En la validación final, checkout espera que termine la actualización del evento, detecta cantidades superiores a `remaining` o `maxPerOrder` y bloquea el pago con un mensaje antes de enviar. El API continúa siendo la protección final ante cambios simultáneos de inventario.
- Revisé la navegación completa `detalle -> checkout -> creación -> confirmación -> /orders/:id` y el uso de `useApiQuery`/`useApiMutation`; las páginas no usan `fetch`, `useQuery` ni `useMutation` directamente.
- Revisé las variantes responsive existentes: formulario y resumen se apilan en móvil y pasan a columnas desde `md`; el comprobante hace lo mismo desde `sm`.

# Extra

## La reserva dura 15 minutos. Si no confirman, se libera el inventario.

### Expiración de reservas

- Cada orden nueva incluye `expiresAt`, calculado exactamente 15 minutos después de `createdAt`.
- Un temporizador cambia órdenes todavía `pending` a `expired` y devuelve cada cantidad reservada a `remaining`.
- `findById` y `confirm` también verifican el plazo de forma síncrona, por lo que una confirmación en o después de `expiresAt` no depende de que el callback del temporizador ya haya corrido.
- Antes de validar disponibilidad para una orden nueva, el servicio barre reservas vencidas y recupera su inventario; esto cubre callbacks retrasados y permite reutilizar esas entradas inmediatamente.
- La transición `pending -> expired` ocurre antes de liberar inventario; llamadas posteriores no pueden devolver las mismas entradas otra vez.
- Confirmar antes del límite cambia a `confirmed`, reserva y cancela el temporizador pendiente.
- Una orden expirada devuelve HTTP 400 con el mensaje `La orden expiró y las entradas reservadas fueron liberadas`.
- La validación final comprobó que a los 14:59 la orden sigue `pending` y el inventario continúa reservado; al milisegundo siguiente pasa a `expired` y se libera una sola vez.
- Se cubrió la carrera entre confirmación y expiración programadas para el mismo instante: el chequeo síncrono del plazo impide confirmar y la liberación sigue siendo idempotente.
- Dos solicitudes que compiten por inventario recién liberado no pueden sobrevendérselo: solo una se crea y `remaining` nunca resulta negativo.
- Se mantuvieron las validaciones, el cálculo del 10% y todos los importes en centavos.
