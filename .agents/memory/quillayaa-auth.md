---
name: Acceso de usuarios de QUILLAYAA
description: Preferencia del producto sobre cómo clientes y personal acceden a la app.
---

Los usuarios deben registrarse e iniciar sesión dentro de QUILLAYAA con correo y contraseña; no se les debe exigir una cuenta de Replit. Verificar el correo y asignar los roles elevados mediante autorización, no por selección libre.

**Why:** el usuario pidió explícitamente evitar que clientes, repartidores y administradores tengan que registrarse en Replit.

**How to apply:** Mantener autenticación propia del producto, con sesiones seguras del servidor. No volver a habilitar flujos de Replit Auth para cuentas de clientes o personal.

El inicio de sesión debe comenzar sin un rol seleccionado. Es obligatorio elegirlo explícitamente y el servidor debe comprobar que coincide con el rol registrado para el correo y contraseña, antes de crear una sesión.

**Why:** El usuario pidió impedir el acceso sin seleccionar rol o cuando la selección no coincide con las credenciales de la cuenta.
