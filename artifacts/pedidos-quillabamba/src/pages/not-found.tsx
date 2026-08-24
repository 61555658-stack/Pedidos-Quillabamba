import { ArrowLeft, Compass, Utensils } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="paper-grid flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <div className="w-full max-w-xl rounded-3xl bg-card p-8 text-center ring-1 ring-border warm-shadow sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Compass className="h-7 w-7" />
        </div>
        <p className="mt-7 font-mono-app text-[10px] font-bold uppercase tracking-[.2em] text-accent">Parada equivocada</p>
        <h1 className="mt-3 font-display text-4xl font-bold tracking-[-.05em] text-primary">Esta dirección no existe.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Pero todavía estás a tiempo de encontrar algo rico cerca de ti.</p>
        <Link href="/" className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-white" data-testid="link-not-found-home"><Utensils className="h-4 w-4 text-secondary" /> Volver a descubrir <ArrowLeft className="h-4 w-4 rotate-180 text-secondary" /></Link>
      </div>
    </div>
  );
}
