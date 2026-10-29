import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBusinessOpen, openingHoursSchema } from '../src/lib/opening-hours.ts';

const hours = { days: [1], opensAt: '09:00', closesAt: '18:00' };
for (const [label, now, expected] of [
  ['before opening in Peru', '2026-10-26T13:59:00Z', false],
  ['exact opening in Peru', '2026-10-26T14:00:00Z', true],
  ['before closing', '2026-10-26T22:59:00Z', true],
  ['exact closing', '2026-10-26T23:00:00Z', false],
  ['unselected day', '2026-10-27T15:00:00Z', false],
]) {
  test(label, () => assert.equal(isBusinessOpen(true, hours, new Date(now)), expected));
}

const overnight = { days: [0], opensAt: '20:00', closesAt: '02:00' };
for (const [label, now, expected] of [
  ['Sunday evening', '2026-10-26T01:00:00Z', true],
  ['Sunday shift continues on Monday', '2026-10-26T06:59:00Z', true],
  ['overnight exact closing', '2026-10-26T07:00:00Z', false],
  ['not open early on opening day', '2026-10-25T06:00:00Z', false],
  ['not open Monday evening', '2026-10-27T01:00:00Z', false],
]) {
  test(label, () => assert.equal(isBusinessOpen(true, overnight, new Date(now)), expected));
}
test('manual closure overrides the schedule', () => {
  assert.equal(isBusinessOpen(false, hours, new Date('2026-10-26T15:00:00Z')), false);
});
test('unconfigured businesses retain manual status', () => {
  assert.equal(isBusinessOpen(true, null), true);
  assert.equal(isBusinessOpen(false, null), false);
});
for (const [label, invalid] of [
  ['no days', { ...hours, days: [] }],
  ['duplicate days', { ...hours, days: [1, 1] }],
  ['invalid day', { ...hours, days: [7] }],
  ['fractional day', { ...hours, days: [1.5] }],
  ['invalid opening time', { ...hours, opensAt: '24:00' }],
  ['missing closing time', { ...hours, closesAt: '' }],
  ['equal times', { ...hours, closesAt: '09:00' }],
]) {
  test(`reject ${label}`, () => assert.equal(openingHoursSchema.safeParse(invalid).success, false));
}
test('valid and overnight schedules are accepted', () => {
  assert.equal(openingHoursSchema.safeParse(hours).success, true);
  assert.equal(openingHoursSchema.safeParse(overnight).success, true);
});
