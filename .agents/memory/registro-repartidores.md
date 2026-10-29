---
name: Registro de repartidores
description: Datos obligatorios y requisito de SOAT vigente para registrar repartidores.
---

Al registrarse, un repartidor debe proporcionar nombre completo, DNI, número de licencia y placa del vehículo. El SOAT se consulta mediante una API usando esa placa; sin SOAT activo no puede registrarse.

**Why:** El usuario pidió expresamente estos datos y bloquear el registro si el vehículo no cuenta con SOAT activo.

**How to apply:** Comprobar el SOAT en el servidor antes de crear la cuenta, no confiar en un estado enviado por el navegador. Si la consulta no permite confirmar la vigencia, no considerar aprobado el requisito. No aplicar esta exigencia a otros roles.

Usar Croma como proveedor de consulta de SOAT, no JSON.pe.

**Why:** El usuario indicó que ya tiene otra API y proporcionó https://api.croma.run.

**How to apply:** Mantener esta elección al implementar la verificación, con autenticación del proveedor exclusivamente en el servidor.
