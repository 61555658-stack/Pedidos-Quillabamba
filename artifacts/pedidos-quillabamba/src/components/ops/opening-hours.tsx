import { useState } from 'react';
import type { OpeningHours } from '@workspace/api-client-react';
import { btnPrimary } from './ui';

export const weekDays = [
  { value: 1, label: 'Lunes' }, { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' }, { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' }, { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

function dayRange(from: number, to: number) {
  const start = weekDays.findIndex(day => day.value === from);
  const end = weekDays.findIndex(day => day.value === to);
  return Array.from({ length: (end - start + 7) % 7 + 1 }, (_, index) => weekDays[(start + index) % 7].value);
}

function rangeBounds(days: number[]) {
  for (const from of weekDays) {
    for (const to of weekDays) {
      const range = dayRange(from.value, to.value);
      if (range.length === days.length && range.every(day => days.includes(day))) {
        return { from: String(from.value), to: String(to.value) };
      }
    }
  }
  return { from: '', to: '' };
}

export function OpeningHoursEditor({ value, onChange }: {
  value: OpeningHours | null; onChange: (value: OpeningHours | null) => void;
}) {
  const bounds = rangeBounds(value?.days ?? []);
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
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Desde el día
            <select value={bounds.from} onChange={event => onChange({ ...value, days: dayRange(Number(event.target.value), Number(bounds.to || '0')) })}
              className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm" data-testid="select-opening-day">
              <option value="" disabled>Días específicos</option>
              {weekDays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold">Hasta el día
            <select value={bounds.to} onChange={event => onChange({ ...value, days: dayRange(Number(bounds.from || '1'), Number(event.target.value)) })}
              className="mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm" data-testid="select-closing-day">
              <option value="" disabled>Días específicos</option>
              {weekDays.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
            </select>
          </label>
        </div>
        <details className="mt-3">
          <summary className="min-h-8 cursor-pointer text-xs font-semibold">Elegir días específicos</summary>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {weekDays.map(day => <label key={day.value} className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={value.days.includes(day.value)}
              onChange={event => onChange({ ...value, days: event.target.checked ? [...value.days, day.value].sort() : value.days.filter(d => d !== day.value) })}
              data-testid={`checkbox-day-${day.value}`} />{day.label}
          </label>)}
          </div>
        </details>
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

export function BusinessHoursForm({ initialHours, initiallyOpen, saving, onSubmit, onError }: {
  initialHours: OpeningHours | null; initiallyOpen: boolean; saving: boolean;
  onSubmit: (body: { openingHours: OpeningHours | null; isOpen: boolean }) => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [hours, setHours] = useState<OpeningHours | null>(initialHours
    ? { ...initialHours, days: [...initialHours.days] }
    : { days: [1, 2, 3, 4, 5, 6], opensAt: '09:00', closesAt: '22:00' });
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return <form className="space-y-4" onSubmit={event => {
    event.preventDefault();
    if (hours && (!hours.days.length || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours.opensAt)
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hours.closesAt) || hours.opensAt === hours.closesAt)) {
      onError('Selecciona los días y horas de apertura y cierre válidas y diferentes.');
      return;
    }
    void onSubmit({ openingHours: hours, isOpen });
  }}>
    <p className="text-sm text-muted-foreground">Indica de qué día a qué día atiendes y a qué hora abres y cierras. Los clientes verán tu negocio abierto o cerrado según este horario.</p>
    <OpeningHoursEditor value={hours} onChange={setHours} />
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <input type="checkbox" checked={isOpen} onChange={event => setIsOpen(event.target.checked)} data-testid="checkbox-hours-accept-orders" />
      {hours ? 'Recibir pedidos dentro del horario' : 'Negocio abierto para pedidos'}
    </label>
    <p className="text-xs text-muted-foreground">Si desmarcas esta opción, el negocio permanecerá cerrado aunque esté dentro del horario.</p>
    <button type="submit" className={btnPrimary} disabled={saving} data-testid="button-hours-save">
      {saving ? 'Guardando…' : 'Guardar horario'}
    </button>
  </form>;
}

export function OpeningHoursSummary({ hours }: { hours?: OpeningHours | null }) {
  if (!hours) return null;
  return <p className="mt-2 text-xs leading-5 text-muted-foreground" data-testid="text-opening-hours">
    {weekDays.filter(d => hours.days.includes(d.value)).map(d => d.label).join(', ')}
    {' · '}{hours.opensAt}–{hours.closesAt}
    {hours.closesAt < hours.opensAt ? ' (cierre al día siguiente)' : ''} · Hora de Perú
  </p>;
}
