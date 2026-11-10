export function getReservationRemainingMs(
  expiresAt: string,
  now = Date.now(),
): number {
  return Math.max(0, Date.parse(expiresAt) - now);
}

export function formatReservationTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
