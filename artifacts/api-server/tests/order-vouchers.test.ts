import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import app from "../src/app";
import { pool } from "@workspace/db";
import { createPasswordHash } from "../src/lib/password";
import { ensureOrderVouchers, toVoucher } from "../src/lib/order-vouchers";
import { processVoucherEmails } from "../src/lib/voucher-email";
import { createVoucherPdf } from "../src/lib/voucher-pdf";

test("immutable private vouchers, PDF attachment, durable retry, and owner-only access", async () => {
  const nativeFetch = globalThis.fetch;
  const messages: any[] = [];
  let rejectMail = false;
  const suffix = randomUUID();
  globalThis.fetch = (async (input: any, init: any) => {
    if (String(input) === "https://api.sendgrid.com/v3/mail/send") {
      const body = JSON.parse(init.body);
      assert.equal(body.personalizations[0].to[0].email, `voucher-${suffix}@example.test`);
      messages.push(body);
      return new Response(null, { status: rejectMail ? 503 : 202 });
    }
    return nativeFetch(input, init);
  }) as typeof fetch;
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api`;
  const users: number[] = [];
  const orders: number[] = [];
  let restaurantId: number | undefined;
  let transactional = false;
  const client = await pool.connect();
  const request = (sid: string, path: string, method = "GET") =>
    nativeFetch(`${base}${path}`, { method, headers: { Cookie: `sid=${sid}` } });
  try {
    for (const [role, email] of [
      ["cliente", `voucher-${suffix}@example.test`],
      ["cliente", `other-voucher-${suffix}@example.test`],
      ["administrador_negocio", `owner-voucher-${suffix}@example.test`],
    ]) {
      const row = (await pool.query(
        "INSERT INTO public.users(name,email,password_hash,role,active) VALUES('Synthetic voucher customer',$1,$2,$3,true) RETURNING id",
        [email, createPasswordHash(`Synthetic-${suffix}`), role],
      )).rows[0];
      users.push(row.id);
    }
    restaurantId = (await pool.query(
      `INSERT INTO public.restaurants(name,ruc,address,phone,administrator_id,is_open,active,cuisine,delivery_fee,image,rating,delivery_minutes,featured)
       VALUES('Synthetic voucher business','','','',$1,true,true,'',3,'',0,30,false) RETURNING id`, [users[2]],
    )).rows[0].id;
    const sid = randomUUID(), otherSid = randomUUID();
    for (const [session, user] of [[sid, users[0]], [otherSid, users[1]]]) {
      await pool.query("INSERT INTO public.sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [session, user]);
    }
    // Keep queued fixtures uncommitted until the stubbed worker has accepted them.
    // The running app's real worker cannot see or send these test emails.
    await client.query("BEGIN"); transactional = true;
    const orderId = (await client.query(
      `INSERT INTO public.orders(restaurant_id,restaurant_name,customer_id,customer_name,total,status,payment_method,delivery_address,items,delivery_fee)
       VALUES($1,'Synthetic voucher business',$2,'Synthetic voucher customer',23,'received','yape','Synthetic destination',$3,3) RETURNING id`,
      [restaurantId, users[0], JSON.stringify([{ id: 1, name: "Synthetic meal", price: 10, quantity: 2 }])],
    )).rows[0].id;
    orders.push(orderId);
    await ensureOrderVouchers(users[0], orderId, true, client);
    await ensureOrderVouchers(users[0], orderId, true, client);
    const inserted = await client.query("SELECT * FROM public.order_vouchers WHERE order_id=$1", [orderId]);
    assert.equal(inserted.rows.length, 1);
    assert.equal(inserted.rows[0].email_status, "pending");
    const voucher = toVoucher(inserted.rows[0]);
    assert.equal(voucher.total, 23); assert.equal(voucher.subtotal, 20); assert.equal(voucher.deliveryFee, 3);
    assert.equal(voucher.customerEmail, `voucher-${suffix}@example.test`);
    const pdf = await createVoucherPdf(voucher);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    await writeFile("/tmp/quillayaa-voucher-test.pdf", pdf);
    await processVoucherEmails(orderId, client);
    assert.equal(messages.length, 1);
    assert.ok(messages[0].content[0].value.includes("PAGO NO VERIFICADO"));
    assert.ok(messages[0].attachments[0].filename.endsWith(".pdf"));
    assert.equal(Buffer.from(messages[0].attachments[0].content, "base64").subarray(0, 4).toString(), "%PDF");
    assert.equal((await client.query("SELECT email_status FROM public.order_vouchers WHERE order_id=$1", [orderId])).rows[0].email_status, "sent");
    await client.query("COMMIT"); transactional = false;

    assert.equal((await request("", "/vouchers")).status, 401);
    const list = await request(sid, "/vouchers");
    assert.equal(list.status, 200);
    assert.ok((await list.json() as any[]).some(v => v.orderId === orderId && v.number === voucher.number));
    assert.equal((await request(otherSid, `/vouchers/${orderId}`)).status, 404);
    assert.equal((await request(otherSid, `/vouchers/${orderId}/pdf`)).status, 404);
    assert.equal((await request(otherSid, `/vouchers/${orderId}/email`, "POST")).status, 404);
    assert.equal((await request(sid, `/vouchers/${orderId}/email`, "POST")).status, 429);
    const downloaded = await request(sid, `/vouchers/${orderId}/pdf`);
    assert.equal(downloaded.status, 200);
    assert.ok(downloaded.headers.get("content-type")?.includes("application/pdf"));
    assert.equal(Buffer.from(await downloaded.arrayBuffer()).subarray(0, 4).toString(), "%PDF");
    await pool.query("UPDATE public.orders SET customer_name='Changed name',total=99,delivery_fee=9 WHERE id=$1", [orderId]);
    const unchanged = await (await request(sid, `/vouchers/${orderId}`)).json() as any;
    assert.equal(unchanged.total, 23); assert.equal(unchanged.customerName, "Synthetic voucher customer");

    // A provider outage persists failure/retry state without losing the voucher/order.
    await client.query("BEGIN"); transactional = true;
    await client.query("UPDATE public.order_vouchers SET email_status='pending',email_attempts=0,next_email_attempt_at=now() WHERE order_id=$1", [orderId]);
    rejectMail = true;
    await processVoucherEmails(orderId, client);
    const failed = (await client.query("SELECT * FROM public.order_vouchers WHERE order_id=$1", [orderId])).rows[0];
    assert.equal(failed.email_status, "failed");
    assert.equal(failed.email_attempts, 1);
    assert.ok(new Date(failed.next_email_attempt_at).getTime() > Date.now());
    rejectMail = false;
    await client.query("UPDATE public.order_vouchers SET next_email_attempt_at=now() WHERE order_id=$1", [orderId]);
    await processVoucherEmails(orderId, client);
    assert.equal((await client.query("SELECT email_status FROM public.order_vouchers WHERE order_id=$1", [orderId])).rows[0].email_status, "sent");
    await client.query("COMMIT"); transactional = false;
  } finally {
    if (transactional) await client.query("ROLLBACK");
    client.release();
    globalThis.fetch = nativeFetch;
    await pool.query("DELETE FROM public.orders WHERE id=ANY($1::int[])", [orders]);
    if (restaurantId) await pool.query("DELETE FROM public.restaurants WHERE id=$1", [restaurantId]);
    await pool.query("DELETE FROM public.sessions WHERE user_id=ANY($1::int[])", [users]);
    await pool.query("DELETE FROM public.users WHERE id=ANY($1::int[])", [users]);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
