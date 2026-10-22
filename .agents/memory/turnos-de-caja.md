---
name: Turnos de caja del negocio
description: Reglas de acceso y atribución de pedidos entre caja y administración del negocio.
---

Después del inicio de sesión del negocio, ofrecer Cajero o Administrador del negocio. La caja tiene accesos por turno de mañana o tarde, y solo permite atender pedidos y liberarlos o asignarlos a repartidores. Registrar apertura y cierre automáticamente en el servidor y presentar las horas en Perú; cerrar requiere confirmación explícita.

**Why:** El usuario pidió separar la operación de caja de la administración y que el administrador conozca quién atendió cada turno, sus horarios, productos, métodos de pago y repartidores.

**How to apply:** Mantener los permisos de caja en la sesión del servidor y limitarla al negocio elegido. No permitir recuperar funciones administrativas cambiando una ruta o datos del navegador; al cerrar caja, finalizar esa sesión y exigir el inicio de sesión habitual.

La venta de un pedido se atribuye al turno que lo liberó por primera vez, pero solo cuenta cuando se entrega. Los turnos posteriores que intervengan conservan trazabilidad sin duplicar ingresos; cerrar caja no cancela repartos pendientes.

**Why:** Un pedido puede liberarse en un turno y asignarse o entregarse después. Contarlo en cada intervención duplicaría ventas y perder los pendientes al cerrar falsearía la operación.

**How to apply:** Mostrar los pedidos atendidos y sus movimientos en los turnos involucrados, conservando una sola atribución financiera. Diferenciar siempre método de pago declarado de cobro verificado.
