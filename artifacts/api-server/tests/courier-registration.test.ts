import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

test("registration requires verified email and real server-owned active SOAT; other roles still work", async () => {
  const nativeFetch = globalThis.fetch;
  const emails = new Set<string>();
  const codes = new Map<string, string>();
  // Test process only: no verification email or SOAT query leaves the container.
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input);
    if (url === "https://api.sendgrid.com/v3/mail/send") {
      const body = JSON.parse(init.body);
      const email = body.personalizations[0].to[0].email;
      assert.ok(emails.has(email));
      codes.set(email, body.content[0].value.match(/\b\d{6}\b/)[0]);
      return new Response(null, { status: 202 });
    }
    if (url.startsWith("https://api.croma.run/")) {
      const plate = JSON.parse(init.body).plate;
      return Response.json({ data: {
        found: true, plate, has_active_soat: plate === "TST001",
        active: plate === "TST001" ? { company: "TEST insurer", status: "VIGENTE",
          start_date: "2020-01-01", end_date: "2099-12-31", policy_number: "TEST-ONLY", annulled_date: null } : null,
      } });
    }
    return nativeFetch(input, init);
  }) as typeof fetch;
  const { default: app } = await import("../src/app");
  const { pool } = await import("@workspace/db");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const post = async (path: string, body: object) => {
    const response = await nativeFetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return { response, data: await response.json() as any };
  };
  const makeAccount = (role: string) => {
    const email = `e2e-courier-${randomUUID()}@example.test`; emails.add(email);
    return { name: "Synthetic Courier Test", email, password: `test-${randomUUID()}`, role };
  };
  try {
    const courier = { dni: "00000000", licenseNumber: "TEST12345", vehiclePlate: "TST001" };
    const owner = makeAccount("repartidor");
    assert.equal((await post("/auth/register", owner)).response.status, 400);
    assert.equal((await post("/auth/register", { ...owner, courier, soatVerificationId: "forged", has_active_soat: true })).response.status, 409);
    const active = await post("/auth/courier-soat", { email: owner.email, plate: "TST-001" });
    assert.equal(active.data.status, "active");
    assert.equal((await post("/auth/register", { ...owner, courier, soatVerificationId: active.data.verificationId })).response.status, 403);
    const inactive = await post("/auth/courier-soat", { email: owner.email, plate: "TST002" });
    assert.equal(inactive.data.status, "inactive");
    assert.equal((await post("/auth/register", { ...owner, courier: { ...courier, vehiclePlate: "TST002" }, soatVerificationId: active.data.verificationId })).response.status, 409);
    const send = await post("/auth/verification/send", { email: owner.email, role: owner.role });
    assert.equal(send.response.status, 200);
    assert.equal((await post("/auth/verification/confirm", { email: owner.email, role: owner.role, code: codes.get(owner.email) })).response.status, 200);
    const saved = await post("/auth/register", { ...owner, courier, soatVerificationId: active.data.verificationId });
    assert.equal(saved.response.status, 201);
    assert.equal(saved.data.user.role, "repartidor");
    assert.ok(saved.response.headers.get("set-cookie")?.includes("HttpOnly"));
    const profile = await pool.query("SELECT dni,license_number,vehicle_plate,soat_company FROM public.courier_registration_profiles WHERE user_id=$1", [Number(saved.data.user.id)]);
    assert.deepEqual(profile.rows[0], { dni: "00000000", license_number: "TEST12345", vehicle_plate: "TST001", soat_company: "TEST insurer" });
    for (const role of ["cliente", "administrador_negocio"]) {
      const account = makeAccount(role);
      assert.equal((await post("/auth/verification/send", { email: account.email, role })).response.status, 200);
      await post("/auth/verification/confirm", { email: account.email, role, code: codes.get(account.email) });
      const result = await post("/auth/register", account);
      assert.equal(result.response.status, role === "cliente" ? 201 : 202);
    }
    const remaining = await pool.query("SELECT count(*)::int AS n FROM public.users WHERE email=$1", [owner.email]);
    assert.equal(remaining.rows[0].n, 1);
  } finally {
    await pool.query("DELETE FROM public.sessions WHERE user_id IN (SELECT id FROM public.users WHERE email=ANY($1::text[]))", [[...emails]]);
    await pool.query("DELETE FROM public.users WHERE email=ANY($1::text[])", [[...emails]]);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
    globalThis.fetch = nativeFetch;
  }
});
