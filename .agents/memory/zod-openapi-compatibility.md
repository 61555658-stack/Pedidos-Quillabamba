---
name: OpenAPI numeric compatibility
description: A generator/runtime compatibility constraint for numeric schemas in this workspace.
---

Use `type: number` for numeric fields in the OpenAPI contract unless the installed Zod runtime is upgraded to a version that supports the generator's `zod.int()` output.

**Why:** The current Orval output can emit `zod.int()` for OpenAPI `integer`, while this workspace resolves Zod 3, which has no top-level `zod.int()` API and breaks library typechecking.

**How to apply:** After changing numeric schemas, run API codegen and the library typecheck before handing the contract to frontend work.