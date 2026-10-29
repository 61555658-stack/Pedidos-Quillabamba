import assert from "node:assert/strict";
import { test } from "node:test";
import { GetOrderResponse } from "@workspace/api-zod";
import { toOrder } from "../src/lib/operations-data";

const assigned = {
  id: 1, restaurant_id: 1, restaurant_name: "Test business",
  customer_id: 10, customer_name: "Test customer", total: "20", delivery_fee: "3",
  status: "on_the_way", payment_method: "cash", created_at: "2026-10-29T15:00:00Z",
  items: [], delivery_partner_id: 20, courier_name: "Test courier",
  courier_email: "courier@example.test", courier_dni: "00123456",
  courier_vehicle_plate: "TST001",
};

test("authorized business and system administration receive assigned courier documents through the API schema", () => {
  for (const role of ["administrador_negocio", "administrador_sistema"]) {
    const order = GetOrderResponse.parse(toOrder(assigned, role));
    assert.equal(order.deliveryPartnerDni, "00123456");
    assert.equal(order.deliveryPartnerVehiclePlate, "TST001");
  }
});

test("customer, courier, and default serializers do not disclose documents", () => {
  for (const role of ["cliente", "repartidor", undefined]) {
    const order = toOrder(assigned, role);
    assert.equal("deliveryPartnerDni" in order, false);
    assert.equal("deliveryPartnerVehiclePlate" in order, false);
  }
});

test("unassigned orders never include stale courier documents", () => {
  const order = toOrder({ ...assigned, delivery_partner_id: null }, "administrador_negocio");
  assert.equal("deliveryPartnerDni" in order, false);
  assert.equal("deliveryPartnerVehiclePlate" in order, false);
});

test("legacy couriers without documents retain the assignment with explicit empty document values", () => {
  const order = GetOrderResponse.parse(toOrder({
    ...assigned, courier_dni: null, courier_vehicle_plate: null,
  }, "administrador_negocio"));
  assert.equal(order.deliveryPartnerName, "Test courier");
  assert.equal(order.deliveryPartnerDni, "");
  assert.equal(order.deliveryPartnerVehiclePlate, "");
});
