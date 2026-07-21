# bigschool-tfm

Proyectos base para:
- `resources-app` (React + TypeScript)
- `resources-api` (ASP.NET Core API)
- `resources-app-test` (tests frontend)
- `resources-api-test` (tests backend)

## Estructura

```text
src/
  resources-app/
  resources-api/
  resources-app-test/
  resources-api-test/
docs/
  user/
```

## Historial de trabajo con GitHub Copilot

En `docs/user/` está documentado el paso a paso del trabajo realizado con GitHub Copilot mediante el historial de prompts de usuario:
- `docs/user/00-user-creacionproyecto.md`
- `docs/user/01-user-functionalspec.md`

## Feature Login implementada

### Backend
- `GET /health` -> `{ "status": "ok" }`
- `POST /echo` con `{ "message": "hola" }` -> `{ "message": "hola", "source": "api" }`
- `POST /api/v1/auth/social/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me` (requiere `Authorization: Bearer <accessToken>`)

### Frontend
UI con flujo de autenticación:
- Ruta pública `/` (Home de producto)
- Ruta pública `/login`
- Ruta protegida `/projects`
- Login social (Google) contra API
- Logout con limpieza de sesión en cliente

## Feature Home implementada (`02-feature-home`)

Nueva home pública en `/` con:
- logo neon `ResouceApp`
- menú superior con link directo a `/login` y toggle modo oscuro/claro
- bloque destacado de funcionalidades en formato carrusel (inspiración Frontitude)
- bloque de 10 clientes ficticios con logos recreados en estilo neon
- bloque de comentarios de clientes con foto por comentario
- testimonios en assets locales WebP para optimización web

### Frontend tests añadidos/actualizados

En `src/resources-app-test/App.integration.test.tsx` se cubren:
- render de Home con estructura principal
- navegación Home -> Login
- interacción del carrusel
- cambio de modo oscuro/claro desde menú
- validación de imágenes de testimonios optimizadas para web (preferencia WebP)
- protección de `/projects` para usuarios no autenticados
- login, persistencia de sesión, error de login y logout

Documentación detallada de la feature:
- `docs/02-feature-home/README.md`
- `docs/02-feature-home/plan.md`

## Requisitos

- .NET SDK 8+
- Node 20+

## Instalación

```bash
cd src/resources-app
npm install

cd ../resources-app-test
npm install
```

## Ejecución local

### API
```bash
dotnet run --project src/resources-api/resources-api.csproj
```

### Frontend
```bash
cd src/resources-app
cp .env.example .env
npm run dev
```

Variables esperadas en `src/resources-app/.env` para login social:
- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`

### URLs a abrir (sin Docker)
- Frontend: `http://localhost:5173`
- API base: `http://localhost:5000`
- API health check: `http://localhost:5000/health`
- API echo (POST): `http://localhost:5000/echo`

## Tests y validación

Backend:
```bash
dotnet test src/resources-api-test/resources-api-test.csproj
```

Frontend:
```bash
cd src/resources-app-test
npm test
```

Comandos agregados en raíz:
```bash
npm run lint
npm run test
npm run build
```

## Ejecución con Docker

### Requisitos
- Docker Desktop (o Docker Engine + Docker Compose v2)

### Levantar solo MySQL (para desarrollo local de la API)

Cuando quieres ejecutar la API directamente con `dotnet run` (sin Docker) pero necesitas la base de datos MySQL:

```bash
docker compose up mysql -d
```

Esto levanta únicamente el contenedor MySQL con:
- **Host:** `localhost`
- **Puerto:** `3306`
- **Base de datos:** `resourcesdb`
- **Usuario:** `resources_user`
- **Password:** `resources_pass`

La cadena de conexión ya está configurada en los User Secrets del proyecto (ver sección [Login social en desarrollo](#login-social-en-desarrollo)).  
Para añadir el secret manualmente:

```bash
cd src/resources-api
dotnet user-secrets set "ConnectionStrings:Default" \
  "Server=localhost;Port=3306;Database=resourcesdb;User=resources_user;Password=resources_pass;"
```

Para parar MySQL:
```bash
docker compose down
# o sin borrar el volumen de datos:
docker compose stop mysql
```

### Levantar MySQL + API + Frontend
```bash
docker compose up --build
```

Servicios disponibles:
- Frontend: `http://localhost:5173`
- API: `http://localhost:5000`
- MySQL: `localhost:3306`

### Conexión a MySQL (ejecución local con Docker)

Credenciales definidas en `docker-compose.yml`:
- Host: `localhost`
- Puerto: `3306`
- Database: `resourcesdb`
- Usuario: `resources_user`
- Password: `resources_pass`
- Root password: `root_password`

Si ejecutas la API fuera de Docker, levanta MySQL con Docker y usa los User Secrets (ver sección [Levantar solo MySQL](#levantar-solo-mysql-para-desarrollo-local-de-la-api)):

```bash
dotnet run --project src/resources-api/resources-api.csproj
```

## Login social en desarrollo

Para pruebas locales rápidas sin depender de Google Cloud durante tests, la API acepta tokens de desarrollo con formato:

`test-token:<providerUserId>:<email>`

Ejemplo:

`test-token:user-dev:dev@example.com`

Configuración recomendada en desarrollo para secretos (User Secrets de .NET):
```bash
cd src/resources-api
dotnet user-secrets init
dotnet user-secrets set "Authentication:Google:ClientId" "<google-client-id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<google-client-secret>"
dotnet user-secrets set "ConnectionStrings:Default" "Server=localhost;Port=3306;Database=resourcesdb;User=resources_user;Password=resources_pass;"
```

### Ejecutar tests en contenedores
Backend:
```bash
docker compose --profile test run --rm api-test
```

Frontend:
```bash
docker compose --profile test run --rm app-test
```

### Parar servicios
```bash
docker compose down
```

## Dockerfiles incluidos
- `src/resources-api/Dockerfile`
- `src/resources-app/Dockerfile`
- `src/resources-api-test/Dockerfile`
- `src/resources-app-test/Dockerfile`