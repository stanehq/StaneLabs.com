# StaneLabs

Sitio de ciberseguridad, OPSEC y protección de información sensible. La dirección oficial configurada es **https://stanelabs.com** y el canal de seguridad es **security@stanelabs.com**.

## Arquitectura

- **Frontend:** Next.js 16 y React 19, con exportación estática. Tailwind CSS 4, componentes shadcn/ui basados en Radix y Feather Icons. TikTok Sans para títulos y Geist para texto e interfaz.
- **Vista visual:** Vite utiliza los mismos componentes de `src/` para revisar el diseño; la compilación de producción del frontend usa Next.js.
- **API:** NestJS 11 sobre Express. Sirve los archivos estáticos compilados y la API de contacto en el mismo proceso Node.js. Incluye validación, límites de solicitudes, cabeceras de seguridad y envío SMTP.

La producción utiliza HTML, CSS y JavaScript estáticos de Next y el backend Nest compilado. El contenedor final ejecuta Node con las dependencias de producción de la API; no necesita un servidor Next, compiladores ni código fuente del proyecto.

## Desarrollo y compilación

Usar Node.js 22 o posterior; el Dockerfile utiliza Node.js 24. Desde la raíz:

```sh
npm ci
npm run dev
```

`npm ci` instala también el workspace `backend`. Next inicia en `http://127.0.0.1:3000`. Para revisar el mismo diseño mediante Vite:

```sh
npm run dev:visual
```

Para trabajar con la API local, copiar `backend/.env.example` a `backend/.env`, ajustar `FRONTEND_ORIGIN` al origen exacto del frontend y ejecutar en otra terminal:

```sh
npm run dev:api
```

Ese comando compila una vez y reinicia Node cuando cambia `backend/dist/`. Para que las modificaciones TypeScript se recompilen durante el desarrollo, mantener una tercera terminal:

```sh
cd backend
npm run watch
```

El endpoint público del formulario se indica mediante `NEXT_PUBLIC_CONTACT_API_URL`, por ejemplo `http://127.0.0.1:3001/api` en desarrollo. Definirlo en el entorno del proceso del frontend antes de iniciarlo o compilarlo. Esta variable contiene sólo una URL o ruta pública, nunca credenciales SMTP. El backend local escucha en el puerto 3001 por defecto.

Compilación completa desde la raíz:

```sh
npm run build
```

Compila el frontend con Next, prepara su exportación en `dist/`, genera y verifica los archivos SEO y públicos, y compila Nest en `backend/dist/`. `scripts/verify.mjs` comprueba las cuatro rutas prerenderizadas, sus metadatos, los iconos y el archivo de divulgación. `npm run build:visual` y `npm run preview` corresponden exclusivamente a la compilación y revisión con Vite.

## Contacto y configuración SMTP

La revisión estática de Sites funciona con un enlace `mailto:`: el formulario prepara un borrador en la aplicación de correo del visitante. No afirma que ese borrador haya sido enviado.

En Docker, `CONTACT_API_URL=/api` es el argumento público de compilación predeterminado y se convierte en `NEXT_PUBLIC_CONTACT_API_URL`. El frontend consulta `/api/contact/status`; cuando el backend dispone de toda la configuración SMTP, ofrece el envío directo a través de `/api/contact`. Si la API no está disponible o falta esa configuración, mantiene el borrador por correo. `/api/health` permite comprobar que el servicio responde.

Para Docker, copiar `.env.example` a `.env` en la raíz y completar `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` con los datos reales del proveedor. `SECURITY_EMAIL` identifica el destinatario y `FRONTEND_ORIGIN` el origen permitido. Configurar `TRUST_PROXY` sólo si corresponde al proxy real utilizado.

Las credenciales se inyectan al iniciar el backend. No poner secretos en `NEXT_PUBLIC_*`, argumentos de compilación, archivos de `public/` ni en el repositorio. `.dockerignore` excluye los archivos `.env` del contexto de compilación y conserva únicamente los ejemplos sin credenciales.

El backend no guarda consultas en una base de datos. Un envío se confirma cuando el servidor SMTP acepta al destinatario; esto no garantiza la llegada a su bandeja de entrada. No compartir información sensible en una petición inicial: acordar primero un canal adecuado.

## Docker multietapa

El Dockerfile de la raíz contiene tres etapas:

1. `build`: instala las dependencias y compila el frontend estático y la API.
2. `runtime-dependencies`: instala únicamente las dependencias de producción del workspace `backend`.
3. `runtime`: incorpora las dependencias anteriores, `backend/dist/` y el frontend compilado. Ejecuta el servicio como usuario `node` en el puerto 3001.

Con Docker instalado y `.env` preparado:

```sh
docker compose build
docker compose up --build -d
```

`compose.yaml` publica **sólo `127.0.0.1:3001`** del host. Configura el contenedor con sistema de archivos de sólo lectura, `/tmp` temporal, capacidades eliminadas y comprobación de salud. `Caddyfile.example` muestra un proxy inverso opcional en el host para `stanelabs.com`, con HTTPS y destino `127.0.0.1:3001`. Apuntar el DNS del dominio al servidor antes de habilitar esa configuración. Caddy no forma parte del contenedor de la aplicación.

Docker no está disponible en el entorno donde se preparó esta entrega, por lo que la construcción de la imagen y el arranque de Compose **no se han verificado**.

## VPS que sólo ejecuta la aplicación

Si el VPS debe contener únicamente el servicio compilado, construir la imagen en otro equipo compatible con la arquitectura del VPS y transferirla:

```sh
docker build --target runtime -t stanelabs:1.0.0 .
docker save -o stanelabs-1.0.0.tar stanelabs:1.0.0
scp stanelabs-1.0.0.tar usuario@servidor:/ruta/de/despliegue/
```

En el VPS, preparar un `.env` con las credenciales reales y cargar la imagen:

```sh
docker load -i stanelabs-1.0.0.tar
docker run -d --name stanelabs --restart unless-stopped --env-file .env -p 127.0.0.1:3001:3001 --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true --init stanelabs:1.0.0
```

También se puede usar una configuración Compose de despliegue que declare `image: stanelabs:1.0.0` en lugar de `build`. El VPS necesita Docker, la imagen, su configuración de entorno y el proxy inverso si se utiliza; no necesita el código fuente, Next, TypeScript ni ejecutar `npm install`. La imagen transferida debe haberse construido para su plataforma.

## SEO y publicación

Los datos de publicación viven en `project-config.json`: nombre, dominio oficial, correos y `sitePrivate`. `scripts/seo.mjs` prepara los archivos públicos y metadatos; su modo `--dist` adapta las páginas exportadas y genera el sitemap a partir de las rutas HTML compiladas. El sitio incluye URLs canónicas, Open Graph, Twitter y datos estructurados `Organization` y `WebSite`.

La revisión mantiene `sitePrivate: true`: todas las páginas tienen `noindex, follow`. `robots.txt` permite el rastreo para que los buscadores puedan leer esa directiva. Esto controla la indexación; la privacidad depende del control de acceso del alojamiento.

Para el lanzamiento público, conectar **stanelabs.com** con el alojamiento, comprobar HTTPS y el correo, completar los datos legales, establecer `sitePrivate: false` y volver a compilar y desplegar. Las canónicas y el sitemap apuntan al dominio oficial; el proyecto no afirma que el dominio o el buzón hayan sido verificados técnicamente.

## Archivos públicos

- `/manifest.webmanifest`: identidad, colores e iconos de instalación; no promete funcionamiento sin conexión.
- `/robots.txt`: instrucciones de rastreo y ubicación del sitemap.
- `/sitemap.xml`: páginas disponibles en la compilación.
- `/.well-known/security.txt`: ubicación canónica conforme al formato de RFC 9116, con correo, página de seguridad, política e idiomas.
- `/security.txt`: copia de compatibilidad del archivo canónico.
- `/security`: instrucciones de divulgación responsable.
- `/privacy` y `/legal`: información del sitio. Completar y revisar los datos del titular y el tratamiento real de datos antes del lanzamiento comercial.

`security.txt` caduca el **9 de abril de 2027**. Renovar `expiry` en `scripts/seo.mjs` y reconstruir antes de esa fecha. El sitio no añade claves PGP, asociaciones de apps ni certificaciones que no hayan sido aportadas.

Referencias: [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116.html), [rastreo e indexación de Google](https://developers.google.com/search/docs/crawling-indexing/robots/intro).
