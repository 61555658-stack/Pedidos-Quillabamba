---
name: Ventas y cobros
description: Criterio del informe de ventas y diferencia entre entregar un pedido y verificar su pago.
---

Los informes operativos cuentan pedidos entregados por su fecha de entrega en America/Lima; las semanas comienzan el lunes. Separar venta de productos de tarifas de delivery y excluir cancelados y pendientes.

**Why:** El usuario quiere comparar ventas reales por negocio y periodo, no sumar ejemplos ni pedidos que todavía podrían cancelarse. Mantener un único criterio evita que distintos paneles presenten cifras incompatibles.

**How to apply:** Mantener el mismo criterio en el resumen, el detalle de productos y el PDF. Si se cambia la definición de venta, hacerlo explícitamente en todas las vistas.

Un método de pago declarado o una entrega confirmada no demuestran que el cobro haya sido verificado.

**Why:** No hay conciliación bancaria ni confirmación de pasarela en este flujo; llamarlo «cobrado» daría una garantía financiera que la aplicación no tiene.

**How to apply:** Diferenciar venta entregada de pago confirmado en etiquetas e informes. Cualquier futura confirmación de pagos debe ser un estado separado, con evidencia o verificación, no inferido del estado de entrega.
