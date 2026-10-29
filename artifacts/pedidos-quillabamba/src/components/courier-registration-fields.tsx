import { useEffect, useRef, useState } from 'react';
import { verifyCourierSoat, type CourierDocuments, type CourierSoatResult } from '@workspace/api-client-react';

export function useCourierSoat(email: string, plate: string, enabled: boolean) {
  const [result, setResult] = useState<CourierSoatResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    controller.current?.abort();
    setResult(null); setError(''); setChecking(false);
    return () => { controller.current?.abort(); };
  }, [email, plate, enabled]);
  const verify = async (): Promise<CourierSoatResult | null> => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setChecking(true); setError(''); setResult(null);
    try {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Ingresa primero tu correo electrónico.');
      if (!/^[A-Z0-9-]{4,10}$/i.test(plate)) throw new Error('Ingresa una placa válida para consultar el SOAT.');
      const deadline = Date.now() + 120_000;
      while (!abort.signal.aborted && Date.now() < deadline) {
        const response = await verifyCourierSoat({ email: email.trim().toLowerCase(), plate }, { signal: abort.signal });
        if (response.status !== 'pending') {
          if (!abort.signal.aborted) setResult(response);
          return abort.signal.aborted ? null : response;
        }
        await new Promise<void>((resolve, reject) => {
          const done = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', cancel); };
          const cancel = () => { done(); reject(new Error('Consulta cancelada.')); };
          const timer = setTimeout(() => { done(); resolve(); }, 2500);
          abort.signal.addEventListener('abort', cancel, { once: true });
        });
      }
      throw new Error('La consulta está tardando más de lo esperado. Vuelve a verificar el SOAT.');
    } catch (cause) {
      if (!abort.signal.aborted) {
        const body = (cause as { data?: { error?: string } })?.data;
        setError(body?.error || (cause instanceof Error ? cause.message : 'No se pudo confirmar el SOAT. Inténtalo nuevamente.'));
      }
      return null;
    } finally {
      if (controller.current === abort) setChecking(false);
    }
  };
  return { result, checking, error, verify };
}

export function CourierRegistrationFields({ value, onChange, disabled, soat }: {
  value: CourierDocuments; onChange: (value: CourierDocuments) => void; disabled: boolean;
  soat: ReturnType<typeof useCourierSoat>;
}) {
  return <fieldset className="mt-5 min-w-0 space-y-4 rounded-2xl border border-border p-4" disabled={disabled || soat.checking}>
    <legend className="px-1 text-sm font-bold text-primary">Datos del repartidor y vehículo</legend>
    <p className="text-xs leading-5 text-muted-foreground">Completa tus documentos. Consultaremos el SOAT por la placa de tu vehículo; es obligatorio que esté vigente.</p>
    {([
      ['dni', 'DNI', '8 dígitos', 8],
      ['licenseNumber', 'Número de licencia de conducir', 'Número de licencia', 20],
      ['vehiclePlate', 'Placa del vehículo', 'Ej. ABC-123', 10],
    ] as const).map(([field, label, placeholder, length]) => <label key={field} className="block">
      <span className="mb-1.5 block text-xs font-bold text-primary">{label}</span>
      <input value={value[field]} required maxLength={length} inputMode={field === 'dni' ? 'numeric' : 'text'}
        pattern={field === 'dni' ? '[0-9]{8}' : field === 'vehiclePlate' ? '[A-Za-z0-9\\-]{4,10}' : '[A-Za-z0-9\\-]{5,20}'}
        autoCapitalize="characters" autoComplete="off" placeholder={placeholder}
        onChange={event => onChange({ ...value, [field]: field === 'dni'
          ? event.target.value.replace(/\D/g, '') : event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })}
        className="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base outline-none focus:border-accent disabled:opacity-60 sm:text-sm"
        data-testid={`input-courier-${field}`} />
    </label>)}
    <div className="rounded-xl bg-secondary/20 p-3">
      <p className="text-sm font-bold text-primary">SOAT del vehículo</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Verificación con Croma por placa. Sin SOAT activo no podrás crear tu cuenta.</p>
      <button type="button" onClick={() => void soat.verify()} disabled={disabled || soat.checking}
        className="mt-3 min-h-11 w-full rounded-full border border-primary px-4 text-sm font-bold text-primary disabled:opacity-60"
        data-testid="button-courier-soat-verify">{soat.checking ? 'Consultando SOAT…' : 'Verificar SOAT por placa'}</button>
      <div aria-live="polite" className="mt-2 text-xs leading-5" data-testid="status-courier-soat">
        {soat.checking && <p>Consultando el seguro. Esto puede tardar hasta dos minutos.</p>}
        {soat.result?.status === 'active' && <p className="font-semibold text-green-800">SOAT vigente · {soat.result.company}<br />Vigencia: {soat.result.startDate} al {soat.result.endDate}</p>}
        {soat.result?.status === 'inactive' && <p className="font-semibold text-red-700">Esta placa no tiene un SOAT activo. No puedes registrarte hasta contar con un seguro vigente.</p>}
        {soat.error && <p role="alert" className="font-semibold text-red-700">{soat.error}</p>}
      </div>
    </div>
  </fieldset>;
}
