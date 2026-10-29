import type { OpeningHours } from '@workspace/api-client-react';

export const weekDays = [
  { value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' }, { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' }, { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export function OpeningHoursEditor({ value, onChange }: {
  value: OpeningHours | null; onChange: (value: OpeningHours | null) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-border p-4 sm:col-span-2 lg:col-span-3">
      <legend className="px-1 text-sm font-bold">Horario de atención</legend>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
        <input type="checkbox" checked={value !== null}
          onChange={event => onChange(event.target.checked ? { days: [1, 2, 3, 4, 5, 6], opensAt: '09:00', closesAt: '22:00' } : null)}
          data-testid="checkbox-schedule-enabled" />
        Abrir y cerrar automáticamente según el horario
      </label>
      {value && <>
        <p className="mt-2 text-xs text-muted-foreground">Días de atención</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {weekDays.map(day => <label key={day.value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={value.days.includes(day.value)}
              onChange={event => onChange({ ...value, days: event.target.checked ? [...value.days, day.value].sort() : value.days.filter(d => d !== day.value) })}
              data-testid={`checkbox-day-${day.value}`} />{day.label}
          </label>)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Hora de apertura
            <input type="time" value={value.opensAt} required aria-label="Hora de apertura"
              onChange={event => onChange({ ...value, opensAt: event.target.value })}
              className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
              data-testid="input-opening-time" />
          </label>
          <label className="text-xs font-semibold">Hora de cierre
            <input type="time" value={value.closesAt} required aria-label="Hora de cierre"
              onChange={event => onChange({ ...value, closesAt: event.target.value })}
              className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
              data-testid="input-closing-time" />
          </label>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">Hora de Perú (America/Lima). El mismo horario aplica a los días seleccionados. Si el cierre es antes de la apertura, termina al día siguiente.</p>
      </>}
      {!value && <p className="text-xs text-muted-foreground">Sin horario automático: se mantiene el control manual de apertura.</p>}
    </fieldset>
  );
}

export function OpeningHoursSummary({ hours }: { hours?: OpeningHours | null }) {
  if (!hours) return null;
  return <p className="mt-2 text-xs leading-5 text-muted-foreground" data-testid="text-opening-hours">
    {weekDays.filter(d => hours.days.includes(d.value)).map(d => d.label).join(', ')}
    {' · '}{hours.opensAt}–{hours.closesAt}
    {hours.closesAt < hours.opensAt ? ' (cierre al día siguiente)' : ''} · Hora de Perú
  </p>;
}
