# 01 — Feature Login (Plan de implementación detallado)

## 1) Objetivo

Definir e implementar el feature de login social en `resources-api` y `resources-app` con contrato **API REST**, incluyendo autenticación, emisión de tokens, actualización de `lastLoginAt` en `User` y cobertura de pruebas.

## 2) Alcance de esta iteración

- Diseñar y documentar endpoints REST para autenticación.
- Soportar login social con **Google** en la primera versión.
- Implementar flujo de login en backend (`src/resources-api`).
- Implementar flujo de login en frontend (`src/resources-app`).
- Persistir/actualizar fecha de último login (`User.lastLoginAt`).
- Persistir `refreshToken` en base de datos con revocación.
- Añadir pruebas backend (`src/resources-api-test`) para contrato y reglas de negocio.
- Añadir pruebas frontend (`src/resources-app-test`) para flujo de autenticación.
- Mantener compatibilidad con el estilo y convenciones existentes del proyecto.

## 3) Criterios REST que aplicaremos

1. Endpoints versionados bajo `/api/v1`.
2. Uso correcto de verbos HTTP:
   - `POST` para operaciones de login/refresh/logout.
   - `GET` solo para lectura de recursos/perfil.
3. Códigos de estado explícitos:
   - `200 OK`, `201 Created` (si aplica), `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`.
4. Errores con formato consistente (preferiblemente `ProblemDetails` de ASP.NET Core).
5. Contratos request/response estables y documentados.

## 4) Contrato API propuesto (base)

> Nota: esta versión queda definida como **solo login social**.

### 4.1 Login social

`POST /api/v1/auth/social/login`

Request (ejemplo):

```json
{
  "provider": "google",
  "idToken": "provider-id-token"
}
```

Response `200 OK` (ejemplo):

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "refresh-token",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "lastLoginAt": "2026-07-22T00:00:00Z"
  }
}
```

### 4.2 Refresh token

`POST /api/v1/auth/refresh`

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response `200 OK`: nuevo `accessToken` y rotación de `refreshToken` persistido.
Política inicial: `accessToken` 15 minutos y `refreshToken` 30 días.

### 4.3 Logout

`POST /api/v1/auth/logout`

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response `204 No Content` (token invalidado).

### 4.4 Perfil autenticado

`GET /api/v1/me`

Response `200 OK`:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "lastLoginAt": "2026-07-22T00:00:00Z"
}
```

## 5) Reglas de negocio del login

1. Solo usuarios válidos y activos pueden autenticarse.
2. En login exitoso:
   - actualizar `User.lastLoginAt` con timestamp UTC.
   - devolver tokens válidos.
   - si el usuario no existe, crear perfil básico automáticamente.
3. En login fallido:
   - no actualizar `lastLoginAt`.
   - responder `401 Unauthorized` sin exponer detalle sensible del proveedor.

## 6) Diseño técnico backend (ASP.NET Core)

1. **Controller / Endpoints**
   - `AuthController` o endpoints minimal API bajo `/api/v1/auth`.
2. **Application Service**
   - `LoginService` con casos de uso: login, refresh, logout.
   - `SocialLoginService` para validación del token del proveedor.
3. **Repositorio**
   - consultas por email/identificador.
   - actualización atómica de `lastLoginAt`.
   - persistencia y revocación de `refreshToken`.
4. **Seguridad**
   - validación segura de token del proveedor social (Google).
   - firma y expiración de JWT (`accessToken`: 15 min).
   - refresh token revocable.
   - expiración de `refreshToken`: 30 días.
5. **Observabilidad**
   - logs estructurados (sin exponer secretos).
   - trazas de éxito/error por endpoint.

### 6.1 Entidades necesarias (EF Core)

Para soportar login social + sesión con refresh token, se documentan estas entidades mínimas:

1. **User** (existente, extender)
   - Campos clave:
     - `Id`
     - `Email`
     - `LastLoginAt` (nuevo/requerido para esta feature)
     - `CreatedAt`, `UpdatedAt`, `IsDeleted` (si aplica al modelo actual)
   - Uso:
     - se actualiza `LastLoginAt` en login exitoso.

2. **UserSocialLogin** (nueva)
   - Campos clave:
     - `Id`
     - `UserId` (FK a `User`)
     - `Provider` (ej. `google`)
     - `ProviderUserId` (claim `sub` de Google)
     - `ProviderEmail` (email recibido del proveedor)
     - `CreatedAt`, `UpdatedAt`
   - Restricciones recomendadas:
     - único por `(Provider, ProviderUserId)`.
   - Uso:
     - vincular identidad externa con usuario interno.

3. **RefreshToken** (nueva)
   - Campos clave:
     - `Id`
     - `UserId` (FK a `User`)
     - `TokenHash` (no guardar token plano)
     - `ExpiresAt`
     - `RevokedAt` (nullable)
     - `CreatedAt`
     - `CreatedByIp` (opcional, recomendado)
     - `ReplacedByTokenHash` (nullable, para rotación)
   - Restricciones recomendadas:
     - índice por `UserId`
     - índice único por `TokenHash`
   - Uso:
     - refresh, rotación y revocación de sesión.

### 6.2 Migración EF Core para la feature

1. Crear/actualizar entidades y mapeos (`DbSet`, `EntityTypeConfiguration`).
2. Crear migración:
   - `dotnet ef migrations add AddSocialLoginAndRefreshTokens --project src/resources-api/resources-api.csproj`
3. Revisar el archivo de migración:
   - alta de tablas `UserSocialLogins` y `RefreshTokens`,
   - alter/alta de columna `Users.LastLoginAt`,
   - FKs, índices únicos e índices de consulta.
4. Aplicar migración en local:
   - `dotnet ef database update --project src/resources-api/resources-api.csproj`

### 6.3 Aplicar migraciones en startup

La API debe ejecutar migraciones pendientes al iniciar (especialmente en desarrollo/entornos controlados).

Patrón recomendado en `Program.cs`:

```csharp
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    dbContext.Database.Migrate();
}
```

Recomendación operativa:
- En **Development**: aplicar automáticamente en startup.
- En **Producción**: decidir entre
  - auto-migración controlada al arrancar, o
  - pipeline de despliegue que ejecute `dotnet ef database update` antes de levantar la API.
- En ambos casos, dejar logs claros del resultado de migración.

## 7) Diseño técnico frontend (React + TypeScript)

1. **Pantallas y componentes**
   - Botón "Login con Google".
   - Estado de sesión (autenticado/no autenticado).
   - Vista de perfil básico (`/me`) tras login.
2. **Cliente OAuth**
   - Integración con Google Identity Services.
   - Uso de `VITE_GOOGLE_CLIENT_ID`.
3. **Integración con API REST**
   - Enviar credencial social al endpoint `POST /api/v1/auth/social/login`.
   - Guardar `accessToken` en memoria y `refreshToken` según estrategia definida.
   - Llamar `POST /api/v1/auth/refresh` ante expiración de access token.
4. **Seguridad frontend**
   - No exponer `ClientSecret` en frontend.
   - Manejo de expiración de sesión y logout limpio.

### 7.1 Rutas frontend definidas (V1)

1. **`/login`** (pública)
   - Página de autenticación.
   - Contenido:
     - título de acceso,
     - botón "Continuar con Google",
     - feedback básico de error en caso de login fallido.
   - Si el usuario ya está autenticado, redirige a `/projects`.

2. **`/projects`** (protegida)
   - Página de listado de proyectos.
   - En esta iteración será placeholder con un mensaje:
     - `"Listado de proyectos (pendiente de implementación)"`
   - Si el usuario no está autenticado, redirige a `/login`.

3. **Ruta raíz `/'`**
   - Redirección por estado de sesión:
     - autenticado -> `/projects`
     - no autenticado -> `/login`

## 8) Configuración Google Cloud (OAuth) requerida

### 8.1 Crear proyecto en Google Cloud
1. Entrar en `https://console.cloud.google.com/`.
2. Arriba a la izquierda, abrir el selector de proyecto.
3. Pulsar **New Project**.
4. Definir:
   - **Project name** (ej. `bigschool-login-dev`)
   - **Organization / Location** (si aplica)
5. Pulsar **Create**.
6. Seleccionar el proyecto recién creado.

### 8.2 Configurar pantalla de consentimiento OAuth
1. Ir a **APIs & Services > OAuth consent screen**.
2. Elegir tipo de usuario:
   - **External** (normal en apps públicas).
   - **Internal** (solo Google Workspace interna).
3. Completar datos mínimos:
   - **App name**
   - **User support email**
   - **Developer contact information**
4. Guardar con **Save and Continue**.
5. Scopes:
   - Para esta iteración, dejar scopes básicos (`openid`, `email`, `profile`) o los que proponga Google para Sign-In.
6. Test users (si el estado está en Testing):
   - añadir cuentas de prueba que podrán autenticarse.
7. Publicar/guardar:
   - en desarrollo puede quedarse en **Testing**.
   - para producción, evaluar publicación a **In production**.

### 8.3 Crear credenciales OAuth (Client ID/Secret)
1. Ir a **APIs & Services > Credentials**.
2. Pulsar **Create Credentials > OAuth client ID**.
3. En **Application type**, seleccionar **Web application**.
4. Asignar nombre (ej. `bigschool-web-local`).
5. Configurar URLs autorizadas (detalle en 8.4 y 8.5).
6. Pulsar **Create**.
7. Copiar y guardar:
   - **Client ID** (se usa en frontend: `VITE_GOOGLE_CLIENT_ID`)
   - **Client Secret** (solo backend: `Authentication:Google:ClientSecret`)

### 8.4 URLs a habilitar para desarrollo (local y Docker)
> Con la configuración actual, local y Docker exponen frontend en el mismo origin público.

En el cliente OAuth de Google, configurar:

1. **Authorized JavaScript origins** (obligatorio para flujo actual `idToken`):
   - `http://localhost:5173`
   - `http://127.0.0.1:5173` (recomendado adicional)
2. **Authorized redirect URIs** (opcional en esta iteración; obligatorio si migramos a Authorization Code + PKCE):
   - `http://localhost:5173/auth/callback`
   - `http://127.0.0.1:5173/auth/callback` (recomendado)

### 8.5 URLs a habilitar para producción
En el cliente OAuth de Google, añadir:

1. **Authorized JavaScript origins**:
   - `https://<tu-dominio-frontend>`
   - `https://www.<tu-dominio-frontend>` (si existe)
2. **Authorized redirect URIs** (si usas callback):
   - `https://<tu-dominio-frontend>/auth/callback`
   - `https://www.<tu-dominio-frontend>/auth/callback` (si existe)

### 8.6 Configurar parámetros en el proyecto
1. Frontend (`src/resources-app/.env`):
   - `VITE_GOOGLE_CLIENT_ID=<client-id-google>`
2. Backend (`appsettings` o env vars):
   - `Authentication__Google__ClientId=<client-id-google>`
   - `Authentication__Google__ClientSecret=<client-secret-google>`
3. Reiniciar frontend y backend tras actualizar variables.

### 8.7 Validación final (checklist rápido)
1. Cargar frontend en `http://localhost:5173`.
2. Pulsar “Login con Google”.
3. Verificar que Google no devuelve error de `origin_mismatch`.
4. Confirmar que la API recibe `idToken` en `POST /api/v1/auth/social/login`.
5. Confirmar respuesta `200` con `accessToken`, `refreshToken` y `user.lastLoginAt`.

### 8.8 Nota importante
- En el flujo actual (`idToken` en frontend), Google valida principalmente el **origin** del frontend.
- La URL del backend API (`http://localhost:5000`) no se registra como origin OAuth en Google para este flujo.

## 9) Parámetros de configuración del proyecto

### Frontend (`src/resources-app/.env`)
- `VITE_API_BASE_URL`
- `VITE_GOOGLE_CLIENT_ID`

### Backend (`src/resources-api/appsettings*.json` o variables de entorno)
- `Authentication:Google:ClientId`
- `Authentication:Google:ClientSecret`
- `Authentication:Google:CallbackPath`
- `Authentication:Jwt:Issuer`
- `Authentication:Jwt:Audience`
- `Authentication:Jwt:AccessTokenMinutes` (15)
- `Authentication:Jwt:RefreshTokenDays` (30)

Variables de entorno equivalentes en .NET:
- `Authentication__Google__ClientId`
- `Authentication__Google__ClientSecret`
- `Authentication__Google__CallbackPath`
- `Authentication__Jwt__Issuer`
- `Authentication__Jwt__Audience`
- `Authentication__Jwt__AccessTokenMinutes`
- `Authentication__Jwt__RefreshTokenDays`

### Recomendación para secretos en desarrollo (.NET User Secrets)

No guardar `ClientSecret` en `appsettings.Development.json`. Usar User Secrets:

```bash
cd src/resources-api
dotnet user-secrets init
dotnet user-secrets set "Authentication:Google:ClientId" "<google-client-id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<google-client-secret>"
```

## 10) Plan por fases

### Fase A — Contrato y base técnica
- Definir DTOs request/response.
- Definir estructura de errores.
- Configurar versionado de rutas (`/api/v1`).
- Definir integración frontend con Google Identity Services (flujo idToken).

### Fase B — Persistencia y dominio
- Incorporar campo `lastLoginAt` en entidad/mapeo.
- Incorporar entidad/tabla de `UserSocialLogins` para vincular Google (`provider + providerUserId`).
- Ajustar repositorios para lectura y update de último login.
- Incorporar entidad/tabla de `refreshTokens` con expiración y revocación.
- Crear/ajustar migración si corresponde.
- Configurar aplicación de migraciones EF al inicio de la API.

### Fase C — Endpoints REST de auth
- Implementar `POST /auth/social/login`.
- Implementar `POST /auth/refresh`.
- Implementar `POST /auth/logout`.
- Implementar `GET /me`.

### Fase C.1 — Frontend auth
- Implementar botón de login con Google.
- Implementar intercambio de credencial con API.
- Persistir estado de sesión en cliente.
- Integrar logout y refresh.

### Fase D — Seguridad y validaciones
- Validaciones de payload.
- Políticas de autorización.
- Gestión de expiración y revocación de tokens.

### Fase E — Tests
- Tests de integración API:
  - login exitoso
  - login inválido
  - refresh válido/inválido
  - logout y token revocado
  - `lastLoginAt` actualizado solo en login exitoso
- Tests de contrato (status code + shape de respuesta).
- Tests frontend:
  - render de botón login Google
  - login exitoso y guardado de sesión
  - error de login y feedback de UI
  - logout y limpieza de sesión

### Fase F — Cierre
- Actualizar documentación técnica de endpoints.
- Ejecutar suite de tests backend y frontend.
- Verificar comportamiento REST final.

## 11) Checklist de definición (DoR) y entrega (DoD)

### DoR
- [x] Método de login confirmado: solo social.
- [x] Proveedor social confirmado para V1: Google.
- [x] Estrategia confirmada: access token + refresh token persistido en DB.
- [x] Expiración inicial confirmada: access 15 min + refresh 30 días.
- [x] Flujo OAuth confirmado para V1: idToken en frontend + validación en API.

### DoD
- [ ] Endpoints REST implementados y probados.
- [ ] Frontend integrado con login Google.
- [ ] `lastLoginAt` persistido correctamente.
- [ ] Errores y códigos HTTP consistentes.
- [ ] Pruebas backend y frontend en verde.
- [ ] Documentación actualizada.
- [ ] Configuración Google OAuth documentada y validada.

## 12) Dudas abiertas

Sin dudas bloqueantes por ahora.
