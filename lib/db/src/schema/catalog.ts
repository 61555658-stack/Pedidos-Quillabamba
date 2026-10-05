import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const restaurantsTable = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cuisine: text("cuisine").notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }).notNull().default("0"),
  deliveryMinutes: integer("delivery_minutes").notNull().default(30),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  isOpen: boolean("is_open").notNull().default(true),
  image: text("image").notNull(),
  featured: boolean("featured").notNull().default(false),
});

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull().references(() => restaurantsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  image: text("image").notNull().default(""),
  popular: boolean("popular").notNull().default(false),
  stock: integer("stock").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRestaurantSchema = createInsertSchema(restaurantsTable).omit({ id: true });
export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true, createdAt: true });
export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type Restaurant = typeof restaurantsTable.$inferSelect;
export type Category = typeof categoriesTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type Setting = typeof settingsTable.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;