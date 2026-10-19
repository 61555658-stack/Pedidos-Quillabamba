---
name: Esquema compartido de PostgreSQL
description: Tablas heredadas presentes en la base de desarrollo que no están declaradas en el esquema Drizzle actual.
---

La base PostgreSQL compartida ya contiene tablas heredadas en `public`, incluidas cuentas, sesiones y pedidos. No asumir que están vacías solo porque el barrel de Drizzle no las declara. La autenticación propia de la app reutiliza `public.users` y `public.sessions` con consultas parametrizadas.

**Why:** Un `drizzle-kit push` normal pidió confirmaciones de cambios de columnas y, al limitarlo a un esquema nuevo, intentó eliminarlo después de crear sus tablas. Forzar el push podría borrar objetos ajenos a la implementación.

**How to apply:** Consultar `information_schema` antes de modificar el esquema; no usar `push-force` sobre `public` sin modelar y revisar primero todas las tablas existentes.
