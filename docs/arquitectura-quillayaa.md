# Arquitectura funcional de QUILLAYAA

QUILLAYAA es una plataforma de pedidos de comida y bebidas que conecta a clientes,
restaurantes, administradores y repartidores.

## Roles

### Cliente

- Registrarse
- Iniciar sesión
- Ver productos y categorías
- Gestionar el carrito
- Realizar pedidos
- Consultar el estado de sus pedidos

### Administrador

- Gestionar productos
- Gestionar categorías
- Supervisar pedidos
- Gestionar clientes
- Revisar pagos
- Consultar reportes

### Repartidor

- Ver entregas asignadas
- Consultar la dirección del cliente
- Actualizar el estado de la entrega

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