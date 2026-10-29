---
name: Vouchers de compras
description: Alcance y significado del voucher de QUILLAYAA, envío por correo e historial privado.
---

Al confirmar un pedido se debe generar un voucher tipo recibo, enviarlo al correo del cliente y conservarlo en una sección de la interfaz del cliente para consultar sus compras.

**Why:** El usuario pidió ese flujo y mostró un recibo bancario como referencia visual.

**How to apply:** Usar identidad QUILLAYAA y formato de recibo, no identidad de un banco. Conservar productos, cantidades, precios y total de la compra sin alterarlos cuando cambien el catálogo o el perfil. Separar productos y delivery, usar soles y fecha/hora de Perú. Solo el cliente propietario puede consultar, descargar o reenviar su voucher.

El voucher confirma el pedido, no un cobro verificado ni una factura/boleta fiscal.

**Why:** La aplicación registra un método de pago declarado, pero todavía no tiene conciliación que pruebe el cobro ni emisión fiscal.

**How to apply:** Mostrar «Pago no verificado» y aclarar su naturaleza. Que SendGrid acepte un envío tampoco demuestra que llegó a la bandeja del cliente; distinguir aceptación de entrega real.

El pedido y su voucher deben persistir aunque falle el correo. Los vouchers de compras anteriores pueden generarse sin enviar correos históricos automáticamente.

**Why:** Un fallo del proveedor no debe perder compras ni provocar pedidos duplicados; incorporar el historial no debe enviar mensajes inesperados de todas las compras pasadas.

**How to apply:** Mantener reintentos persistentes de correo y permitir descargar el PDF independientemente del estado de envío.
