import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// public.users is a retained legacy table; the SQL migration supplies its foreign key.
export const courierRegistrationProfiles = pgTable("courier_registration_profiles", {
  userId: integer("user_id").primaryKey(),
  dni: text("dni").notNull(),
  licenseNumber: text("license_number").notNull(),
  vehiclePlate: text("vehicle_plate").notNull(),
  soatCompany: text("soat_company").notNull(),
  soatPolicyNumber: text("soat_policy_number").notNull(),
  soatStartDate: date("soat_start_date", { mode: "string" }).notNull(),
  soatEndDate: date("soat_end_date", { mode: "string" }).notNull(),
  soatVerifiedAt: timestamp("soat_verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type CourierRegistrationProfile = typeof courierRegistrationProfiles.$inferSelect;
