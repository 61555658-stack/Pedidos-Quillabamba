---
name: Horarios de negocios
description: Criterios de apertura automática, compatibilidad con cierre manual y horarios nocturnos.
---

Cada negocio configura sus días de atención y horas de apertura y cierre desde su perfil. Calcular la disponibilidad en America/Lima, tanto para mostrar el estado al cliente como para aceptar pedidos en el servidor.

**Why:** El usuario pidió que cada negocio indique cuándo atiende y que los clientes puedan ver si está abierto o cerrado. El dispositivo del cliente no debe decidir si se permite comprar.

**How to apply:** Mantener un único criterio para catálogo, menú, perfil y creación de pedidos. El horario de cierre es excluyente y el de apertura incluyente.

Un cierre manual prevalece sobre el horario. Los negocios sin horario configurado mantienen su estado manual, sin asumir horas de atención.

**Why:** No inventar horarios para negocios existentes y permitir pausas operativas aunque el negocio normalmente atienda a esa hora.

**How to apply:** No eliminar la posibilidad de cerrar temporalmente ni abrir un negocio contra su decisión manual.

Si el cierre ocurre antes que la apertura, el turno termina al día siguiente y la madrugada pertenece al día en que comenzó el turno.

**Why:** Un negocio que abre el domingo por la noche debe poder atender después de medianoche aunque el lunes no sea un día de apertura.

**How to apply:** Comprobar también el horario nocturno del día anterior; no requerir que ambos días estén seleccionados.
