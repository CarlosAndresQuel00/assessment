# Ajustes en órdenes

## Qué hice

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
