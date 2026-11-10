import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatReservationTime,
  getReservationRemainingMs,
} from './reservation.ts';

test('calculates the remaining reservation time without going below zero', () => {
  const expiresAt = '2026-11-10T12:15:00.000Z';

  assert.equal(
    getReservationRemainingMs(expiresAt, Date.parse('2026-11-10T12:00:00.000Z')),
    15 * 60 * 1000,
  );
  assert.equal(
    getReservationRemainingMs(expiresAt, Date.parse('2026-11-10T12:16:00.000Z')),
    0,
  );
});

test('formats the countdown as minutes and seconds', () => {
  assert.equal(formatReservationTime(15 * 60 * 1000), '15:00');
  assert.equal(formatReservationTime(61_001), '1:02');
  assert.equal(formatReservationTime(0), '0:00');
});
