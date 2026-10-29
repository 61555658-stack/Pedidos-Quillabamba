import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import app from "../src/app";
import { pool } from "@workspace/db";
import { createPasswordHash, verifyPasswordHash } from "../src/lib/password";

test("business administrator first setup, repeat authentication, session isolation, and lockout", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const userIds: number[] = [];
  const businessIds: number[] = [];
  const credentials = { username: "owner.test", password: `Admin-${randomUUID()}` };
  const request = async (sid: string, path: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Cookie: `sid=${sid}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() as any };
  };
  const newSession = async (userId: number, mode = "choose", verified = false) => {
    const sid = randomUUID();
    await pool.query(
      `INSERT INTO public.sessions(id,user_id,expires_at,business_mode,business_admin_verified_at)
       VALUES($1,$2,now()+interval '1 hour',$3,$4)`, [sid, userId, mode, verified ? new Date() : null],
    );
    return sid;
  };
  const newOwner = async () => {
    const user = (await pool.query(
      `INSERT INTO public.users(name,email,password_hash,role,active)
       VALUES('Synthetic access test',$1,$2,'administrador_negocio',true) RETURNING id`,
      [`admin-access-${randomUUID()}@example.test`, createPasswordHash(`Primary-${randomUUID()}`)],
    )).rows[0];
    userIds.push(user.id);
    const business = (await pool.query(
      `INSERT INTO public.restaurants(name,ruc,address,phone,administrator_id,is_open,active,cuisine,delivery_fee,image,rating,delivery_minutes,featured)
       VALUES('Synthetic access test','','','',$1,true,true,'',0,'',0,30,false) RETURNING id`, [user.id],
    )).rows[0];
    businessIds.push(business.id);
    return user.id as number;
  };
  try {
    const userId = await newOwner();
    const first = await newSession(userId, "administrator");
    const before = await request(first, "/business/access");
    assert.equal(before.data.mode, "choose", "legacy administrative sessions must be challenged");
    assert.equal(before.data.administratorCredentialsConfigured, false);
    assert.equal((await request(first, "/operations/state")).status, 403);
    assert.equal((await request(first, "/business/access/administrator", {})).status, 400);
    assert.equal((await request(first, "/business/access/administrator/setup", { ...credentials, password: "short" })).status, 400);

    const setup = await request(first, "/business/access/administrator/setup", credentials);
    assert.equal(setup.status, 200);
    assert.equal(setup.data.mode, "administrator");
    assert.equal(setup.data.administratorCredentialsConfigured, true);
    assert.equal(JSON.stringify(setup.data).includes(credentials.password), false);
    const saved = (await pool.query("SELECT * FROM public.business_administrator_credentials WHERE user_id=$1", [userId])).rows[0];
    assert.notEqual(saved.password_hash, credentials.password);
    assert.ok(verifyPasswordHash(credentials.password, saved.password_hash));
    assert.equal((await request(first, "/operations/state")).status, 200);
    assert.equal((await request(first, "/business/access/administrator/setup", { ...credentials, password: "Replacement-123" })).status, 409);

    const repeat = await newSession(userId);
    assert.equal((await request(repeat, "/business/access")).data.administratorCredentialsConfigured, true);
    assert.equal((await request(repeat, "/operations/state")).status, 403);
    assert.equal((await request(repeat, "/business/access/administrator", { ...credentials, password: "Wrong-Password" })).status, 401);
    assert.equal((await request(repeat, "/business/access")).data.mode, "choose");
    assert.equal((await request(repeat, "/business/access/administrator", { ...credentials, username: "OWNER.TEST" })).status, 200);
    assert.equal((await request(repeat, "/business/access")).data.mode, "administrator");

    const otherUser = await newOwner();
    const otherSession = await newSession(otherUser);
    assert.equal((await request(otherSession, "/business/access/administrator", credentials)).status, 409);
    for (const mode of ["cashier", "cashier_login"]) {
      const cashier = await newSession(userId, mode);
      assert.equal((await request(cashier, "/business/access/administrator", credentials)).status, 403);
      assert.equal((await request(cashier, "/business/access/administrator/setup", credentials)).status, 403);
    }
    const locked = await newSession(userId);
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.equal((await request(locked, "/business/access/administrator", { ...credentials, password: "Wrong-Password" })).status, 401);
    }
    const parallelSession = await newSession(userId);
    assert.equal((await request(parallelSession, "/business/access/administrator", credentials)).status, 429, "lockout spans sessions");
    await pool.query("UPDATE public.business_administrator_credentials SET locked_until=now()-interval '1 second' WHERE user_id=$1", [userId]);
    assert.equal((await request(parallelSession, "/business/access/administrator", credentials)).status, 200);
  } finally {
    await pool.query("DELETE FROM public.sessions WHERE user_id=ANY($1::int[])", [userIds]);
    await pool.query("DELETE FROM public.restaurants WHERE id=ANY($1::int[])", [businessIds]);
    await pool.query("DELETE FROM public.users WHERE id=ANY($1::int[])", [userIds]);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
