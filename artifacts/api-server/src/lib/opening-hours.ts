import { z } from "zod";

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const openingHoursSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    .refine(days => new Set(days).size === days.length, "No repitas los días."),
  opensAt: time,
  closesAt: time,
}).strict().refine(hours => hours.opensAt !== hours.closesAt, "La apertura y el cierre deben ser diferentes.");

type OpeningHours = z.infer<typeof openingHoursSchema>;
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Lima", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

/** Opening is inclusive; closing is exclusive. Overnight hours belong to the opening day. */
export function isBusinessOpen(manualOpen: boolean, hours: OpeningHours | null, now = new Date()): boolean {
  if (!manualOpen) return false;
  if (!hours) return true; // Preserve the manual status until a schedule is configured.
  const parts = Object.fromEntries(clock.formatToParts(now).map(p => [p.type, p.value]));
  const day = weekdays.indexOf(parts.weekday);
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const start = minutes(hours.opensAt), end = minutes(hours.closesAt);
  if (start < end) return hours.days.includes(day) && current >= start && current < end;
  return hours.days.includes(day) && current >= start
    || hours.days.includes((day + 6) % 7) && current < end;
}
