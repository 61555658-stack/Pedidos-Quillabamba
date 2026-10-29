import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// The additive SQL migration supplies the FK to the retained public.users table.
export const businessAdministratorCredentials = pgTable("business_administrator_credentials", {
  userId: integer("user_id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
