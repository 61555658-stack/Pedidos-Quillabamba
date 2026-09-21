# Arquitectura funcional de QUILLAYAA

QUILLAYAA es una plataforma de pedidos de comida y bebidas que conecta a clientes,
restaurantes, administradores y repartidores.

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
- Gestionar sus datos personales

### Administrador

- Gestionar productos
- Gestionar categorías
- Administrar precios, stock y disponibilidad
- Supervisar pedidos
- Gestionar clientes
- Gestionar repartidores y asignar pedidos
- Revisar pagos
- Consultar reportes
- Administrar la configuración general

### Repartidor

- Ver entregas asignadas
- Ver cliente, detalle del pedido y método de pago
- Consultar la dirección del cliente
- Actualizar: pendiente de recoger, en camino y entregado
- Consultar entregas realizadas

## Flujo central

```text
                         ┌──────────────────────┐
                         │      QUILLAYAA       │
                         │ Plataforma de pedidos│
                         │ de comida y bebidas  │
                         └──────────┬───────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
        ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
        │    CLIENTE     │ │ ADMINISTRADOR  │ │  REPARTIDOR    │
        └───────┬────────┘ └───────┬────────┘ └───────┬────────┘
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
- El cliente ya cuenta con catálogo, carrito, checkout y seguimiento.
- El administrador ya cuenta con resumen, pedidos, restaurantes y repartidores.
- Los estados de pedido son: recibido, en cocina, listo, en camino, entregado y cancelado.
- Los pagos disponibles son: efectivo, Yape y tarjeta.
- El API centraliza restaurantes, productos, pedidos y métricas del dashboard.