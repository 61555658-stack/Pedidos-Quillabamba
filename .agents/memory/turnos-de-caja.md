---
name: Turnos de caja del negocio
description: Reglas de acceso y atribución de pedidos entre caja y administración del negocio.
---

Después del inicio de sesión del negocio, ofrecer Cajero o Administrador del negocio. La caja tiene accesos por turno de mañana o tarde, y solo permite atender pedidos y liberarlos o asignarlos a repartidores. Registrar apertura y cierre automáticamente en el servidor y presentar las horas en Perú; cerrar requiere confirmación explícita.

**Why:** El usuario pidió separar la operación de caja de la administración y que el administrador conozca quién atendió cada turno, sus horarios, productos, métodos de pago y repartidores.

**How to apply:** Mantener los permisos de caja en la sesión del servidor y limitarla al negocio elegido. No permitir recuperar funciones administrativas cambiando una ruta o datos del navegador. Al cerrar caja, terminar el turno y volver directamente a «Abrir caja», conservando solo acceso para abrir otro turno, sin «Volver» ni elección de administrador. Ese botón solo aparece al entrar inicialmente desde la elección de modo. La restricción debe sobrevivir a recargas; para administrar, usar «Salir» e iniciar sesión de nuevo.

**Why:** El usuario pidió volver al formulario de apertura después del cierre, sin el botón «Volver», y conservarlo solo al entrar inicialmente.

Al elegir «Administrador del negocio», la primera vez se debe crear un usuario y una contraseña; en los accesos siguientes se deben pedir esas credenciales antes de abrir la administración.

**Why:** El usuario pidió proteger esta opción, además del inicio de sesión general de la app.

**How to apply:** Son credenciales secundarias de la cuenta de negocio, compartidas entre sus negocios asignados, no usuarios de caja ni un reemplazo del correo y contraseña principal. La elección administrativa no selecciona un negocio concreto. La autorización debe quedar en la sesión del servidor y sobrevivir a recargas, sin permitir saltarse la verificación mediante rutas o estado del navegador. Las sesiones administrativas anteriores sin esta verificación deben volver a solicitarla.

La venta de un pedido se atribuye al turno que lo liberó por primera vez, pero solo cuenta cuando se entrega. Los turnos posteriores que intervengan conservan trazabilidad sin duplicar ingresos; cerrar caja no cancela repartos pendientes.

**Why:** Un pedido puede liberarse en un turno y asignarse o entregarse después. Contarlo en cada intervención duplicaría ventas y perder los pendientes al cerrar falsearía la operación.

**How to apply:** Mostrar los pedidos atendidos y sus movimientos en los turnos involucrados, conservando una sola atribución financiera. Diferenciar siempre método de pago declarado de cobro verificado.
