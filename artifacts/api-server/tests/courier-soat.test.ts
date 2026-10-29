import assert from "node:assert/strict";
import { test } from "node:test";
import { createSoatService, parseSoat, SoatError } from "../src/lib/courier-soat";

const now = Date.parse("2026-10-29T16:00:00Z");
const fixture = (overrides: Record<string, unknown> = {}) => ({
  found: true, plate: "TST001", has_active_soat: true,
  active: { company: "Test insurer", status: "VIGENTE", start_date: "2020-01-01", end_date: "2099-12-31", policy_number: "TEST", annulled_date: null },
  ...overrides,
});
test("active certificate is normalized, bounded by Peru date, and contains only registration metadata", () => {
  const result = parseSoat(fixture(), "tst-001", now);
  assert.equal(result?.plate, "TST001");
  assert.equal(result?.company, "Test insurer");
  assert.equal(result?.checkedAt, now);
});
for (const [label, data] of [
  ["missing", fixture({ found: false, has_active_soat: false, active: null })],
  ["expired", fixture({ has_active_soat: false, active: null })],
  ["date expired despite active flag", fixture({ active: { ...fixture().active, end_date: "2026-10-28" } })],
  ["not started", fixture({ active: { ...fixture().active, start_date: "2027-01-01" } })],
] as const) test(`does not approve ${label}`, () => assert.equal(parseSoat(data, "TST001", now), null));
for (const [label, data] of [
  ["wrong plate", fixture({ plate: "TST999" })],
  ["malformed response", {}],
  ["string active flag", fixture({ has_active_soat: "true" })],
  ["annulled", fixture({ active: { ...fixture().active, annulled_date: "2026-10-28" } })],
  ["invalid calendar date", fixture({ active: { ...fixture().active, start_date: "2026-02-30" } })],
  ["missing dates", fixture({ active: { ...fixture().active, end_date: null } })],
] as const) test(`fails closed for ${label}`, () => assert.throws(() => parseSoat(data, "TST001", now), SoatError));
test("SOAT end date remains valid in Peru before UTC midnight rollover", () => {
  const data = fixture({ active: { ...fixture().active, end_date: "2026-10-29" } });
  assert.ok(parseSoat(data, "TST001", Date.parse("2026-10-30T04:59:59Z")));
  assert.equal(parseSoat(data, "TST001", Date.parse("2026-10-30T05:00:00Z")), null);
});
test("polling 202 then completed uses same-origin jobs and binds proof to email and plate", async () => {
  const calls: string[] = [];
  const mockFetch = async (input: any, init: any) => {
    calls.push(String(input));
    assert.equal(init.redirect, "error");
    return calls.length === 1
      ? Response.json({ job: { status: "running", status_url: "/jobs/run_test" } }, { status: 202 })
      : Response.json({ job: { status: "completed" }, data: fixture() });
  };
  const service = createSoatService(mockFetch as typeof fetch, () => "unit-test-only");
  assert.equal((await service.lookup("one@example.test", "TST001", "test-ip")).status, "pending");
  assert.equal((await service.lookup("one@example.test", "TST001", "test-ip")).status, "pending");
  assert.equal(calls.length, 1);
  await new Promise(resolve => setTimeout(resolve, 2050));
  const result = await service.lookup("one@example.test", "TST001", "test-ip");
  assert.equal(result.status, "active");
  assert.equal(calls[1], "https://api.croma.run/jobs/run_test");
  assert.ok(service.approval("one@example.test", "TST-001", result.verificationId));
  assert.throws(() => service.approval("other@example.test", "TST001", result.verificationId));
  assert.throws(() => service.approval("one@example.test", "TST999", result.verificationId));
  assert.throws(() => service.approval("one@example.test", "TST001", "forged"));
  service.consume("one@example.test", "TST001");
  assert.throws(() => service.approval("one@example.test", "TST001", result.verificationId));
});
test("never follows provider status URLs to another host", async () => {
  let calls = 0;
  const service = createSoatService((async () => {
    calls++; return Response.json({ job: { status: "running", status_url: "https://attacker.example/jobs/test" } }, { status: 202 });
  }) as typeof fetch, () => "unit-test-only");
  await assert.rejects(service.lookup("one@example.test", "TST001", "ip"), SoatError);
  assert.equal(calls, 1);
});
test("lookup errors, missing credential and quota exhaustion never issue approvals", async () => {
  const unavailable = createSoatService((async () => Response.json({ error: "bad" }, { status: 502 })) as typeof fetch, () => "unit-test-only");
  await assert.rejects(unavailable.lookup("one@example.test", "TST001", "ip"), SoatError);
  assert.throws(() => unavailable.approval("one@example.test", "TST001", "forged"));
  const unconfigured = createSoatService(fetch, () => undefined);
  await assert.rejects(unconfigured.lookup("one@example.test", "TST001", "ip"), SoatError);
  const limited = createSoatService((async () => Response.json({ data: fixture({ found: false, has_active_soat: false }) })) as typeof fetch, () => "unit-test-only");
  for (let i = 0; i < 5; i++) await limited.lookup(`${i}@example.test`, "TST001", "ip");
  await assert.rejects(limited.lookup("six@example.test", "TST001", "ip"), (e: any) => e.status === 429);
});
