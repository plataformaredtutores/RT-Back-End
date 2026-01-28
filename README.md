# RT Backend

API en Express + Prisma lista para escalar (Docker, Makefile, middlewares base, Prisma singleton).

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm
- Docker

## Inicio rápido

1) Crear el archivo de entorno `.env`

- Opción A (rápida):

```bash
cp .env.example .env
```

- Opción B (tal como lo requieres):

```bash
touch .env
# Abre .env y copia/pega el contenido desde .env.example, luego ajusta valores
```

2) Instalar dependencias

```bash
make install
```

3) Ejecutar en desarrollo

```bash
make dev
```

La API expone un endpoint de salud en `GET /health`.

La documentación dinámica se puede acceder en  `http://localhost:3000/docs `

## Variables de entorno

- `PORT`: Puerto de la API (por defecto 3000)
- `NODE_ENV`: development | production
- `DATABASE_URL`: cadena de conexión (usa la de Supabase por entorno)
- `DIRECT_URL`: (opcional) URL directa para Prisma (útil si usas pooling en DATABASE_URL)

### Cookies, CORS y Safari

Esta API autentica con JWT en cookies (`HttpOnly`). En Safari (macOS/iOS) es común que el login “falle” cuando el frontend y el backend están en **sitios distintos** (third‑party cookies), porque Safari/ITP bloquea esas cookies por defecto.

Recomendado (para que funcione en Safari):

- Sirve frontend y API bajo el **mismo site** (mismo eTLD+1). Ejemplo: `https://app.tu-dominio.com` y `https://api.tu-dominio.com` o, mejor aún, `https://tu-dominio.com/api` via reverse proxy.

Opciones de configuración:

- `CORS_ORIGINS`: lista separada por comas de orígenes permitidos (ej: `https://app.tu-dominio.com,https://admin.tu-dominio.com`). Si no se define, se refleja el Origin.
- `TRUST_PROXY`: ponlo en `true`/`1` si estás detrás de un proxy (Nginx/Cloudflare/Render/etc) y necesitas confiar en `X-Forwarded-*`.
- `COOKIE_DOMAIN`: dominio para la cookie (ej: `.tu-dominio.com`). En `localhost` normalmente NO se debe setear.
- `COOKIE_SECURE`: `true`/`false` para forzar el atributo `Secure`.
- `COOKIE_SAMESITE`: `lax` | `strict` | `none` para forzar SameSite.

Fallback cuando Safari bloquea cookies (workaround):

- El middleware acepta `Authorization: Bearer <token>`.
- Puedes pedir que `POST /auth/login` (y `/auth/refresh`) devuelva el access token en el body usando:
	- query `?includeToken=true`, o
	- header `X-Auth-Token-In-Body: true`, o
	- env `AUTH_TOKEN_IN_BODY=true`

## Prisma

- Generar cliente:

```bash
make prisma-generate
```

- Crear migración (cuando el modelo esté definido):

```bash
make prisma-migrate name=init
```

- Abrir Studio:

```bash
make prisma-studio
```

## Build y ejecución

```bash
make build
make start
```

## Docker

```bash
make docker-build
PORT=3000 make docker-run
```

O con Docker Compose (solo servicio API, DB externa en Supabase):

```bash
make compose-up
make compose-down
```

## Estructura del proyecto

- `src/app.ts`: Punto de entrada de la aplicación
- `src/middlewares/*`: 404 y manejador de errores
- `src/lib/prisma.ts`: Singleton de PrismaClient
- `src/controllers/*`: Controladores (o Resolvers)
- `src/services/*`: Servicios de dominio (incluye `healthService`)
- `src/routes/index.ts`: Registro de rutas (incluye `GET /health`)
- `prisma/schema.prisma`: Esquema de Prisma
- `Makefile`: Comandos útiles (dev, build, prisma, docker, compose)
- `Dockerfile` y `docker-compose.yml`: Contenerización de la API