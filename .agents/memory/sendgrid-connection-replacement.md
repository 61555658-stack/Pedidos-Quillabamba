---
name: SendGrid connection replacement
description: How to handle multiple authorized SendGrid connections when a Repl already has one assigned.
---

A Repl accepts only one assigned SendGrid connection. Attempting to add another authorized connection while one is assigned fails, even if the assigned credential is invalid. To switch connector accounts, the user must disconnect the assigned account in the Connectors panel before attaching the other.

**Why:** Adding a second authorized SendGrid connection returned an explicit "already has a sendgrid connection assigned" error; reattempting did not replace the first.

**How to apply:** When a SendGrid connector is already attached but unusable, do not claim a different authorized connection has been attached until the existing one is disconnected. A server-side SendGrid API key in Replit Secrets is a separate delivery path and does not change the connector assignment; validate provider responses separately, including sender identity verification.