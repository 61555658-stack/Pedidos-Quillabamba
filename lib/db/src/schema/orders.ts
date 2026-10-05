import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type StoredOrderItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  restaurantName: text("restaurant_name").notNull(),
  customerId: integer("customer_id").references(() => usersTable.id, { onDelete: "set null" }),
  customerName: text("customer_name").notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("received"),
  paymentMethod: text("payment_method").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deliveryAddress: text("delivery_address").notNull(),
  items: jsonb("items").$type<StoredOrderItem[]>().notNull(),
  deliveryPartnerId: integer("delivery_partner_id").references(() => usersTable.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;