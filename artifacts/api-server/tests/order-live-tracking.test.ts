import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import app from "../src/app";
import { pool } from "@workspace/db";
import { createPasswordHash } from "../src/lib/password";

test("live tracking starts on acceptance, is private, expires and stops on completion", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const users: number[] = [], sessions: string[] = [];
  let restaurantId: number | undefined, orderId: number | undefined;
  const suffix = randomUUID();
  const position = { latitude: -12.8628, longitude: -72.6945, accuracy: 9 };
  const request = (sid: string, path: string, method = "GET", body?: unknown) =>
    fetch(`${base}${path}`, { method, headers: { Cookie: `sid=${sid}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    for (const role of ["cliente", "cliente", "repartidor", "repartidor", "administrador_negocio"]) {
      const user = (await pool.query(
        "INSERT INTO public.users(name,email,password_hash,role,active) VALUES('Synthetic tracking',$1,$2,$3,true) RETURNING id",
        [`tracking-${users.length}-${suffix}@example.test`, createPasswordHash(`Synthetic-${suffix}`), role],
      )).rows[0];
      users.push(user.id);
      const sid = randomUUID(); sessions.push(sid);
      await pool.query("INSERT INTO public.sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [sid, user.id]);
    }
    restaurantId = (await pool.query(
      `INSERT INTO public.restaurants(name,ruc,address,phone,administrator_id,is_open,active,cuisine,delivery_fee,image,rating,delivery_minutes,featured)
       VALUES('Synthetic tracking business','','','',$1,true,true,'',3,'',0,30,false) RETURNING id`, [users[4]],
    )).rows[0].id;
    orderId = (await pool.query(
      `INSERT INTO public.orders(restaurant_id,restaurant_name,customer_id,customer_name,total,status,payment_method,delivery_address,items,delivery_fee,delivery_location)
       VALUES($1,'Synthetic tracking business',$2,'Synthetic tracking',23,'ready','cash','Synthetic destination',$3,3,$4) RETURNING id`,
      [restaurantId, users[0], JSON.stringify([{ id: 1, name: "Synthetic meal", price: 10, quantity: 2 }]), JSON.stringify({latitude:-12.864,longitude:-72.691,source:"map"})],
    )).rows[0].id;
    const path = `/orders/${orderId}/location`;
    assert.equal((await request("", path)).status, 401);
    assert.equal((await request(sessions[0], path)).status, 404);
    assert.equal((await request(sessions[2], `/orders/${orderId}/claim`, "POST")).status, 200);
    assert.equal((await request(sessions[3], `/orders/${orderId}/claim`, "POST")).status, 409);
    assert.equal((await request(sessions[0], path, "PUT", position)).status, 403);
    assert.equal((await request(sessions[3], path, "PUT", position)).status, 404);
    for (const invalid of [{accuracy:251},{latitude:91},{longitude:-181},{accuracy:-1}]) {
      assert.equal((await request(sessions[2], path, "PUT", {...position,...invalid})).status, 400);
    }
    assert.equal((await request(sessions[2], path, "PUT", {...position, updatedAt:"2099-01-01T00:00:00Z"})).status, 200);
    const live = await request(sessions[0], path);
    assert.equal(live.status, 200);
    assert.match(live.headers.get("cache-control") ?? "", /no-store/);
    const data = await live.json() as typeof position & {updatedAt:string};
    assert.equal(data.latitude, position.latitude);
    assert.equal(data.accuracy, position.accuracy);
    assert.ok(Math.abs(Date.now()-Date.parse(data.updatedAt))<10000);
    assert.equal((await request(sessions[1], path)).status, 404);
    assert.equal((await request(sessions[3], path)).status, 404);
    await pool.query(`UPDATE public.orders SET current_location=jsonb_set(current_location,'{updatedAt}',to_jsonb((now()-interval '3 minutes')::text)) WHERE id=$1`, [orderId]);
    assert.equal((await request(sessions[0], path)).status, 404);
    assert.equal((await request(sessions[2], path, "PUT", position)).status, 200);
    assert.equal((await request(sessions[2], `/orders/${orderId}/status`, "PATCH", {status:"on_the_way"})).status, 200);
    assert.equal((await request(sessions[0], path)).status, 200);
    for (const status of ["delivered","cancelled"]) {
      // Do not exercise proof upload or stock restoration here; those are separate flows.
      await pool.query("UPDATE public.orders SET status=$1 WHERE id=$2", [status, orderId]);
      assert.equal((await request(sessions[0], path)).status, 404);
      assert.equal((await request(sessions[2], path, "PUT", position)).status, 404);
    }
  } finally {
    if (orderId) await pool.query("DELETE FROM public.orders WHERE id=$1", [orderId]);
    if (restaurantId) await pool.query("DELETE FROM public.restaurants WHERE id=$1", [restaurantId]);
    await pool.query("DELETE FROM public.sessions WHERE id=ANY($1::text[])", [sessions]);
    await pool.query("DELETE FROM public.users WHERE id=ANY($1::int[])", [users]);
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  }
});
