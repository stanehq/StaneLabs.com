# API NestJS de StaneLabs

Backend separado, sin base de datos ni cola. No registra el cuerpo del contacto. Requiere Node.js 22 o superior.

## Preparación

Desde `backend/`:

```sh
npm install
cp .env.example .env
npm run build
npm start
```

En PowerShell, usa `Copy-Item .env.example .env`. `npm run dev` compila y reinicia el proceso cuando cambia el JavaScript compilado; en un segundo terminal, `npm run watch` recompila al editar TypeScript. Se usa el compilador de TypeScript para conservar los metadatos de validación de NestJS. En el monorepo también se puede usar `npm run build --workspace=@stanelabs/backend` y `npm run start --workspace=@stanelabs/backend` desde la raíz una vez instalado el workspace.

Configura `FRONTEND_ORIGIN` con un único origen exacto. Para producción: `https://stanelabs.com`; para desarrollo, el origen que realmente utiliza Next.js o Vite. No admite rutas, comodines ni barra final. CORS restringe la lectura desde otros sitios en el navegador; no sustituye autenticación ni bloquea clientes que no son navegadores.

Configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` y, si procede, `SECURITY_EMAIL`. Este último usa `security@stanelabs.com` por defecto y no procede del formulario. `SMTP_FROM` debe ser un único correo autorizado por tu proveedor. Con puerto 587 se exige STARTTLS; con 465 usa `SMTP_SECURE=true`. Las credenciales solo pertenecen al entorno del backend, nunca a variables públicas de Next.js.

## Contrato

- `GET /api/health`: `200 { "status": "ok" }`.
- `GET /api/contact/status`: `200 { "configured": false }` hasta que existan los valores SMTP necesarios. Indica configuración, no disponibilidad del servidor ni entrega garantizada.
- `POST /api/contact`: JSON con `name` (1–100 caracteres), `email` (máximo 180), `topic`, `message` (1–2000) y opcionalmente `website` vacío como honeypot. Los campos se recortan; se rechazan campos desconocidos, correo inválido y saltos de línea en cabeceras. Topics: `Consulta inicial`, `Ciberseguridad`, `Seguridad operativa`, `Datos sensibles`.

Una respuesta `200 { "status": "sent" }` significa que el servidor SMTP aceptó el destinatario. No garantiza ubicación en la bandeja de entrada ni lectura. El sistema espera `sendMail`; un rechazo o fallo SMTP devuelve `503`, nunca un éxito simulado. Configuración incompleta devuelve `503`; datos inválidos o honeypot rellenado, `400`; límite excedido, `429`. No se permite adjuntar archivos ni incluir HTML remoto.

El contacto permite tres peticiones por minuto y dirección IP. El resto de rutas, salvo health, permite 60. Los contadores del limitador viven temporalmente en memoria: no contienen el mensaje y no se comparten entre réplicas. El cuerpo JSON tiene un máximo de 16 KB. Un filtro global devuelve errores acotados y evita publicar o registrar cuerpos, valores de validación, fragmentos de JSON malformado y excepciones sin tratar.

## Despliegue

No se ha seleccionado un servidor ni se han configurado credenciales reales. El backend necesita un proceso Node persistente o un contenedor y un proxy HTTPS. Expón `/api` mediante el proxy del dominio y conecta el frontend al mismo origen o al origen específico de esta API. Si existe `backend/public` o el directorio compilado indicado en `WEB_ROOT`, Express sirve la exportación de Next.js desde allí, incluidos los archivos de `/.well-known`. No hay un fallback a la página principal: una ruta desconocida conserva un 404. Copia únicamente la exportación compilada a ese directorio; nunca fuentes, `.env` ni credenciales.

Helmet configura cabeceras y una política CSP que permite las tipografías de Google y los scripts inline de hidratación de la exportación de Next.js. El frontend servido por este proceso se conecta a la API en su mismo origen.

Configura `TRUST_PROXY` únicamente con la IP/subred real del proxy de tu alojamiento; por defecto no se confía en cabeceras reenviadas. `loopback` es válido si el proxy está en el mismo servidor. No uses un trust general: permitiría falsificar el identificador utilizado por el limitador. Con varias réplicas, añade un limitador compartido o limita en el proxy.

```sh
docker build -t stanelabs-api backend
docker run --env-file backend/.env -p 3001:3001 stanelabs-api
```

Los comandos Docker se ejecutan desde la raíz del proyecto. La construcción usa el `package.json` independiente del backend y genera un lock dentro de la fase de construcción; antes de un despliegue reproducible, guarda un lock independiente o adapta Docker al lock del workspace. El runtime usa usuario sin privilegios y no copia `.env`.

`npm test` compila y comprueba validación, configuración incompleta y la frontera de aceptación SMTP sin enviar correos. También inicia una API local temporal para comprobar errores 400/413 y ausencia de contenido del mensaje en las respuestas y los logs. Para la comprobación de extremo a extremo, inicia la API sin SMTP: health debe ser 200, status debe ser false y un POST válido debe devolver 503. Antes de producción, verifica la entrega con un mensaje autorizado y actualiza la nota de privacidad del frontend para reflejar el envío al backend y los proveedores de correo.

Referencias: [validación de NestJS](https://docs.nestjs.com/techniques/validation), [limitación de NestJS](https://docs.nestjs.com/security/rate-limiting), [SMTP de Nodemailer](https://nodemailer.com/smtp).
