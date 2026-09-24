---
name: OpenAPI and Zod compatibility
description: Generator/runtime compatibility constraints for OpenAPI numeric and email schemas in this workspace.
---

Use `type: number` for numeric fields in the OpenAPI contract unless the installed Zod runtime is upgraded to a version that supports the generator's `zod.int()` output.

**Why:** The current Orval output can emit `zod.int()` for OpenAPI `integer`, while this workspace resolves Zod 3, which has no top-level `zod.int()` API and breaks library typechecking.

**How to apply:** After changing numeric schemas, run API codegen and the library typecheck before handing the contract to frontend work.

Avoid OpenAPI `format: email` while this project's generator and runtime versions remain mismatched; use a string with an email pattern instead, validating the generated schema before relying on it.

**Why:** The generator emits a top-level `zod.email()` call that the installed Zod 3 runtime does not provide, causing library typechecking to fail.

**How to apply:** When adding email fields to the API contract, run codegen and check the resulting library typecheck before implementing handlers.