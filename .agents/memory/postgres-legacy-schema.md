---
name: Esquema compartido de PostgreSQL
description: Tablas heredadas presentes en la base de desarrollo que no están declaradas en el esquema Drizzle actual.
---

La base PostgreSQL compartida ya contiene tablas heredadas en `public`, incluidas cuentas, sesiones y pedidos. No asumir que están vacías solo porque el barrel de Drizzle no las declara. El acceso seguro nuevo usa un esquema separado (`replit_auth`) para no alterar esos datos.

**Why:** Un `drizzle-kit push` normal pidió confirmaciones de cambios de columnas y, al limitarlo a un esquema nuevo, intentó eliminarlo después de crear sus tablas. Forzar el push podría borrar objetos ajenos a la implementación.

**How to apply:** Consultar `information_schema` antes de modificar el esquema; no usar `push-force` sobre `public` sin modelar y revisar primero todas las tablas existentes.
