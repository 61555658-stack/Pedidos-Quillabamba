---
name: Verificación de APK
description: Diferencia entre validación Android y advertencias de unzip con APK alineados.
---

Usar la verificación de firma y alineación del SDK Android, junto con la comprobación CRC del ZIP, para validar APK compilados. Una advertencia de `unzip` por sí sola no demuestra que un APK sea inválido.

**Why:** El `zipalign` oficial de Android 35 genera un campo extra de alineación `0xd935` que el `unzip` disponible interpreta como demasiado corto; la firma, la alineación y todos los CRC resultaron válidos.

**How to apply:** Si aparece esa advertencia, distinguirla de corrupción real. No modificar un APK después de firmarlo. La validación estática no sustituye ejecutar la aplicación en un dispositivo Android.
