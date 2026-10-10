# CI y publicación de StaneLabs

El flujo `ci.yml` comprueba pull requests a `main`, pushes a `main` y etiquetas `vX.Y.Z`. Publica en `ghcr.io/OWNER/REPO` solamente desde un push a `main` o una etiqueta de versión cuyo commit pertenezca a `main`. Un lanzamiento manual ejecuta comprobaciones sin publicar. La imagen es `linux/amd64` y usa el frontend Next.js exportado junto al servidor NestJS; Vite queda para revisión visual local.

## Configuración del repositorio y del paquete privado

1. El repositorio existente **`stanehq/stanelabs.com` es público**. GitHub permite attestations nativas para repositorios públicos en todos sus planes actuales; en repositorios privados/internos requieren **GitHub Enterprise Cloud**. No requiere contratar Code Security para este flujo. Los reportes JSON/SARIF y los archivos de distribución de Actions siguen la visibilidad del repositorio; con este repositorio público no deben considerarse privados. El flujo no llama a `upload-sarif`.
2. Crea el environment **`ghcr`**. Permite únicamente `main` y las etiquetas de versión, y configura la revisión de publicación que necesite tu organización. El environment puede crearse automáticamente si no existe, pero no tendrá esas protecciones: configúralo antes del primer push que publique.
3. Protege `main`: exige los jobs de lint/tipos/tests, seguridad y construcción/escaneo; exige revisión para cambios en `.github/`, `scripts/ci/`, las reglas de seguridad, Dockerfiles y manifests/lockfiles. Configura CODEOWNERS con los usuarios o equipos reales de la organización. Protege también la creación/modificación de tags de lanzamiento.
4. Mantén la visibilidad del paquete GHCR **privada** y su vínculo con este repositorio. El token `GITHUB_TOKEN` del job debe poder escribir ese paquete. La configuración de la organización puede impedir la publicación o exigir habilitar Actions/package access; no se han cambiado cuentas, permisos o paquetes externos desde este proyecto.
5. Revisa la política de acciones de la organización para admitir los repositorios oficiales fijados por SHA en este workflow y permitir OIDC para attestations. Ningún secreto SMTP ni acceso al VPS participa en la construcción.

## Qué comprueba

- ESLint 10 con reglas JS/TypeScript y React Hooks, typecheck de Next y NestJS, tests de validación/correo/errores y tests de integridad/extracción OCI. No se usa `eslint-config-next`: su dependencia `braces` tiene actualmente una vulnerabilidad HIGH sin versión corregida disponible. El build de Next y la verificación de rutas/SEO siguen ejecutándose dentro de Docker.
- `npm ci --ignore-scripts` respeta el lockfile sin ejecutar hooks de instalación. `npm audit --audit-level=high` bloquea HIGH y CRITICAL; `npm audit signatures` verifica las firmas/provenance que publica el registro. Se conserva el resumen de cobertura de firmas/attestations en texto y el resultado JSON de firmas inválidas/ausentes. La verificación de firmas no garantiza que un paquete sea seguro ni que todos los paquetes históricos tengan provenance.
- actionlint y zizmor comprueban sintaxis y prácticas de seguridad de Actions. Gitleaks analiza el historial Git completo con los resultados redactados. Semgrep CE ejecuta cinco reglas locales revisadas, sus fixtures positivos/negativos y el escaneo del código, sin token, telemetría ni red.
- Trivy analiza lockfiles/configuración y luego **el archivo de imagen que se publicará**: vulnerabilidades, secretos y configuración. HIGH y CRITICAL bloquean el flujo, también cuando no hay corrección disponible. Los errores del escáner bloquean; no hay `continue-on-error`, `|| true` ni lista global de exclusiones de vulnerabilidades.

## Construir una vez, verificar y publicar

El job de imagen no tiene permisos para GHCR ni OIDC. Buildx produce un archivo OCI con el BuildKit fijado por digest y provenance detallada. Trivy escanea ese mismo archivo. El runtime elimina npm/npx/Yarn, que solo se necesitan durante la construcción: el escaneo real de la imagen base detectó ocho HIGH exclusivamente en el npm global incluido; no se ignoran esos hallazgos. El script valida los hashes de los blobs, el digest devuelto por BuildKit y la plataforma; obtiene `stanelabs-web.tar` de `/app/public` de esa imagen. No recompila el frontend para crear el tar.

El job de publicación descarga **el artifact ID de ese mismo run**, verifica SHA-256/SHA-512 y el layout OCI, y transfiere sus bytes con regctl a un tag privado `candidate-RUN-ATTEMPT`. Se exige que el digest devuelto por GHCR coincida con el digest escaneado. **Solo después de firmar y verificar** se promueven los tags `sha-COMMIT` y `main` o `vX.Y.Z`. Se rechaza reemplazar una etiqueta de versión existente que identifique otro digest; `main` sirve como alias mutable. Los tags candidatos quedan sujetos a la política de retención del paquete y no deben usarse para desplegar. regctl se utiliza como alternativa a Skopeo porque el upstream de Skopeo no publica binarios independientes con checksums para este instalador. El digest, no un tag mutable, identifica el despliegue.

`actions/attest` firma provenance para la imagen y el tar, y un SBOM SPDX 2.3 para cada uno. Las attestations OCI se guardan además en GHCR. GitHub selecciona la instancia de Sigstore según la visibilidad del repositorio: los repositorios públicos usan la instancia pública y su transparency log; los privados de Enterprise Cloud usan la instancia privada de GitHub sin ese log público. En este repo público, las identidades de workflow y los metadatos de firma/provenance son públicos, aunque el paquete GHCR permanezca privado. No se añaden firmas Cosign en paralelo.

Un hash permite detectar cambios en los bytes. La firma/provenance vincula ese hash con la identidad del repositorio, workflow y commit. Las firmas se comprueban después de publicar, imponiendo esa identidad, el ref y commit esperados y runners de GitHub. Solo se añade `--no-public-good` cuando `github.event.repository.private` es `true`: usarlo en este repo público rechazaría sus firmas válidas. El flujo no afirma SLSA nivel 3 ni reproducibilidad bit a bit: los runners y las bases de vulnerabilidades reciben actualizaciones.

## Artefactos y límites del SBOM

El artifact `verified-image-RUN-ATTEMPT` dura 14 días e incluye:

- `image.oci.tar`, imagen compilada y escaneada, y `image-digest.txt`.
- `stanelabs-web.tar`, frontend estático obtenido de esa imagen. El formulario necesita la API NestJS de la imagen; alojar solamente este tar no crea el backend.
- `image.sbom.spdx.json`, inventario del runtime; `web.sbom.spdx.json`, inventario de los archivos estáticos; y `source-dependencies.sbom.spdx.json`, inventario de dependencias de los lockfiles del frontend/backend, incluidas las herramientas de build. El SBOM estático no reconstruye versiones npm embebidas dentro de JS minificado. El SBOM de fuentes registra esos insumos y se firma como artefacto con provenance; no afirma que todas las dependencias de desarrollo estén instaladas en producción. El audit de todos los manifests/lockfiles cubre también las dependencias de frontend usadas en el build.
- `buildkit-statements.json`, provenance de BuildKit; `build-info.json`, plataforma, repo/ref/commit/run y hashes de entradas/herramientas; metadata y SHA-256 de la base Trivy utilizada; reporte de la imagen y `SHA256SUMS`/`SHA512SUMS`.

El artifact `attestations-RUN-ATTEMPT` dura 30 días e incluye los bundles Sigstore firmados y los resultados de verificación. El resumen del job muestra la imagen por digest, commit/ref/plataforma y nombres de archivos firmados. Descarga y conserva ambos antes de su caducidad si necesitas conservar el tar o verificar sin conexión. Los artefactos de Actions, incluido el archivo OCI, siguen la visibilidad del repo público; configurar GHCR privado no cambia ese acceso. La imagen y las attestations del registro siguen la política de retención del paquete GHCR.

## Comprobar una publicación

Usa la versión de `gh` del lock e inicia sesión con acceso de lectura al repositorio y al paquete privado. Autentica también el registro OCI. Sustituye los valores por el repo, workflow, ref, commit y digest del lanzamiento **esperado**; no confíes en valores tomados de un artefacto sin verificar.

```bash
gh attestation verify \
  oci://ghcr.io/OWNER/REPO@sha256:DIGEST \
  --repo OWNER/REPO \
  --signer-workflow OWNER/REPO/.github/workflows/ci.yml \
  --source-ref refs/heads/main \
  --source-digest COMMIT_SHA \
  --deny-self-hosted-runners
```

El ejemplo sirve para este repositorio público. Si se cambia a privado en Enterprise Cloud, añade `--no-public-good` para excluir firmas de la instancia pública. Para una versión usa `--source-ref refs/tags/vX.Y.Z`. Repite el comando con `--predicate-type https://spdx.dev/Document/v2.3` para comprobar el SBOM; la verificación por defecto exige provenance SLSA v1. Para el tar cambia el primer argumento por su ruta. `--bundle-from-oci` obtiene bundles de GHCR en vez de la API de GitHub; `--bundle RUTA` admite los bundles descargados para el proceso offline documentado por GitHub. Nunca basta con verificar solamente `SHA256SUMS` sin autenticarlo.

## Fijaciones y actualizaciones

- Node **24.21.0**, npm **11.19.0**, dependencias directas exactas y `package-lock.json` con integridades npm.
- Acciones fijadas al SHA completo del commit oficial de su release; inventario en `scripts/ci/actions.lock.json`. No se usan tags flotantes como `@main` o `@v4`.
- `Dockerfile` fija Node y su frontend por digest; `images.lock.json` fija BuildKit y Semgrep. Los digests se consultaron en el Registry v2 oficial.
- `tools.lock.json` fija release, URL oficial y SHA-256 de actionlint, zizmor, Gitleaks, Trivy, gh, regctl y Buildx. El instalador verifica el checksum **antes** de extraer/ejecutar. Los archivos reales se descargaron y contrastaron contra los digests/checksums de release upstream durante la preparación.

Dependabot propone cambios de npm, acciones y Docker; estas propuestas requieren revisión y los mismos checks. Los binarios de herramientas y sus locks requieren actualización revisada: consulta el release oficial, verifica su checksum/digest contra las fuentes upstream y cambia lock/workflow/Dockerfile de forma consistente. No cambies solo la versión ni copies un hash no comprobado. Trivy usa una base actualizada al ejecutar cada scan y registra exactamente su metadata/hash; fijar una base vieja ocultaría vulnerabilidades recientes.

Pruebas locales: `npm run ci:check`, `npm audit --audit-level=high`, `npm audit signatures`; las pruebas OCI se ejecutan con `python3 -m unittest discover -s scripts/ci -p test_artifacts.py -v` (o el ejecutable Python disponible en Windows). En Linux amd64 con Docker: `bash scripts/ci/install-tools.sh all`, añade `.ci/bin` al PATH y ejecuta los comandos de los jobs. Se comprobó con Trivy una variante OCI local de la base con una capa de eliminación equivalente a retirar npm/Yarn: **0 HIGH/CRITICAL**. Esa prueba valida la base saneada, no la aplicación final. La construcción completa, escaneo del runtime de StaneLabs, transferencia GHCR y firma requieren Docker/GitHub y se validarán al ejecutar este workflow actualizado en el repositorio.

Fuentes oficiales: [attestations de GitHub](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), [verificación y flags de gh](https://cli.github.com/manual/gh_attestation_verify), [seguridad de Actions](https://docs.github.com/en/actions/reference/security/secure-use), [Semgrep CE en CI](https://docs.semgrep.dev/deployment/oss-deployment), [attestations de BuildKit](https://docs.docker.com/build/metadata/attestations/), [regctl image copy](https://regclient.org/cli/regctl/image/copy/), [fijación de imágenes Docker](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions).
