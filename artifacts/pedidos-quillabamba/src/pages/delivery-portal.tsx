import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bike, Check, ClipboardList, CreditCard, LogOut, MapPin, PackageCheck, RefreshCw, Wallet } from 'lucide-react';
import { getListOrdersQueryKey, useClaimOrder, useListOrders, useUpdateOrderStatus } from '@workspace/api-client-react';
import type { Order, OrderStatusInputStatus } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { clearSession, readSession } from '@/pages/role-access';
import { BrandLogo } from '@/components/brand-logo';

function statusLabel(status: Order['status']) {
  return ({
    received: 'Recibido',
    preparing: 'En preparación',
    ready: 'Listo para recoger',
    on_the_way: 'En camino',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  })[status];
}

function isHttpConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
}

const maxLocationAccuracyMeters = 250;
const minimumPhotoSharpness = 32;

function measurePhotoSharpness(source: HTMLCanvasElement) {
  const scale = Math.min(1, 320 / source.width);
  const width = Math.max(64, Math.round(source.width * scale));
  const height = Math.max(64, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return 0;
  context.drawImage(source, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const grayscale = new Float32Array(width * height);
  for (let i = 0; i < grayscale.length; i++) {
    const offset = i * 4;
    grayscale[i] = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
  }
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const laplacian = grayscale[index - width] + grayscale[index + width]
        + grayscale[index - 1] + grayscale[index + 1] - 4 * grayscale[index];
      sum += laplacian;
      sumSquares += laplacian * laplacian;
      count++;
    }
  }
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

function waitForAccuratePosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    let watchId: number | undefined;
    let settled = false;
    const timeoutId = window.setTimeout(() => finish(() => reject(new Error('No se obtuvo una ubicación GPS suficientemente precisa. Activa el GPS y vuelve a intentar.'))), 25_000);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timeoutId);
      callback();
    };
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy <= maxLocationAccuracyMeters) finish(() => resolve(position));
      },
      (error) => finish(() => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Debes permitir la ubicación precisa para iniciar el reparto.'
          : 'No se pudo obtener la ubicación GPS. Activa el GPS y vuelve a intentar.',
      ))),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}

async function uploadCurrentPosition(orderId: number, position: GeolocationPosition) {
  if (position.coords.accuracy > maxLocationAccuracyMeters) {
    throw new Error('La ubicación todavía no es suficientemente precisa. Espera un momento y vuelve a intentar.');
  }
  const response = await fetch(`/api/orders/${orderId}/location`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(typeof data?.error === 'string' ? data.error : 'No se pudo compartir la ubicación.');
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const data = (error as { data?: { error?: string } }).data;
    if (typeof data?.error === 'string') return data.error;
  }
  return fallback;
}

function OrderCard({
  order,
  action,
  actionLabel,
  disabled,
  actionTestId,
}: {
  order: Order;
  action: () => void;
  actionLabel: string;
  disabled: boolean;
  actionTestId: string;
}) {
  const paymentLabel = order.paymentMethod === 'yape' ? 'Yape' : order.paymentMethod === 'card' ? 'Tarjeta' : 'Efectivo';
  const PaymentIcon = order.paymentMethod === 'yape' ? Wallet : order.paymentMethod === 'card' ? CreditCard : null;

  return (
    <article className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5" data-testid={`card-delivery-order-${order.id}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-app text-[10px] font-bold uppercase tracking-[.16em] text-accent">
              Pedido #{String(order.id).padStart(4, '0')}
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold">{statusLabel(order.status)}</span>
          </div>
          <h3 className="mt-2 font-display text-lg font-bold">{order.customerName}</h3>
          <div className="mt-3 rounded-xl bg-secondary/35 p-3 text-sm">
            <p className="text-xs font-bold uppercase">Recoger en</p>
            <p className="mt-1 font-bold">{order.restaurantName}</p>
            <p>{order.businessAddress || 'El negocio aún no registró su dirección de recojo.'}</p>
            {order.businessPhone&&<a href={`tel:${order.businessPhone.replace(/[^\d+]/g,'')}`} className="mt-1 inline-flex min-h-11 items-center text-xs font-bold underline">Llamar al negocio: {order.businessPhone}</a>}
          </div>
          <p className="mt-2 flex items-start gap-2 text-sm leading-5">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="break-words">{order.deliveryAddress || 'Dirección no registrada'}</span>
          </p>
          {order.customerPhone&&<a href={`tel:${order.customerPhone.replace(/[^\d+]/g,'')}`} className="mt-1 inline-flex min-h-11 items-center text-xs font-bold underline">Llamar al cliente: {order.customerPhone}</a>}
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#f7f5ee] px-3 py-2 text-xs font-bold">
          {PaymentIcon ? <PaymentIcon className="h-4 w-4" /> : <span className="font-mono-app">S/</span>}
          {paymentLabel}
          <span className="ml-2 font-mono-app text-sm">S/ {order.total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#f7f5ee] p-3">
        <p className="font-mono-app text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Detalle</p>
        <ul className="mt-2 space-y-1.5 text-xs font-semibold">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>{item.name} × {item.quantity}</span>
              <span className="shrink-0">S/ {(item.price * item.quantity).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={action}
        disabled={disabled}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-extrabold text-white disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-48"
        data-testid={actionTestId}
      >
        {actionLabel}
      </button>
    </article>
  );
}

export default function DeliveryPortalPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const session = readSession();
  const [notice, setNotice] = useState('');
  const [savingProof,setSavingProof]=useState(false);
  const [proofPhoto, setProofPhoto] = useState<{ orderId: number; file: File; url: string; sharpness: number } | null>(null);
  const [cameraOrderId, setCameraOrderId] = useState<number | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraRequestRef = useRef(0);
  const ordersQuery = useListOrders({
    query: { queryKey: getListOrdersQueryKey(), refetchInterval: 4000, refetchOnWindowFocus: true },
  });
  const claimOrder = useClaimOrder();
  const updateStatus = useUpdateOrderStatus();

  const courierEmail = session?.email.trim().toLowerCase() ?? '';
  const orders = ordersQuery.data ?? [];
  const availableOrders = orders.filter((order) => (
    !order.deliveryPartnerUserId && ['received', 'preparing', 'ready'].includes(order.status)
  ));
  const readyCount = availableOrders.filter((order) => order.status === 'ready').length;
  const myActiveOrders = orders.filter((order) => (
    order.deliveryPartnerEmail?.toLowerCase() === courierEmail
    && order.status !== 'delivered'
    && order.status !== 'cancelled'
  ));
  const completedOrders = orders.filter((order) => (
    order.deliveryPartnerEmail?.toLowerCase() === courierEmail && order.status === 'delivered'
  ));
  const trackingIds = myActiveOrders.filter((order) => order.status === 'on_the_way').map((order) => order.id).join(',');

  useEffect(() => () => {
    if (proofPhoto) URL.revokeObjectURL(proofPhoto.url);
  }, [proofPhoto]);

  useEffect(() => {
    const video = cameraVideoRef.current;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      void video.play().catch(() => setNotice('No se pudo iniciar la vista de cámara. Comprueba el permiso del navegador.'));
    }
    return () => cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream, cameraOrderId]);

  useEffect(() => {
    if (!trackingIds || !navigator.geolocation) return;
    const watchers = trackingIds.split(',').map(Number).map((orderId) => navigator.geolocation.watchPosition(
      (position) => {
        if (position.coords.accuracy > maxLocationAccuracyMeters) {
          setNotice('El GPS está buscando una ubicación más precisa…');
          return;
        }
        void uploadCurrentPosition(orderId, position).catch((error) => setNotice(errorMessage(error, 'No se pudo actualizar tu ubicación.')));
      },
      () => setNotice('No se pudo actualizar tu ubicación. Revisa el permiso de ubicación del navegador.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    ));
    return () => watchers.forEach((watcher) => navigator.geolocation.clearWatch(watcher));
  }, [trackingIds]);

  const claim = (orderId: number) => {
    if (!session || session.role !== 'repartidor') {
      setNotice('Inicia sesión con una cuenta de repartidor para tomar pedidos.');
      return;
    }
    setNotice('');
    claimOrder.mutate(
      { orderId, data: { courierEmail: session.email, courierName: session.name } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setNotice(`Tomaste el pedido #${orderId}. Ya está asignado a tu cuenta.`);
        },
        onError: (error) => {
          setNotice(isHttpConflict(error)
            ? 'Otro repartidor acaba de tomar ese pedido. La lista se actualizará automáticamente.'
            : 'No se pudo tomar el pedido. Inténtalo nuevamente.');
          void queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
        },
      },
    );
  };

  const advanceOrder = (order: Order) => {
    const status: OrderStatusInputStatus = order.status === 'on_the_way' ? 'delivered' : 'on_the_way';
    if (status === 'on_the_way') {
      if (!navigator.geolocation) {
        setNotice('Este dispositivo no permite compartir ubicación. No se puede iniciar el reparto.');
        return;
      }
      setNotice('Buscando una ubicación GPS precisa; mantén el permiso activado…');
      void waitForAccuratePosition()
        .then((position) => uploadCurrentPosition(order.id, position))
        .then(() => updateStatus.mutateAsync({ orderId: order.id, data: { status } }))
        .then(async () => {
          await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setNotice(`El pedido #${order.id} está en camino y comparte tu ubicación con su cliente.`);
        })
        .catch((error) => setNotice(errorMessage(error, 'No se pudo iniciar el reparto. Inténtalo nuevamente.')));
      return;
    }
    updateStatus.mutate(
      { orderId: order.id, data: { status } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setNotice(status === 'delivered'
            ? `El pedido #${order.id} quedó marcado como entregado.`
            : `El pedido #${order.id} está en camino.`);
        },
        onError: () => setNotice('No se pudo actualizar el estado del pedido.'),
      },
    );
  };

  const closeCamera = () => {
    cameraRequestRef.current++;
    setCameraOrderId(null);
    setCameraStream(null);
  };

  const openPhotoCapture = async (orderId: number) => {
    setNotice('');
    setProofPhoto(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('Este navegador no permite abrir la cámara. Usa un navegador actualizado y vuelve a intentar.');
      return;
    }
    const requestId = ++cameraRequestRef.current;
    setCameraOrderId(orderId);
    setCameraStream(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraStream(stream);
    } catch (error) {
      if (requestId !== cameraRequestRef.current) return;
      setCameraOrderId(null);
      const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
      setNotice(name === 'NotAllowedError'
        ? 'Permite el acceso a la cámara para tomar el comprobante.'
        : name === 'NotFoundError'
          ? 'No se encontró una cámara en este dispositivo.'
          : 'No se pudo abrir la cámara. Comprueba sus permisos e inténtalo de nuevo.');
    }
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video || !cameraStream || cameraOrderId === null || !video.videoWidth || !video.videoHeight) {
      setNotice('La cámara todavía está iniciando. Espera un momento y vuelve a capturar.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setNotice('No se pudo capturar la foto. Inténtalo nuevamente.');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sharpness = measurePhotoSharpness(canvas);
    if (sharpness < minimumPhotoSharpness) {
      setNotice('La foto se ve borrosa. Mantén el celular firme, espera el enfoque y vuelve a capturar.');
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setNotice('No se pudo procesar la foto. Inténtalo nuevamente.');
        return;
      }
      if (blob.size > 5 * 1024 * 1024) {
        setNotice('La foto pesa más de 5 MB. Aléjate un poco e inténtalo nuevamente.');
        return;
      }
      const file = new File([blob], `comprobante-${cameraOrderId}.jpg`, { type: 'image/jpeg' });
      setProofPhoto({ orderId: cameraOrderId, file, url: URL.createObjectURL(blob), sharpness });
      setNotice('Nitidez verificada. El comprobante privado debe guardarse antes de marcar el pedido como realizado.');
      closeCamera();
    }, 'image/jpeg', 0.88);
  };

  const completeDelivery=async()=>{
    if(!proofPhoto||savingProof)return;
    setSavingProof(true);setNotice('');
    try{
      const form=new FormData();form.append('file',proofPhoto.file);
      const response=await fetch(`/api/orders/${proofPhoto.orderId}/proof`,{method:'POST',credentials:'include',body:form});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'No se pudo guardar el comprobante.');
      await queryClient.invalidateQueries({queryKey:getListOrdersQueryKey()});
      setProofPhoto(null);
      setNotice('Comprobante guardado de forma privada. Pedido entregado.');
    }catch(e){setNotice(e instanceof Error?e.message:'No se pudo confirmar la entrega.');}
    finally{setSavingProof(false);}
  };

  const logout = () => {
    clearSession();
    setLocation('/login');
  };

  const pendingCount = myActiveOrders.length;
  const completedCount = completedOrders.length;

  return (
    <main className="min-h-[100dvh] bg-[#f1efe7] text-primary">
      {cameraOrderId !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" data-testid="dialog-delivery-camera">
          <section role="dialog" aria-modal="true" aria-labelledby="delivery-camera-title" className="w-full max-w-xl rounded-t-3xl bg-card p-4 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="delivery-camera-title" className="font-display text-lg font-bold">Foto del pedido #{cameraOrderId}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Encuadra la entrega y captura la foto aquí.</p>
              </div>
              <button type="button" onClick={closeCamera} className="min-h-11 rounded-xl px-3 text-sm font-bold text-muted-foreground" data-testid="button-close-delivery-camera">Cancelar</button>
            </div>
            {cameraStream ? (
              <video ref={cameraVideoRef} autoPlay playsInline muted className="max-h-[62dvh] min-h-56 w-full rounded-2xl bg-black object-contain" data-testid="video-delivery-camera" />
            ) : (
              <div className="flex min-h-56 items-center justify-center rounded-2xl bg-black px-6 text-center text-sm text-white">Solicitando permiso para abrir la cámara…</div>
            )}
            <button type="button" onClick={capturePhoto} disabled={!cameraStream} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50" data-testid="button-capture-delivery-photo">Capturar foto</button>
          </section>
        </div>
      )}
      <header className="border-b border-border/70 bg-[#f7f5ee]">
        <div className="mx-auto flex min-h-16 max-w-[1200px] items-center gap-3 px-4 py-2 sm:px-5 md:px-8">
          <BrandLogo />
          <div>
            <p className="font-display font-bold">QUILLAYAA</p>
            <p className="font-mono-app text-[9px] uppercase tracking-[.14em] text-muted-foreground">Panel de repartidor</p>
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-44 truncate text-xs font-semibold text-muted-foreground sm:block">{session?.name || 'Repartidor'}</span>
            <button onClick={logout} className="flex min-h-10 items-center gap-2 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-white" data-testid="button-delivery-logout">
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-5 sm:py-8 md:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono-app text-[10px] font-bold uppercase tracking-[.18em] text-accent">Última milla</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-.04em]">Pedidos de reparto</h1>
            <p className="mt-2 text-sm text-muted-foreground">Los pedidos nuevos aparecen aquí. El primero que lo tome queda asignado.</p>
          </div>
          <button
            type="button"
            onClick={() => void ordersQuery.refetch()}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-card px-4 py-2 text-xs font-bold ring-1 ring-border"
            data-testid="button-delivery-refresh"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        </div>

        {notice && <p role="status" className="mt-4 rounded-xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800" data-testid="status-delivery-feedback">{notice}</p>}
        <div className="mt-6 grid gap-3 min-[520px]:grid-cols-3">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><PackageCheck className="h-5 w-5 text-accent" /><p className="mt-3 font-mono-app text-2xl font-bold">{pendingCount}</p><p className="mt-1 text-xs font-bold">Pedidos asignados</p></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><MapPin className="h-5 w-5 text-accent" /><p className="mt-3 font-mono-app text-2xl font-bold">{readyCount}</p><p className="mt-1 text-xs font-bold">Listos para tomar</p><p className="mt-1 text-xs text-muted-foreground">{availableOrders.length - readyCount} pendientes del negocio</p></div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border sm:p-5"><ClipboardList className="h-5 w-5 text-accent" /><p className="mt-3 font-mono-app text-2xl font-bold">{completedCount}</p><p className="mt-1 text-xs font-bold">Entregados por ti</p></div>
        </div>

        {ordersQuery.isLoading ? (
          <div className="mt-8 rounded-2xl bg-card p-6 text-sm text-muted-foreground">Cargando pedidos…</div>
        ) : ordersQuery.isError ? (
          <div className="mt-8 rounded-2xl bg-card p-6 ring-1 ring-border">
            <p role="alert" className="text-sm font-bold text-red-700">No se pudieron cargar los pedidos.</p>
            <button onClick={() => void ordersQuery.refetch()} className="mt-3 min-h-11 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white">Reintentar</button>
          </div>
        ) : (
          <>
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="font-display text-xl font-bold">Pedidos disponibles</h2><p className="mt-1 text-xs text-muted-foreground">Los pedidos aparecen desde que el cliente confirma. Puedes tomarlos cuando el negocio los marque listos. Actualización automática cada pocos segundos.</p></div>
                <span className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">{availableOrders.length} pedidos · {readyCount} listos</span>
              </div>
              <div className="mt-4 grid gap-4">
                {availableOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    action={() => claim(order.id)}
                    actionLabel={order.status === 'received' ? 'Esperando confirmación del negocio' : order.status === 'preparing' ? 'El negocio está preparando el pedido' : claimOrder.isPending ? 'Tomando pedido…' : 'Tomar pedido'}
                    disabled={claimOrder.isPending || order.status !== 'ready'}
                    actionTestId={`button-claim-order-${order.id}`}
                  />
                ))}
                {!availableOrders.length && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">No hay pedidos nuevos sin asignar. Esta lista se actualizará automáticamente.</div>}
              </div>
            </section>

            <section className="mt-9">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><h2 className="font-display text-xl font-bold">Mis pedidos</h2><p className="mt-1 text-xs text-muted-foreground">Solo aparecen pedidos que tomaste con esta cuenta.</p></div>
                <span className="font-mono-app text-[10px] uppercase tracking-wide text-muted-foreground">{myActiveOrders.length} activos</span>
              </div>
              <div className="mt-4 grid gap-4">
                {myActiveOrders.map((order) => (
                  <div key={order.id} className="space-y-3">
                    <OrderCard
                      order={order}
                      action={() => order.status === 'on_the_way' ? openPhotoCapture(order.id) : advanceOrder(order)}
                      actionLabel={updateStatus.isPending
                        ? 'Guardando…'
                        : order.status === 'on_the_way'
                          ? proofPhoto?.orderId === order.id ? 'Tomar otra foto' : 'Tomar foto del comprobante'
                          : 'Marcar en camino'}
                      disabled={updateStatus.isPending}
                      actionTestId={`button-advance-order-${order.id}`}
                    />
                    {proofPhoto?.orderId === order.id && (
                      <div className="rounded-2xl bg-card p-4 ring-1 ring-border" data-testid={`preview-delivery-photo-${order.id}`}>
                        <img src={proofPhoto.url} alt={`Vista previa de la foto del pedido ${order.id}`} className="max-h-72 w-full rounded-xl object-contain" />
                        <p className="mt-3 break-words text-xs font-bold">Nitidez verificada</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">La foto está lista en este dispositivo, pero todavía no se guardó como comprobante privado.</p>
                        <button disabled={savingProof} onClick={()=>void completeDelivery()} data-testid={`button-confirm-delivery-${order.id}`} className="mt-4 min-h-11 w-full rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{savingProof?'Guardando…':'Guardar comprobante y confirmar entrega'}</button>
                        <button disabled={savingProof} onClick={()=>setProofPhoto(null)} className="mt-2 min-h-11 w-full rounded-xl border border-border px-4 text-sm font-bold">Descartar foto</button>
                      </div>
                    )}
                  </div>
                ))}
                {!myActiveOrders.length && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Cuando tomes un pedido, aparecerá aquí para que puedas gestionarlo.</div>}
              </div>
            </section>

            <section className="mt-9">
              <h2 className="font-display text-xl font-bold">Entregas realizadas</h2>
              {completedOrders.length ? (
                <div className="mt-4 grid gap-3">
                  {completedOrders.map((order) => (
                    <div key={order.id} className="flex flex-col justify-between gap-2 rounded-2xl bg-[#ede4ff] p-4 sm:flex-row sm:items-center sm:p-5" data-testid={`card-delivery-completed-${order.id}`}>
                      <div><p className="font-mono-app text-[10px] uppercase tracking-wide text-accent">Pedido #{order.id}</p><p className="mt-1 font-bold">{order.customerName}</p><p className="mt-1 break-words text-xs text-muted-foreground">{order.deliveryAddress || 'Dirección no registrada'} · S/ {order.total.toFixed(2)}</p></div>
                      <span className="flex items-center gap-2 text-xs font-bold text-violet-800"><Check className="h-4 w-4" /> Entregado</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">Tus entregas completadas aparecerán aquí.</div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
