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
```

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