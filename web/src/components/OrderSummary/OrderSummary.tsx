import { formatUsd } from '~/lib/money';

export type OrderSummaryItem = {
  ticketTypeId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderSummaryProps = {
  items: OrderSummaryItem[];
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
};

export function OrderSummary({
  items,
  subtotalCents,
  feeCents,
  totalCents,
}: OrderSummaryProps) {
  return (
    <div>
      <h2 className="font-semibold">Resumen</h2>
      <ul className="mt-4 space-y-3 border-b border-black/10 pb-4">
        {items.map((item) => (
          <li
            key={item.ticketTypeId}
            className="flex items-start justify-between gap-4 text-sm"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-ink/60">
                {item.quantity} × {formatUsd(item.unitPriceCents)}
              </p>
            </div>
            <p className="tabular-nums">
              {formatUsd(item.unitPriceCents * item.quantity)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">Subtotal</dt>
          <dd className="tabular-nums">{formatUsd(subtotalCents)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink/70">Cargo por servicio</dt>
          <dd className="tabular-nums">{formatUsd(feeCents)}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-black/10 pt-3 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatUsd(totalCents)}</dd>
        </div>
      </dl>
    </div>
  );
}
