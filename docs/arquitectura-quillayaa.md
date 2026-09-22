# Arquitectura funcional de QUILLAYAA

QUILLAYAA es una plataforma de pedidos de comida y bebidas que conecta a clientes,
negocios, repartidores y administradores del sistema.

## Roles

### Cliente

- Registrarse
- Iniciar sesión
- Ver productos y categorías
- Gestionar el carrito
- Modificar cantidades y eliminar productos
- Realizar pedidos
- Registrar dirección y referencia de entrega
- Seleccionar efectivo, Yape o tarjeta
- Visualizar el total del pedido
- Consultar el estado de sus pedidos
- Calificar el servicio recibido
- Gestionar sus datos personales

### Administrador del negocio

- Gestionar productos
- Gestionar categorías
- Administrar precios, stock y disponibilidad
- Gestionar imágenes de productos mediante URL o archivo del dispositivo
- Registrar información comercial, dirección, teléfono y RUC
- Recibir pedidos
- Actualizar pedidos hasta dejarlos listos para entrega
- Consultar ventas del día, semana y mes con porcentajes
- Visualizar estadísticas básicas del establecimiento

### Repartidor

- Ver entregas asignadas
- Gestionar su disponibilidad
- Ver cliente, detalle del pedido y método de pago
- Consultar la dirección del cliente
- Actualizar: pendiente de recoger, en camino y entregado
- Consultar entregas realizadas

### Administrador del sistema

- Gestionar usuarios y sus estados
- Gestionar y aprobar negocios
- Supervisar productos y pedidos
- Gestionar repartidores y asignaciones
- Revisar pagos
- Consultar reportes
- Administrar la configuración general

## Flujo central

```text
                         ┌──────────────────────┐
                         │      QUILLAYAA       │
                         │ Plataforma de pedidos│
                         │ de comida y bebidas  │
                         └──────────┬───────────┘
                                    │
                 ┌────────────┬─────┴──────┬────────────┐
                 │            │            │            │
                 ▼            ▼            ▼            ▼
        ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │   CLIENTE    │ │ NEGOCIO  │ │ DELIVERY │ │ ADMIN. SIST. │
        └──────┬───────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘
                │                  │                  │
                ▼                  ▼                  ▼
        ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
        │ Registrarse    │ │ Gestionar      │ │ Ver delivery   │
        │ Iniciar sesión │ │ productos      │ │ Actualizar     │
        │ Ver productos  │ │ categorías     │ │ estado entrega │
        │ Carrito        │ │ pedidos        │ └────────────────┘
        │ Realizar pedido│ │ clientes       │
        └───────┬────────┘ │ pagos          │
                │          │ reportes       │
                │          └────────────────┘
                ▼
        ┌────────────────┐
        │     PEDIDO     │
        └───────┬────────┘
                │
           ┌────┴─────┐
           ▼          ▼
       ┌─────────┐ ┌─────────────┐
       │  PAGO   │ │  DELIVERY   │
       └─────────┘ └─────────────┘
```

## Implementación actual

- La página `/admin/system` representa este esquema de forma visual y responsive.
- El administrador del negocio usa `/business` y solo administra su establecimiento.
- El administrador del sistema usa `/admin` y supervisa toda la plataforma.
- El cliente ya cuenta con catálogo, carrito, checkout y seguimiento.
- El administrador ya cuenta con resumen, pedidos, restaurantes y repartidores.
- Los estados de pedido son: recibido, en cocina, listo, en camino, entregado y cancelado.
- Los pagos disponibles son: efectivo, Yape y tarjeta.
- El API centraliza restaurantes, productos, pedidos y métricas del dashboard.