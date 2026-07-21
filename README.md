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

## Ejemplo mínimo implementado

### Backend
- `GET /health` -> `{ "status": "ok" }`
- `POST /echo` con `{ "message": "hola" }` -> `{ "message": "hola", "source": "api" }`

### Frontend
UI simple con:
- Botón para comprobar `health`
- Form para enviar `echo`
- Render de respuestas

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

Ejemplo de cadena de conexión para .NET en local:
```text
Server=localhost;Port=3306;Database=resourcesdb;User=resources_user;Password=resources_pass;
```

Si ejecutas la API fuera de Docker y quieres conectar contra este MySQL:
```bash
ConnectionStrings__Default="Server=localhost;Port=3306;Database=resourcesdb;User=resources_user;Password=resources_pass;" \
dotnet run --project src/resources-api/resources-api.csproj
```

Configuración adicional de autenticación (variables de entorno .NET):
```bash
Authentication__Google__ClientId="<google-client-id>" \
Authentication__Google__ClientSecret="<google-client-secret>" \
Authentication__Google__CallbackPath="/signin-google" \
Authentication__Jwt__Issuer="resources-api" \
Authentication__Jwt__Audience="resources-app" \
Authentication__Jwt__AccessTokenMinutes="15" \
Authentication__Jwt__RefreshTokenDays="30" \
dotnet run --project src/resources-api/resources-api.csproj
```

Configuración recomendada en desarrollo para secretos (User Secrets de .NET):
```bash
cd src/resources-api
dotnet user-secrets init
dotnet user-secrets set "Authentication:Google:ClientId" "<google-client-id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<google-client-secret>"
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