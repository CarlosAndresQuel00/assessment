export type OrderConfirmationProps = {
  orderId: string;
  error: string;
  canRetry: boolean;
};

export function OrderConfirmation({
  orderId,
  error,
  canRetry,
}: OrderConfirmationProps) {
  return (
    <div
      role="alert"
      className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <p className="font-medium">
        No pudimos confirmar la reserva {orderId}.
      </p>
      <p className="mt-1">{error}</p>
      {canRetry && (
        <p className="mt-1">
          Puedes enviar el formulario nuevamente sin crear otra reserva.
        </p>
      )}
    </div>
  );
}
