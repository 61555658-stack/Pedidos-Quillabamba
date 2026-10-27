# QUILLAYAA: APK para pruebas

Contenedor Android WebView de la aplicación web existente. No es una reescritura
nativa ni incluye el servidor o la base de datos en el teléfono.

- Android 10 o superior, conexión a internet y Android System WebView actualizado.
- Esta compilación de prueba abre el entorno de desarrollo. Replit debe estar
  activo y accesible desde el celular; no funciona sin conexión.
- Las cuentas y operaciones son las mismas que en la web, no copias locales.
- Solicita cámara y ubicación solo cuando una función web las necesita.
- Permite seleccionar imágenes y guardar reportes PDF.
- No contiene contraseñas, credenciales de base de datos ni claves de servicios.
- Es un APK firmado para pruebas, no una publicación en Google Play.
- No se ha ejecutado en un teléfono o emulador Android en este entorno.

## Compilar

Con JDK 21, curl, unzip y zip:

```sh
bash artifacts/pedidos-quillabamba/android-test/build.sh https://DOMINIO/login
```

El script obtiene las herramientas oficiales de Android en `/tmp` y crea
`generated-artifacts/android/QUILLAYAA-pruebas.apk`.
Los binarios y las claves temporales no se incluyen en Git.

Para instalar, abre el APK en el celular y autoriza la instalación desde el
navegador o gestor de archivos si Android lo solicita. La firma es desechable:
puede ser necesario desinstalar la compilación anterior antes de instalar otra.

Para una versión estable, verificar primero la aplicación publicada y compilar
con su URL HTTPS. No cambiar automáticamente a producción, porque actualmente
no tiene la misma versión que el entorno de desarrollo.
