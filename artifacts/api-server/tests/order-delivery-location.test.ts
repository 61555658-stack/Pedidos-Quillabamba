import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateOrderBody, GetOrderResponse } from "@workspace/api-zod";
import { toOrder } from "../src/lib/operations-data";

const input = {
  restaurantName: "Test restaurant", customerName: "Test customer",
  total: 23, paymentMethod: "cash", deliveryAddress: "",
  items: [{ id: 1, name: "Test product", quantity: 1, price: 20 }],
};
const row = {
  id: 1, restaurant_name: "Test restaurant", customer_name: "Test customer",
  customer_id: 1, total: 23, delivery_fee: 3, status: "received", payment_method: "cash",
  created_at: "2026-10-29T18:00:00Z", delivery_address: "Ubicación de entrega",
  items: input.items,
};

test("GPS and map coordinates retain full precision through request and response contracts", () => {
  for (const source of ["gps", "map"] as const) {
    const location = { latitude: -12.8629123, longitude: -72.6934123, source, ...(source === "gps" ? { accuracy: 8 } : {}) };
    const request = CreateOrderBody.parse({ ...input, deliveryLocation: location });
    assert.deepEqual(request.deliveryLocation, location);
    const order = GetOrderResponse.parse(toOrder({ ...row, delivery_location: location }));
    assert.deepEqual(order.deliveryLocation, location);
  }
});

test("invalid coordinate ranges, source, and accuracy are rejected", () => {
  const valid = { latitude: -12.86, longitude: -72.69, source: "gps", accuracy: 10 };
  for (const invalid of [
    { latitude: 91 }, { latitude: -91 }, { longitude: 181 }, { longitude: -181 },
    { latitude: NaN }, { longitude: Infinity }, { source: "typed" }, { accuracy: -1 },
  ]) {
    assert.equal(CreateOrderBody.safeParse({ ...input, deliveryLocation: { ...valid, ...invalid } }).success, false);
  }
});

test("legacy orders and older clients keep their text address without fabricated coordinates", () => {
  assert.equal(CreateOrderBody.safeParse({ ...input, deliveryAddress: "Legacy address" }).success, true);
  const order = GetOrderResponse.parse(toOrder(row));
  assert.equal("deliveryLocation" in order, false);
});
